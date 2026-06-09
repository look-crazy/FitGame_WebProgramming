/**
 * 운동 기록 라우터
 * 운동 CRUD + 점수/EXP 자동 계산 + 업적 체크
 */

const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { calculateWorkoutScore, WORKOUT_SCORE_CONFIG, ACHIEVEMENTS, EXP_PER_SCORE } = require('../config/gameConfig');
const { getIO } = require('../socket/socketHandler');

// 모든 운동 라우트에 인증 필요
router.use(authMiddleware);

// ================================
// POST /api/workouts - 운동 기록 추가
// 가장 핵심 API: 운동 → 점수 → EXP → 레벨업 → 업적 체크
// ================================
router.post('/', async (req, res) => {
  try {
    const { type, sets, duration, distance, note, date } = req.body;

    // 운동 종류 유효성 검사
    if (!WORKOUT_SCORE_CONFIG[type]) {
      return res.status(400).json({ success: false, message: '올바르지 않은 운동 종류입니다.' });
    }

    const config = WORKOUT_SCORE_CONFIG[type];

    // 운동 기록 객체 생성
    const workoutData = {
      userId: req.user._id,
      type,
      name: config.nameKo,
      note: note || '',
      date: date ? new Date(date) : new Date(),
    };

    // 타입에 따라 데이터 저장
    if (['strength', 'bodyweight'].includes(config.type)) {
      if (!sets || sets.length === 0) {
        return res.status(400).json({ success: false, message: '세트 정보를 입력해주세요.' });
      }
      workoutData.sets = sets.map((set, idx) => ({
        setNumber: idx + 1,
        weight: Number(set.weight) || 0,
        reps: Number(set.reps) || 0
      }));
    } else {
      workoutData.duration = Number(duration) || 0;
      workoutData.distance = Number(distance) || 0;
    }

    // ================================
    // 점수 계산 (핵심 게임 로직)
    // ================================
    const score = calculateWorkoutScore(workoutData);
    const expGained = Math.round(score / EXP_PER_SCORE) + 10; // 최소 10 EXP 보장

    workoutData.score = score;
    workoutData.expGained = expGained;

    // 운동 기록 저장
    const workout = new Workout(workoutData);
    await workout.save();

    // ================================
    // 사용자 스탯 업데이트
    // ================================
    const user = await User.findById(req.user._id);

    const { leveledUp, newLevel } = user.addExp(expGained);
    user.gameStats.totalScore += score;
    user.gameStats.weeklyScore += score;
    user.lastWorkoutAt = new Date();

    // 연속 운동 일수 계산
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWorkout = user.lastWorkoutAt;
    if (lastWorkout) {
      const dayDiff = Math.floor((new Date() - lastWorkout) / (1000 * 60 * 60 * 24));
      if (dayDiff <= 1) {
        user.streakDays = (user.streakDays || 0) + 1;
      } else {
        user.streakDays = 1;
      }
    } else {
      user.streakDays = 1;
    }

    await user.save();

    // ================================
    // 업적 체크 (비동기로 처리)
    // ================================
    const newAchievements = [];
    for (const achievement of ACHIEVEMENTS) {
      // 이미 달성한 업적은 스킵
      const alreadyUnlocked = user.achievements.some(a => a.id === achievement.id);
      if (alreadyUnlocked) continue;

      try {
        const unlocked = await achievement.check(req.user._id, Workout);
        if (unlocked) {
          user.achievements.push({ id: achievement.id, unlockedAt: new Date() });
          user.gameStats.points += achievement.points;
          newAchievements.push(achievement);
        }
      } catch (e) {
        console.error('업적 체크 에러:', e);
      }
    }

    if (newAchievements.length > 0) {
      await user.save();
    }

    // ================================
    // 실시간 알림 (Socket.io)
    // ================================
    try {
      const io = getIO();
      if (io) {
        // 글로벌 피드에 운동 완료 알림
        io.emit('workout_completed', {
          userId: user._id,
          nickname: user.nickname,
          workoutName: config.nameKo,
          score,
          expGained,
          tier: user.gameStats.tier,
          timestamp: new Date()
        });

        // 랭킹 업데이트 이벤트
        io.emit('ranking_updated', { userId: user._id });
      }
    } catch (socketErr) {
      console.warn('Socket 이벤트 전송 실패:', socketErr.message);
    }

    res.status(201).json({
      success: true,
      message: '운동 기록이 저장되었습니다! 💪',
      workout,
      rewards: {
        score,
        expGained,
        leveledUp,
        newLevel: leveledUp ? newLevel : undefined,
        newAchievements,
        currentLevel: user.gameStats.level,
        totalExp: user.gameStats.totalExp,
        tier: user.gameStats.tier
      }
    });

  } catch (error) {
    console.error('운동 기록 추가 에러:', error);
    res.status(500).json({ success: false, message: '운동 기록 저장 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/workouts - 내 운동 기록 목록
// ================================
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;

    const filter = { userId: req.user._id };

    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [workouts, total] = await Promise.all([
      Workout.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Workout.countDocuments(filter)
    ]);

    res.json({
      success: true,
      workouts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: '운동 기록 조회 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/workouts/calendar?year=2024&month=5 - 달력용 기록
// ================================
router.get('/calendar', async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const workouts = await Workout.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // 날짜별로 그룹화
    const calendarData = {};
    workouts.forEach(w => {
      const dayKey = w.date.toISOString().split('T')[0];
      if (!calendarData[dayKey]) {
        calendarData[dayKey] = { workouts: [], totalScore: 0, totalExp: 0 };
      }
      calendarData[dayKey].workouts.push(w);
      calendarData[dayKey].totalScore += w.score;
      calendarData[dayKey].totalExp += w.expGained;
    });

    res.json({ success: true, calendarData });

  } catch (error) {
    res.status(500).json({ success: false, message: '달력 데이터 조회 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/workouts/stats - 운동 통계 (Chart.js용)
// ================================
router.get('/stats', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
    }

    const workouts = await Workout.find({
      userId: req.user._id,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    // 일별 점수
    const dailyScores = {};
    const typeDistribution = {};

    workouts.forEach(w => {
      const day = w.date.toISOString().split('T')[0];
      dailyScores[day] = (dailyScores[day] || 0) + w.score;
      typeDistribution[w.name] = (typeDistribution[w.name] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        totalWorkouts: workouts.length,
        totalScore: workouts.reduce((s, w) => s + w.score, 0),
        totalExp: workouts.reduce((s, w) => s + w.expGained, 0),
        dailyScores,
        typeDistribution,
        avgScore: workouts.length > 0 ? Math.round(workouts.reduce((s, w) => s + w.score, 0) / workouts.length) : 0
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/workouts/:id - 단일 운동 조회
// ================================
router.get('/:id', async (req, res) => {
  try {
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user._id });
    if (!workout) return res.status(404).json({ success: false, message: '운동 기록을 찾을 수 없습니다.' });
    res.json({ success: true, workout });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ================================
// PUT /api/workouts/:id - 운동 기록 수정
// ================================
router.put('/:id', async (req, res) => {
  try {
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user._id });
    if (!workout) return res.status(404).json({ success: false, message: '운동 기록을 찾을 수 없습니다.' });

    const oldScore = workout.score;
    const { sets, duration, distance, note } = req.body;

    if (sets) workout.sets = sets;
    if (duration !== undefined) workout.duration = duration;
    if (distance !== undefined) workout.distance = distance;
    if (note !== undefined) workout.note = note;

    // 점수 재계산
    const newScore = calculateWorkoutScore(workout);
    const scoreDiff = newScore - oldScore;
    workout.score = newScore;
    workout.expGained = Math.round(newScore / EXP_PER_SCORE) + 10;

    await workout.save();

    // 유저 스탯 업데이트 (점수 차이만큼)
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        'gameStats.totalScore': scoreDiff,
        'gameStats.weeklyScore': scoreDiff
      }
    });

    res.json({ success: true, message: '운동 기록이 수정되었습니다.', workout });

  } catch (error) {
    res.status(500).json({ success: false, message: '운동 기록 수정 중 오류가 발생했습니다.' });
  }
});

// ================================
// DELETE /api/workouts/:id - 운동 기록 삭제
// ================================
router.delete('/:id', async (req, res) => {
  try {
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user._id });
    if (!workout) return res.status(404).json({ success: false, message: '운동 기록을 찾을 수 없습니다.' });

    // 삭제 시 점수 차감
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        'gameStats.totalScore': -workout.score,
        'gameStats.weeklyScore': -workout.score
      }
    });

    await workout.deleteOne();
    res.json({ success: true, message: '운동 기록이 삭제되었습니다.' });

  } catch (error) {
    res.status(500).json({ success: false, message: '운동 기록 삭제 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
