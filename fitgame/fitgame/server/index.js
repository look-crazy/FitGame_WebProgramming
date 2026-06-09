/**
 * FitGame - 메인 서버 진입점
 * Express + Socket.io + MongoDB 통합 서버
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const connectDB = require('./config/database');

const authRoutes = require('./routes/auth');
const workoutRoutes = require('./routes/workout');
const gameRoutes = require('./routes/game');
const rankingRoutes = require('./routes/ranking');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');

const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// CORS 설정
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// JSON 바디 파싱
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, '../public')));

// 업로드 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);

// SPA 폴백 라우팅
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 에러:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;

// Vercel에서도 DB 연결 시도
connectDB()
  .then(() => {
    console.log('MongoDB 연결 완료');
  })
  .catch(err => {
    console.error('MongoDB 연결 실패:', err);
  });

// 로컬에서만 Socket.io + listen 실행
if (process.env.NODE_ENV !== 'production') {
  socketHandler(server);

  server.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
  });
}

module.exports = app;