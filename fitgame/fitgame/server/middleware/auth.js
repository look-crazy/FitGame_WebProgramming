/**
 * JWT 인증 미들웨어
 * API 요청 시 토큰을 검증하여 사용자를 인증합니다.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 인증 필수 미들웨어
 * Authorization 헤더의 Bearer 토큰을 검증합니다.
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 없습니다. 로그인이 필요합니다.'
      });
    }

    // "Bearer <token>" 형태에서 토큰만 추출
    const token = authHeader.split(' ')[1];

    // 2. 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. DB에서 사용자 조회 (탈퇴한 유저 등 체크)
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다. 다시 로그인해주세요.'
      });
    }

    // 4. request 객체에 사용자 정보 첨부
    req.user = user;
    next();

  } catch (error) {
    // 토큰 만료
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
      });
    }

    // 유효하지 않은 토큰
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰 형식입니다.'
      });
    }

    console.error('인증 미들웨어 에러:', error);
    res.status(500).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 검증하고 없어도 통과
 * (로그인 여부에 따라 다른 데이터를 보여줄 때 사용)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      req.user = user;
    }

    next();
  } catch (error) {
    // 토큰 에러가 있어도 통과 (선택적 인증)
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };
