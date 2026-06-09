/**
 * Socket.io 핸들러
 * 실시간 랭킹 업데이트, 운동 완료 알림, 배틀 알림
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null; // 싱글톤 io 인스턴스

/**
 * Socket.io 초기화 및 이벤트 등록
 * @param {http.Server} server - HTTP 서버 인스턴스
 */
const socketHandler = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // ================================
  // JWT 인증 미들웨어 (Socket.io용)
  // ================================
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        // 인증 없이도 랭킹 수신은 가능 (읽기 전용)
        socket.userId = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');

      if (user) {
        socket.userId = user._id.toString();
        socket.userNickname = user.nickname;
      }

      next();
    } catch (error) {
      // 토큰 에러는 무시하고 익명으로 연결
      socket.userId = null;
      next();
    }
  });

  // ================================
  // 연결 이벤트
  // ================================
  io.on('connection', (socket) => {
    console.log(`🔌 Socket 연결: ${socket.id} (유저: ${socket.userNickname || '익명'})`);

    // 인증된 유저는 개인 룸에 조인 (개인 알림 수신용)
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ================================
    // 랭킹 요청 이벤트
    // ================================
    socket.on('request_ranking', async () => {
      try {
        const users = await User.find({})
          .select('nickname profileImage gameStats.weeklyScore gameStats.level gameStats.tier')
          .sort({ 'gameStats.weeklyScore': -1 })
          .limit(10);

        const ranking = users.map((u, idx) => ({
          rank: idx + 1,
          nickname: u.nickname,
          profileImage: u.profileImage,
          weeklyScore: u.gameStats.weeklyScore,
          level: u.gameStats.level,
          tier: u.gameStats.tier,
          isMe: socket.userId && u._id.toString() === socket.userId
        }));

        socket.emit('ranking_data', ranking);
      } catch (error) {
        socket.emit('error', { message: '랭킹 조회 실패' });
      }
    });

    // ================================
    // 연결 해제
    // ================================
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket 연결 해제: ${socket.id} (이유: ${reason})`);
    });
  });

  console.log('✅ Socket.io 초기화 완료');
  return io;
};

/**
 * io 인스턴스 반환 (다른 모듈에서 사용)
 */
const getIO = () => io;

/**
 * 특정 유저에게 개인 알림 전송
 */
const sendToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * 전체 유저에게 브로드캐스트
 */
const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = socketHandler;
module.exports.getIO = getIO;
module.exports.sendToUser = sendToUser;
module.exports.broadcast = broadcast;
