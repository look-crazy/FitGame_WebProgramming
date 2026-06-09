/**
 * Workout 모델
 * 운동 기록을 저장합니다. EXP/점수 계산의 핵심 데이터 소스.
 */

const mongoose = require('mongoose');

// 세트 서브 스키마 (근력 운동용)
const SetSchema = new mongoose.Schema({
  setNumber: { type: Number, required: true },   // 세트 번호 (1, 2, 3...)
  weight: { type: Number, default: 0 },           // 무게 (kg)
  reps: { type: Number, default: 0 },             // 반복 횟수
  _id: false // 서브도큐먼트 _id 비활성화
});

const WorkoutSchema = new mongoose.Schema({
  // 어느 유저의 기록인지
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ================================
  // 운동 기본 정보
  // ================================
  type: {
    type: String,
    required: [true, '운동 종류를 선택해주세요.'],
    enum: {
      values: ['bench_press', 'squat', 'deadlift', 'running', 'cycling', 'push_up', 'free'],
      message: '지원하지 않는 운동 종류입니다.'
    }
  },
  name: {
    type: String,
    required: true // 한국어 이름 (예: "벤치프레스")
  },
  note: {
    type: String,
    maxlength: [500, '메모는 500자 이하로 작성해주세요.'],
    default: ''
  },

  // ================================
  // 근력 운동 세트 기록
  // (type이 strength/bodyweight일 때 사용)
  // ================================
  sets: [SetSchema],

  // ================================
  // 유산소/시간 기반 운동
  // (type이 cardio/free일 때 사용)
  // ================================
  duration: {
    type: Number,   // 분 단위
    default: 0
  },
  distance: {
    type: Number,   // km 단위 (러닝/사이클용)
    default: 0
  },

  // ================================
  // 게임 점수 (기록 저장 시 계산)
  // ================================
  score: { type: Number, default: 0 },
  expGained: { type: Number, default: 0 },

  // ================================
  // 기록 날짜 (달력 표시용)
  // ================================
  date: {
    type: Date,
    required: true,
    default: Date.now
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 수정 시 updatedAt 자동 갱신
WorkoutSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ================================
// 인덱스 설정
// ================================
WorkoutSchema.index({ userId: 1, date: -1 });   // 유저별 날짜순 조회
WorkoutSchema.index({ userId: 1, type: 1 });    // 운동 종류별 조회
WorkoutSchema.index({ date: -1 });               // 최신 운동 조회

module.exports = mongoose.model('Workout', WorkoutSchema);
