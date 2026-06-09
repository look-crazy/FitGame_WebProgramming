/**
 * FitGame - 메인 서버 진입점
 * Express + Socket.io + MongoDB 통합 서버
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

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

// ================================
// DB 연결 확인 미들웨어
// API 요청이 들어올 때 MongoDB 연결을 먼저 확인
// ================================
const ensureDBConnected = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    next();
  } catch (err) {
    console.error('API 요청 전 MongoDB 연결 실패:', err);

    return res.status(500).json({
      success: false,
      message: 'MongoDB 연결 실패',
      error: err.message
    });
  }
};

// API 라우트
app.use('/api/auth', ensureDBConnected, authRoutes);
app.use('/api/workouts', ensureDBConnected, workoutRoutes);
app.use('/api/game', ensureDBConnected, gameRoutes);
app.use('/api/ranking', ensureDBConnected, rankingRoutes);
app.use('/api/ai', ensureDBConnected, aiRoutes);
app.use('/api/users', ensureDBConnected, userRoutes);

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

// 로컬에서만 Socket.io + listen 실행
if (process.env.NODE_ENV !== 'production') {
  socketHandler(server);

  server.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
  });
}

// Vercel에서는 app만 export
module.exports = app;