/**
 * 게임 시스템 라우터
 * 레벨, 티어, 업적, 미션 관련 API
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Workout = require('../models/Workout');
const { authMiddleware } = require('../middleware/auth');
const {
  ACHIEVEMENTS, TIERS, getLevelRequiredExp, getNextLevelExp, getTierByLevel
} = require('../config/gameConfig');

router.use(authMiddleware);

// ================================
// GET /api/game/status - 현재 게임 상태 (대시보드용)
// ================================
router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    // 기존 계정에 gameStats 일부가 없을 때도 대시보드가 죽지 않게 기본값 보정
    const gameStats = {
      level: Number(user.gameStats?.level) || 1,
      totalExp: Number(user.gameStats?.totalExp) || 0,
      weeklyScore: Number(user.gameStats?.weeklyScore) || 0,
      totalScore: Number(user.gameStats?.totalScore) || 0,
      battleWins: Number(user.gameStats?.battleWins) || 0,
      battleLosses: Number(user.gameStats?.battleLosses) || 0,
      points: Number(user.gameStats?.points) || 0
    };

    const currentTier = getTierByLevel(gameStats.level);
    const nextLevelExp = getNextLevelExp(gameStats.level);
    const currentLevelStartExp = getLevelRequiredExp(Math.max(gameStats.level - 1, 0));
    const expProgress = Math.max(gameStats.totalExp - currentLevelStartExp, 0);
    const expNeeded = Math.max(nextLevelExp - currentLevelStartExp, 1);
    const expPercent = Math.min(Math.round((expProgress / expNeeded) * 100), 100);

    // 오늘 운동 기록
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayWorkouts = await Workout.find({
      userId: req.user._id,
      date: { $gte: today }
    });

    const todayScore = todayWorkouts.reduce((s, w) => s + (Number(w.score) || 0), 0);
    const todayExp = todayWorkouts.reduce((s, w) => s + (Number(w.expGained) || 0), 0);
    const streakDays = Number(user.streakDays) || 0;

    const missions = [
      {
        id: 'daily_workout',
        title: '오늘 운동 완료',
        description: '운동 1회 기록하기',
        target: 1,
        current: todayWorkouts.length,
        reward: 50,
        completed: todayWorkouts.length >= 1
      },
      {
        id: 'daily_score',
        title: '점수 달인',
        description: '오늘 300점 이상 획득',
        target: 300,
        current: todayScore,
        reward: 100,
        completed: todayScore >= 300
      },
      {
        id: 'streak',
        title: '연속 운동',
        description: `${streakDays}일째 연속 운동 중!`,
        target: streakDays + 1,
        current: streakDays,
        reward: streakDays * 10,
        completed: false
      }
    ];

    res.json({
      success: true,
      gameStatus: {
        level: gameStats.level,
        tier: currentTier,
        totalExp: gameStats.totalExp,
        weeklyScore: gameStats.weeklyScore,
        totalScore: gameStats.totalScore,
        expProgress,
        expNeeded,
        expPercent,
        nextLevelExp,
        streakDays,
        battleWins: gameStats.battleWins,
        battleLosses: gameStats.battleLosses,
        points: gameStats.points,
        todayWorkouts: todayWorkouts.length,
        todayScore,
        todayExp,
        missions,
        achievements: user.achievements || []
      }
    });

  } catch (error) {
    console.error('게임 상태 조회 에러:', error);
    res.status(500).json({
      success: false,
      message: '게임 상태 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// GET /api/game/achievements - 전체 업적 목록 (달성 여부 포함)
// ================================
router.get('/achievements', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const unlockedIds = user.achievements.map(a => a.id);

    const achievementsWithStatus = ACHIEVEMENTS.map(achievement => {
      const unlocked = unlockedIds.includes(achievement.id);
      const unlockedData = user.achievements.find(a => a.id === achievement.id);

      return {
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        points: achievement.points,
        unlocked,
        unlockedAt: unlockedData?.unlockedAt || null
      };
    });

    res.json({
      success: true,
      achievements: achievementsWithStatus,
      unlockedCount: unlockedIds.length,
      totalCount: ACHIEVEMENTS.length
    });

  } catch (error) {
    res.status(500).json({ success: false, message: '업적 조회 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/game/tiers - 티어 정보
// ================================
router.get('/tiers', (req, res) => {
  res.json({
    success: true,
    tiers: TIERS,
    currentLevel: req.user.gameStats.level
  });
});

// ================================
// POST /api/game/battle/challenge - 배틀 신청
// ================================
router.post('/battle/challenge', async (req, res) => {
  try {
    const { opponentId } = req.body;

    if (opponentId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: '자기 자신과 배틀할 수 없습니다.' });
    }

    const opponent = await User.findById(opponentId).select('-password');
    if (!opponent) {
      return res.status(404).json({ success: false, message: '상대방을 찾을 수 없습니다.' });
    }

    // 이번 주 날짜 범위 계산
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    // 이번 주 각자의 주간 점수로 배틀
    const [myScore, opponentScore] = await Promise.all([
      req.user.gameStats.weeklyScore,
      opponent.gameStats.weeklyScore
    ]);

    let result;
    if (myScore > opponentScore) result = 'win';
    else if (myScore < opponentScore) result = 'lose';
    else result = 'draw';

    // 배틀 기록 저장
    const weekStr = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;

    const user = await User.findById(req.user._id);
    user.battles.push({
      opponent: opponentId,
      result,
      myScore,
      opponentScore,
      week: weekStr
    });

    if (result === 'win') {
      user.gameStats.battleWins += 1;
      user.gameStats.points += 100; // 승리 포인트
    } else if (result === 'lose') {
      user.gameStats.battleLosses += 1;
    }

    await user.save();

    res.json({
      success: true,
      battle: {
        result,
        myScore,
        opponentScore,
        pointsGained: result === 'win' ? 100 : 0,
        opponent: {
          nickname: opponent.nickname,
          level: opponent.gameStats.level,
          tier: opponent.gameStats.tier
        }
      },
      message: result === 'win' ? '🏆 배틀 승리! +100 포인트 획득!' :
                result === 'lose' ? '😤 아쉽지만 다음엔 이길 수 있어요!' :
                '🤝 무승부! 이번 주는 비슷한 수준이네요.'
    });

  } catch (error) {
    console.error('배틀 에러:', error);
    res.status(500).json({ success: false, message: '배틀 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;