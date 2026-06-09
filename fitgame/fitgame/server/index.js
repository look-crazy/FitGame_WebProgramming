/**
 * FitGame - 메인 서버 진입점
 * Express + Socket.io + MongoDB 통합 서버
 */

// 환경변수 로드 (가장 먼저 실행되어야 함)
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

// 데이터베이스 연결
const connectDB = require('./config/database');

// 라우터 임포트
const authRoutes = require('./routes/auth');
const workoutRoutes = require('./routes/workout');
const gameRoutes = require('./routes/game');
const rankingRoutes = require('./routes/ranking');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');

// Socket.io 핸들러
const socketHandler = require('./socket/socketHandler');

// Express 앱 초기화
const app = express();

// HTTP 서버 생성 (Socket.io를 위해 필요)
const server = http.createServer(app);

// ================================
// 미들웨어 설정
// ================================

// CORS 설정 - 프론트엔드에서 API 호출 허용
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// JSON 바디 파싱
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙 (프론트엔드 HTML/CSS/JS)
app.use(express.static(path.join(__dirname, '../public')));

// 업로드 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ================================
// API 라우트 등록
// ================================
app.use('/api/auth', authRoutes);           // 인증 (회원가입, 로그인)
app.use('/api/workouts', workoutRoutes);    // 운동 기록 CRUD
app.use('/api/game', gameRoutes);           // 게임 시스템 (레벨, 티어, 업적)
app.use('/api/ranking', rankingRoutes);     // 랭킹 시스템
app.use('/api/ai', aiRoutes);              // AI 분석 및 추천
app.use('/api/users', userRoutes);          // 유저 프로필, 친구

// ================================
// SPA 폴백 라우팅
// 모든 미정의 GET 요청은 index.html로 보냄
// ================================
app.get('*', (req, res) => {
  // API 요청이 아닌 경우에만 index.html 반환
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// ================================
// 전역 에러 핸들러
// ================================
app.use((err, req, res, next) => {
  console.error('서버 에러:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ================================
// Socket.io 초기화
// ================================
socketHandler(server);

// ================================
// 서버 시작
// ================================
const PORT = process.env.PORT || 3000;

// MongoDB 연결 후 서버 시작
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log('=====================================');
    console.log('🎮 FitGame 서버가 시작되었습니다!');
    console.log(`📡 포트: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔧 환경: ${process.env.NODE_ENV}`);
    console.log('=====================================');
  });
}).catch(err => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});

module.exports = { app, server };
