/**
 * 랭킹 라우터
 * 전체 랭킹, 주간 랭킹, 친구 랭킹 API
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ================================
// GET /api/ranking/global - 전체 랭킹 (총 점수 기준)
// ================================
router.get('/global', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const users = await User.find({})
      .select('nickname profileImage gameStats.totalScore gameStats.level gameStats.tier gameStats.battleWins streakDays')
      .sort({ 'gameStats.totalScore': -1 })
      .limit(Number(limit));

    const rankings = users.map((user, idx) => ({
      rank: idx + 1,
      userId: user._id,
      nickname: user.nickname,
      profileImage: user.profileImage,
      totalScore: user.gameStats.totalScore,
      level: user.gameStats.level,
      tier: user.gameStats.tier,
      battleWins: user.gameStats.battleWins,
      streakDays: user.streakDays,
      isMe: user._id.toString() === req.user._id.toString()
    }));

    // 내 순위 찾기
    const myRank = rankings.findIndex(r => r.isMe) + 1;

    res.json({ success: true, rankings, myRank });

  } catch (error) {
    res.status(500).json({ success: false, message: '전체 랭킹 조회 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/ranking/weekly - 주간 랭킹
// ================================
router.get('/weekly', async (req, res) => {
  try {
    const users = await User.find({})
      .select('nickname profileImage gameStats.weeklyScore gameStats.level gameStats.tier')
      .sort({ 'gameStats.weeklyScore': -1 })
      .limit(50);

    const rankings = users.map((user, idx) => ({
      rank: idx + 1,
      userId: user._id,
      nickname: user.nickname,
      profileImage: user.profileImage,
      weeklyScore: user.gameStats.weeklyScore,
      level: user.gameStats.level,
      tier: user.gameStats.tier,
      isMe: user._id.toString() === req.user._id.toString()
    }));

    res.json({ success: true, rankings });

  } catch (error) {
    res.status(500).json({ success: false, message: '주간 랭킹 조회 중 오류가 발생했습니다.' });
  }
});

// ================================
// GET /api/ranking/friends - 친구 랭킹
// ================================
router.get('/friends', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'friends',
      select: 'nickname profileImage gameStats.weeklyScore gameStats.totalScore gameStats.level gameStats.tier'
    });

    // 내 정보 포함
    const allUsers = [
      {
        userId: user._id,
        nickname: user.nickname,
        profileImage: user.profileImage,
        weeklyScore: user.gameStats.weeklyScore,
        totalScore: user.gameStats.totalScore,
        level: user.gameStats.level,
        tier: user.gameStats.tier,
        isMe: true
      },
      ...user.friends.map(f => ({
        userId: f._id,
        nickname: f.nickname,
        profileImage: f.profileImage,
        weeklyScore: f.gameStats.weeklyScore,
        totalScore: f.gameStats.totalScore,
        level: f.gameStats.level,
        tier: f.gameStats.tier,
        isMe: false
      }))
    ];

    // 주간 점수 기준 정렬
    allUsers.sort((a, b) => b.weeklyScore - a.weeklyScore);
    const rankings = allUsers.map((u, idx) => ({ rank: idx + 1, ...u }));

    res.json({ success: true, rankings });

  } catch (error) {
    res.status(500).json({ success: false, message: '친구 랭킹 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
