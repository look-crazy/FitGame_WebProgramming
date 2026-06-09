/**
 * 게임 시스템 상수 설정
 * EXP, 레벨, 티어, 점수 계산 알고리즘의 핵심 수치들
 */

// ================================
// 운동 종류별 점수 계산 가중치
// ================================
const WORKOUT_SCORE_CONFIG = {
  // 근력 운동: (무게 × 세트 × 반복) / 10
  bench_press: { type: 'strength', baseMultiplier: 1.2, nameKo: '벤치프레스' },
  squat: { type: 'strength', baseMultiplier: 1.3, nameKo: '스쿼트' },
  deadlift: { type: 'strength', baseMultiplier: 1.4, nameKo: '데드리프트' },
  push_up: { type: 'bodyweight', baseMultiplier: 0.5, nameKo: '푸쉬업' },
  // 유산소: (시간(분) × 1.0)
  running: { type: 'cardio', baseMultiplier: 2.0, nameKo: '러닝' },
  cycling: { type: 'cardio', baseMultiplier: 1.5, nameKo: '사이클' },
  // 자유 운동
  free: { type: 'free', baseMultiplier: 1.0, nameKo: '자유 운동' }
};

// ================================
// EXP 계산: 점수의 10%를 EXP로 부여
// ================================
const EXP_PER_SCORE = 10; // 점수 10점당 EXP 1

// ================================
// 레벨업 EXP 임계값 (레벨별 누적 EXP)
// 공식: 레벨 N 달성에 필요한 총 EXP = 100 × N × (N+1) / 2
// ================================
const getLevelRequiredExp = (level) => {
  return 100 * level * (level + 1) / 2;
};

// 현재 EXP로 레벨 계산
const calculateLevel = (totalExp) => {
  let level = 1;
  while (getLevelRequiredExp(level) <= totalExp) {
    level++;
  }
  return level - 1;
};

// 다음 레벨까지 필요 EXP
const getNextLevelExp = (level) => getLevelRequiredExp(level + 1);

// ================================
// 티어 시스템 (레벨 기준)
// ================================
const TIERS = [
  { name: 'BRONZE', nameKo: '브론즈', minLevel: 1, maxLevel: 9, color: '#CD7F32', gradient: 'linear-gradient(135deg, #8B4513, #CD7F32)' },
  { name: 'SILVER', nameKo: '실버', minLevel: 10, maxLevel: 19, color: '#C0C0C0', gradient: 'linear-gradient(135deg, #808080, #C0C0C0)' },
  { name: 'GOLD', nameKo: '골드', minLevel: 20, maxLevel: 29, color: '#FFD700', gradient: 'linear-gradient(135deg, #DAA520, #FFD700)' },
  { name: 'PLATINUM', nameKo: '플래티넘', minLevel: 30, maxLevel: 49, color: '#00CED1', gradient: 'linear-gradient(135deg, #008B8B, #00CED1)' },
  { name: 'DIAMOND', nameKo: '다이아', minLevel: 50, maxLevel: 999, color: '#00BFFF', gradient: 'linear-gradient(135deg, #1E90FF, #00BFFF)' }
];

const getTierByLevel = (level) => {
  return TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || TIERS[0];
};

// ================================
// 업적 시스템 정의
// ================================
const ACHIEVEMENTS = [
  {
    id: 'week_streak_7',
    title: '7일의 전사',
    description: '7일 연속 운동 달성',
    icon: '🔥',
    points: 500,
    check: async (userId, WorkoutModel) => {
      // 최근 7일 연속 운동 여부 확인
      const last7Days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
      }
      const workouts = await WorkoutModel.find({
        userId,
        date: { $gte: new Date(last7Days[6]), $lte: new Date() }
      });
      const workoutDays = new Set(workouts.map(w => w.date.toISOString().split('T')[0]));
      return last7Days.every(day => workoutDays.has(day));
    }
  },
  {
    id: 'two_hours_day',
    title: '철인의 하루',
    description: '하루 총 2시간 이상 운동',
    icon: '⏱️',
    points: 300,
    check: async (userId, WorkoutModel) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const workouts = await WorkoutModel.find({
        userId,
        date: { $gte: today }
      });
      const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
      return totalMinutes >= 120;
    }
  },
  {
    id: 'squat_100kg',
    title: '레그데이 킹',
    description: '스쿼트 100kg 달성',
    icon: '👑',
    points: 1000,
    check: async (userId, WorkoutModel) => {
      const workout = await WorkoutModel.findOne({
        userId,
        type: 'squat',
        'sets.weight': { $gte: 100 }
      });
      return !!workout;
    }
  },
  {
    id: 'total_30_workouts',
    title: '30번의 땀방울',
    description: '총 운동 30회 달성',
    icon: '💪',
    points: 800,
    check: async (userId, WorkoutModel) => {
      const count = await WorkoutModel.countDocuments({ userId });
      return count >= 30;
    }
  },
  {
    id: 'first_workout',
    title: '첫 걸음',
    description: '첫 번째 운동 기록',
    icon: '🌟',
    points: 100,
    check: async (userId, WorkoutModel) => {
      const count = await WorkoutModel.countDocuments({ userId });
      return count >= 1;
    }
  },
  {
    id: 'total_10_workouts',
    title: '습관의 시작',
    description: '총 운동 10회 달성',
    icon: '📈',
    points: 300,
    check: async (userId, WorkoutModel) => {
      const count = await WorkoutModel.countDocuments({ userId });
      return count >= 10;
    }
  }
];

// ================================
// 점수 계산 함수
// ================================
const calculateWorkoutScore = (workout) => {
  const config = WORKOUT_SCORE_CONFIG[workout.type] || WORKOUT_SCORE_CONFIG.free;
  let score = 0;

  if (config.type === 'strength') {
    // 근력 운동: 각 세트의 (무게 × 반복) 합산
    if (workout.sets && workout.sets.length > 0) {
      const totalVolume = workout.sets.reduce((sum, set) => {
        return sum + (set.weight || 0) * (set.reps || 0);
      }, 0);
      score = (totalVolume / 10) * config.baseMultiplier;
    }
  } else if (config.type === 'bodyweight') {
    // 자체 중량 운동: 총 반복 수
    if (workout.sets && workout.sets.length > 0) {
      const totalReps = workout.sets.reduce((sum, set) => sum + (set.reps || 0), 0);
      score = totalReps * config.baseMultiplier;
    }
  } else if (config.type === 'cardio' || config.type === 'free') {
    // 유산소/자유: 시간(분) 기반
    score = (workout.duration || 0) * config.baseMultiplier;
  }

  return Math.round(score);
};

module.exports = {
  WORKOUT_SCORE_CONFIG,
  EXP_PER_SCORE,
  TIERS,
  ACHIEVEMENTS,
  getLevelRequiredExp,
  calculateLevel,
  getNextLevelExp,
  getTierByLevel,
  calculateWorkoutScore
};
