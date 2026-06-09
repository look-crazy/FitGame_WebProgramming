/**
 * 인증 라우터
 * 회원가입, 로그인, 닉네임 중복 검사 API
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// ================================
// 프로필 이미지 업로드 설정 (Multer)
// ================================
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const isValid = allowed.test(path.extname(file.originalname).toLowerCase());
    isValid ? cb(null, true) : cb(new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

// ================================
// JWT 토큰 생성 헬퍼 함수
// ================================
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ================================
// POST /api/auth/register - 회원가입
// ================================
router.post('/register',
  upload.single('profileImage'), // 프로필 이미지 (선택)
  [
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
    body('nickname').isLength({ min: 2, max: 15 }).withMessage('닉네임은 2~15자 사이여야 합니다.')
      .matches(/^[가-힣a-zA-Z0-9_]+$/).withMessage('닉네임은 한글, 영문, 숫자, _만 사용 가능합니다.')
  ],
  async (req, res) => {
    try {
      // 유효성 검사 에러 확인
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { email, password, nickname } = req.body;

      // 이메일/닉네임 중복 검사
      const existingUser = await User.findOne({
        $or: [{ email }, { nickname }]
      });

      if (existingUser) {
        const field = existingUser.email === email ? '이메일' : '닉네임';
        return res.status(409).json({
          success: false,
          message: `이미 사용 중인 ${field}입니다.`
        });
      }

      // 사용자 생성
      const user = new User({
        email,
        password,
        nickname,
        profileImage: req.file ? `/uploads/${req.file.filename}` : null
      });

      await user.save();

      // JWT 토큰 발급
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: '🎮 FitGame에 오신 것을 환영합니다!',
        token,
        user: user.toSafeObject()
      });

    } catch (error) {
      console.error('회원가입 에러:', error);
      res.status(500).json({
        success: false,
        message: '회원가입 처리 중 오류가 발생했습니다.'
      });
    }
  }
);

// ================================
// POST /api/auth/login - 로그인
// ================================
router.post('/login',
  [
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다.'),
    body('password').notEmpty().withMessage('비밀번호를 입력해주세요.')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const { email, password } = req.body;

      // 사용자 조회 (비밀번호 포함)
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.'
        });
      }

      // 비밀번호 검증
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.'
        });
      }

      // 마지막 로그인 갱신
      user.lastLoginAt = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        success: true,
        message: '로그인 성공! 오늘도 파이팅! 💪',
        token,
        user: user.toSafeObject()
      });

    } catch (error) {
      console.error('로그인 에러:', error);
      res.status(500).json({
        success: false,
        message: '로그인 처리 중 오류가 발생했습니다.'
      });
    }
  }
);

// ================================
// GET /api/auth/check-nickname?nickname=xxx - 닉네임 중복 검사
// ================================
router.get('/check-nickname', async (req, res) => {
  try {
    const { nickname } = req.query;

    if (!nickname || nickname.length < 2 || nickname.length > 15) {
      return res.status(400).json({
        success: false,
        message: '닉네임은 2~15자 사이여야 합니다.'
      });
    }

    const existing = await User.findOne({ nickname });

    res.json({
      success: true,
      available: !existing,
      message: existing ? '이미 사용 중인 닉네임입니다.' : '사용 가능한 닉네임입니다.'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ================================
// GET /api/auth/me - 현재 로그인된 유저 정보
// ================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // authMiddleware에서 이미 user를 req에 첨부함
    res.json({
      success: true,
      user: req.user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// ================================
// PUT /api/auth/profile - 프로필 수정
// ================================
router.put('/profile', authMiddleware, upload.single('profileImage'), async (req, res) => {
  try {
    const { nickname } = req.body;
    const updates = {};

    if (nickname) {
      // 닉네임 중복 검사 (자기 자신 제외)
      const existing = await User.findOne({ nickname, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: '이미 사용 중인 닉네임입니다.' });
      }
      updates.nickname = nickname;
    }

    if (req.file) {
      updates.profileImage = `/uploads/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, select: '-password' }
    );

    res.json({ success: true, message: '프로필이 업데이트되었습니다.', user });

  } catch (error) {
    res.status(500).json({ success: false, message: '프로필 수정 중 오류 발생' });
  }
});

module.exports = router;
