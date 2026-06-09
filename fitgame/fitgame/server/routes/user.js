/**
 * 유저 라우터
 * 프로필 조회, 친구 관리 API
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/users/search?q=nickname - 유저 검색
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, message: '검색어는 2자 이상이어야 합니다.' });
    }

    const users = await User.find({
      nickname: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id }
    })
    .select('nickname profileImage gameStats.level gameStats.tier')
    .limit(10);

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: '사용자 검색 중 오류가 발생했습니다.' });
  }
});

// GET /api/users/:id - 유저 프로필 조회
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -friendRequests')
      .populate('friends', 'nickname profileImage gameStats.level gameStats.tier');

    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const isFriend = req.user.friends.includes(req.params.id);

    res.json({
      success: true,
      user: { ...user.toSafeObject(), isFriend }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

// POST /api/users/:id/friend-request - 친구 신청
router.post('/:id/friend-request', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: '자기 자신에게 친구 신청할 수 없습니다.' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    // 이미 친구인지 확인
    if (req.user.friends.includes(targetId)) {
      return res.status(400).json({ success: false, message: '이미 친구입니다.' });
    }

    // 이미 신청한지 확인
    const alreadyRequested = target.friendRequests.some(r => r.from.toString() === req.user._id.toString());
    if (alreadyRequested) {
      return res.status(400).json({ success: false, message: '이미 친구 신청을 보냈습니다.' });
    }

    target.friendRequests.push({ from: req.user._id });
    await target.save();

    res.json({ success: true, message: '친구 신청을 보냈습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '친구 신청 중 오류가 발생했습니다.' });
  }
});

// POST /api/users/friend-request/accept/:requesterId - 친구 신청 수락
router.post('/friend-request/accept/:requesterId', async (req, res) => {
  try {
    const requesterId = req.params.requesterId;
    const user = await User.findById(req.user._id);

    const requestIdx = user.friendRequests.findIndex(r => r.from.toString() === requesterId);
    if (requestIdx === -1) {
      return res.status(404).json({ success: false, message: '친구 신청을 찾을 수 없습니다.' });
    }

    // 서로 친구 추가
    user.friends.push(requesterId);
    user.friendRequests.splice(requestIdx, 1);
    await user.save();

    await User.findByIdAndUpdate(requesterId, { $addToSet: { friends: req.user._id } });

    res.json({ success: true, message: '친구 신청을 수락했습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '친구 신청 수락 중 오류가 발생했습니다.' });
  }
});

// GET /api/users/me/friends - 내 친구 목록
router.get('/me/friends', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'friends',
      'nickname profileImage gameStats.level gameStats.tier gameStats.weeklyScore lastWorkoutAt'
    );
    res.json({ success: true, friends: user.friends });
  } catch (error) {
    res.status(500).json({ success: false, message: '친구 목록 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
