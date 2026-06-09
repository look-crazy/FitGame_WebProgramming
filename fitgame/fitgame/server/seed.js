// =====================================================
// seed.js - 테스트 데이터 시드 스크립트
// =====================================================
// 실행: node server/seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/database');
const User = require('./models/User');
const Workout = require('./models/Workout');
const { calculateWorkoutScore, GAME_CONFIG } = require('./config/gameConfig');

const SEED_USERS = [
  { username: 'testuser', email: 'test@fitgame.com', password: 'test1234', nickname: '테스트유저' },
  { username: 'ironking', email: 'iron@fitgame.com', password: 'test1234', nickname: '아이언킹' },
  { username: 'cardioace', email: 'cardio@fitgame.com', password: 'test1234', nickname: '유산소에이스' },
  { username: 'flexmaster', email: 'flex@fitgame.com', password: 'test1234', nickname: '유연성마스터' },
];

const WORKOUT_TEMPLATES = [
  { name: '스쿼트', type: 'strength', sets: [{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }, { weight: 80, reps: 8 }] },
  { name: '벤치프레스', type: 'strength', sets: [{ weight: 60, reps: 12 }, { weight: 65, reps: 10 }, { weight: 65, reps: 8 }] },
  { name: '데드리프트', type: 'strength', sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }, { weight: 100, reps: 3 }] },
  { name: '러닝', type: 'cardio', duration: 30, distance: 5 },
  { name: '사이클링', type: 'cardio', duration: 45, distance: 15 },
  { name: '수영', type: 'cardio', duration: 40 },
  { name: '요가', type: 'flexibility', duration: 60 },
];

async function seed() {
  await connectDB();
  console.log('🌱 시드 시작...');

  // 기존 데이터 삭제
  await User.deleteMany({});
  await Workout.deleteMany({});
  console.log('🗑️  기존 데이터 삭제 완료');

  // 유저 생성
  const users = [];
  for (const u of SEED_USERS) {
    const hashedPw = await bcrypt.hash(u.password, 10);
    const user = new User({ ...u, password: hashedPw });
    await user.save();
    users.push(user);
    console.log(`✅ 유저 생성: ${u.nickname}`);
  }

  // 운동 기록 생성 (각 유저별 최근 14일)
  const now = new Date();
  for (const user of users) {
    let totalExp = 0;
    const workoutCount = Math.floor(Math.random() * 20) + 10;

    for (let i = 0; i < workoutCount; i++) {
      const template = WORKOUT_TEMPLATES[Math.floor(Math.random() * WORKOUT_TEMPLATES.length)];
      const daysAgo = Math.floor(Math.random() * 14);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      const scoreData = calculateWorkoutScore(template);

      const workout = new Workout({
        user: user._id,
        ...template,
        date,
        score: scoreData.score,
        expGained: scoreData.exp,
      });
      await workout.save();
      totalExp += scoreData.exp;
    }

    // EXP 누적 및 레벨 계산
    await user.addExp(totalExp);
    // 랜덤 점수 추가
    user.gameStats.totalScore = Math.floor(Math.random() * 5000) + 1000;
    user.gameStats.weeklyScore = Math.floor(Math.random() * 1000) + 100;
    user.gameStats.workoutCount = workoutCount;
    await user.save();
    console.log(`🏋️  ${user.nickname}: ${workoutCount}개 운동, Lv.${user.gameStats.level}`);
  }

  // 친구 관계 추가 (testuser ↔ ironking)
  const testUser = users[0];
  const ironKing = users[1];
  testUser.friends.push({ user: ironKing._id, status: 'accepted' });
  ironKing.friends.push({ user: testUser._id, status: 'accepted' });
  await testUser.save();
  await ironKing.save();
  console.log('👥 친구 관계 추가 완료');

  console.log('\n🎉 시드 완료!');
  console.log('─────────────────────────────────────────');
  console.log('테스트 계정:');
  SEED_USERS.forEach(u => console.log(`  이메일: ${u.email} / 비밀번호: ${u.password}`));
  console.log('─────────────────────────────────────────');

  mongoose.disconnect();
}

seed().catch(e => {
  console.error('시드 오류:', e);
  mongoose.disconnect();
  process.exit(1);
});
