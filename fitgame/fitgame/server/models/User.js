/**
 * User 모델
 * 사용자 계정, 게임 스탯, 프로필 정보를 저장합니다.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getTierByLevel, calculateLevel } = require('../config/gameConfig');

const UserSchema = new mongoose.Schema({
  // ================================
  // 기본 계정 정보
  // ================================
  email: {
    type: String,
    required: [true, '이메일은 필수입니다.'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '올바른 이메일 형식이 아닙니다.']
  },
  password: {
    type: String,
    required: [true, '비밀번호는 필수입니다.'],
    minlength: [6, '비밀번호는 최소 6자 이상이어야 합니다.']
  },
  nickname: {
    type: String,
    required: [true, '닉네임은 필수입니다.'],
    unique: true,
    trim: true,
    minlength: [2, '닉네임은 최소 2자 이상이어야 합니다.'],
    maxlength: [15, '닉네임은 최대 15자 이하여야 합니다.']
  },
  profileImage: {
    type: String,
    default: null // null이면 기본 아바타 사용
  },

  // ================================
  // 게임 스탯
  // ================================
  gameStats: {
    totalExp: { type: Number, default: 0 },       // 누적 총 EXP
    level: { type: Number, default: 1 },           // 현재 레벨
    tier: { type: String, default: 'BRONZE' },     // 현재 티어
    totalScore: { type: Number, default: 0 },      // 전체 누적 점수
    weeklyScore: { type: Number, default: 0 },     // 이번 주 점수
    weeklyScoreUpdatedAt: { type: Date, default: Date.now }, // 주간 점수 갱신 시각
    battleWins: { type: Number, default: 0 },      // 배틀 승리 수
    battleLosses: { type: Number, default: 0 },    // 배틀 패배 수
    points: { type: Number, default: 0 },          // 배틀 포인트 (화폐)
  },

  // ================================
  // 업적 달성 기록
  // ================================
  achievements: [{
    id: String,         // 업적 ID
    unlockedAt: Date    // 달성 시각
  }],

  // ================================
  // 친구 시스템
  // ================================
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date, default: Date.now }
  }],

  // ================================
  // 배틀 기록
  // ================================
  battles: [{
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    result: { type: String, enum: ['win', 'lose', 'draw'] },
    myScore: Number,
    opponentScore: Number,
    week: String, // "2024-W20" 형태
    createdAt: { type: Date, default: Date.now }
  }],

  // ================================
  // 마지막 로그인 / 운동 시각
  // ================================
  lastLoginAt: { type: Date, default: Date.now },
  lastWorkoutAt: { type: Date, default: null },
  streakDays: { type: Number, default: 0 }, // 연속 운동 일수

  createdAt: { type: Date, default: Date.now }
});

// ================================
// 비밀번호 해싱 (저장 전 자동 실행)
// ================================
UserSchema.pre('save', async function(next) {
  // 비밀번호가 변경된 경우에만 해싱
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12); // 보안 강도 12
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ================================
// 비밀번호 검증 메서드
// ================================
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ================================
// 게임 스탯 업데이트 메서드
// EXP 추가 시 레벨과 티어를 자동으로 계산
// ================================
UserSchema.methods.addExp = function(expAmount) {
  this.gameStats.totalExp += expAmount;
  const newLevel = calculateLevel(this.gameStats.totalExp);
  const leveledUp = newLevel > this.gameStats.level;
  this.gameStats.level = newLevel;
  this.gameStats.tier = getTierByLevel(newLevel).name;
  return { leveledUp, newLevel };
};

// ================================
// 안전한 사용자 정보 반환 (비밀번호 제외)
// ================================
UserSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// ================================
// 인덱스 설정 (검색 성능 최적화)
// ================================
UserSchema.index({ 'gameStats.weeklyScore': -1 }); // 주간 랭킹
UserSchema.index({ 'gameStats.totalScore': -1 });   // 전체 랭킹
UserSchema.index({ email: 1 });
UserSchema.index({ nickname: 1 });

module.exports = mongoose.model('User', UserSchema);
