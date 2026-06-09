/**
 * 게임 시스템 모듈
 * 대시보드, 레벨/티어/EXP UI, 업적, 미션 처리
 */

// 티어별 색상 (CSS 변수와 동일)
const TIER_COLORS = {
  'BRONZE': '#CD7F32',
  'SILVER': '#C0C0C0',
  'GOLD': '#FFD700',
  'PLATINUM': '#00CED1',
  'DIAMOND': '#00BFFF'
};

/**
 * 대시보드 전체 로드
 */
const loadDashboard = async () => {
  try {
    const statusData = await api.game.status();

    const gameStatus = statusData?.gameStatus || {};
    updateDashboardUI(gameStatus);

    // AI 피드백과 랭킹은 대시보드 핵심 로딩과 분리합니다.
    // 이 부가 기능이 실패해도 대시보드 전체 오류 토스트가 뜨지 않게 합니다.
    if (typeof window.loadAIFeedbackCard === 'function') {
      window.loadAIFeedbackCard().catch?.(err => {
        console.warn('AI 피드백 로드 실패:', err);
      });
    }

    loadRealtimeRanking().catch?.(err => {
      console.warn('랭킹 로드 실패:', err);
    });

  } catch (error) {
    console.error('대시보드 로드 에러:', error);
    showToast('대시보드 로딩 중 오류가 발생했습니다.', 'error');
  }
};

/**
 * 대시보드 UI 업데이트
 */
const updateDashboardUI = (gameStatus = {}) => {
  const tierObj = typeof gameStatus.tier === 'object' && gameStatus.tier !== null
    ? gameStatus.tier
    : { name: gameStatus.tier || 'BRONZE', nameKo: '브론즈' };

  const level = Number(gameStatus.level) || 1;
  const weeklyScore = Number(gameStatus.weeklyScore) || 0;
  const streakDays = Number(gameStatus.streakDays) || 0;
  const todayWorkouts = Number(gameStatus.todayWorkouts) || 0;
  const totalExp = Number(gameStatus.totalExp) || 0;
  const nextLevelExp = Number(gameStatus.nextLevelExp) || 100;
  const expPercent = Number(gameStatus.expPercent) || 0;

  // 스탯 카드
  setTextContent('dashLevel', level);
  setTextContent('dashTier', tierObj.nameKo || tierObj.name || '브론즈');
  setTextContent('dashWeeklyScore', weeklyScore.toLocaleString());
  setTextContent('dashStreak', streakDays);
  setTextContent('dashTodayWorkouts', todayWorkouts);

  // 티어 배지 색상
  const tierBadge = document.getElementById('dashTier');
  if (tierBadge) {
    tierBadge.textContent = tierObj.nameKo || tierObj.name || '브론즈';
    tierBadge.style.color = TIER_COLORS[tierObj.name] || '#00d4ff';
    tierBadge.style.borderColor = TIER_COLORS[tierObj.name] || '#00d4ff';
  }

  // EXP 바 업데이트 (애니메이션)
  setTextContent('expCurrent', totalExp.toLocaleString());
  setTextContent('expNext', nextLevelExp.toLocaleString());
  setTextContent('expPercent', `${expPercent}%`);

  const expBar = document.getElementById('expBarFill');
  if (expBar) {
    setTimeout(() => {
      expBar.style.width = `${expPercent}%`;
    }, 300);
  }

  // 인사말
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요!' : hour < 18 ? '오늘도 파이팅!' : '오늘 운동 완료했나요?';
  const user = window.currentUser?.();
  setTextContent('dashboardGreeting', `${user?.nickname || ''}님, ${greeting} 💪`);

  // 미션 렌더링
  if (gameStatus.missions) {
    renderMissions(gameStatus.missions);
  }

  // 배틀 페이지 스탯
  setTextContent('battleWins', gameStatus.battleWins || 0);
  setTextContent('battleLosses', gameStatus.battleLosses || 0);
  setTextContent('battlePoints', (gameStatus.points || 0).toLocaleString());

  // 프로필 페이지 스탯
  setTextContent('profileTotalScore', (gameStatus.totalScore || 0).toLocaleString());
  setTextContent('profileBattleWins', gameStatus.battleWins || 0);
  setTextContent('profileStreak', gameStatus.streakDays || 0);
};

/**
 * 미션 렌더링
 */
const renderMissions = (missions) => {
  const container = document.getElementById('missionsList');
  if (!container) return;

  container.innerHTML = missions.map(mission => {
    const percent = Math.min((mission.current / mission.target) * 100, 100);
    return `
      <div class="mission-item ${mission.completed ? 'completed' : ''}">
        <div class="mission-top">
          <span class="mission-name">
            ${mission.completed ? '✅' : '⬜'} ${mission.title}
          </span>
          <span class="mission-reward">+${mission.reward} EXP</span>
        </div>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.4rem">${mission.description}</p>
        <div class="mission-progress-bar">
          <div class="mission-progress-fill" style="width: ${percent}%"></div>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;text-align:right">
          ${mission.current} / ${mission.target}
        </div>
      </div>
    `;
  }).join('');
};

/**
 * 실시간 랭킹 로드 (Socket.io 또는 REST API)
 */
const loadRealtimeRanking = async () => {
  const container = document.getElementById('realtimeRanking');
  if (!container) return;

  try {
    const data = await api.ranking.weekly();
    renderRankingList(container, data.rankings.slice(0, 8), 'small');
  } catch (error) {
    if (container) container.innerHTML = '<div class="text-muted text-center">랭킹 로드 실패</div>';
  }
};

/**
 * 랭킹 리스트 렌더링
 * @param {HTMLElement} container - 컨테이너 엘리먼트
 * @param {Array} rankings - 랭킹 데이터
 * @param {string} size - 'small' | 'full'
 */
const renderRankingList = (container, rankings, size = 'full') => {
  if (!rankings || rankings.length === 0) {
    container.innerHTML = '<div class="text-muted text-center">랭킹 데이터 없음</div>';
    return;
  }

  const topClass = (rank) => rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
  const rankEmoji = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;

  if (size === 'small') {
    container.innerHTML = rankings.map(r => `
      <div class="ranking-item ${r.isMe ? 'is-me' : ''}">
        <span class="rank-number ${topClass(r.rank)}">${rankEmoji(r.rank)}</span>
        <div class="rank-avatar">
          ${r.profileImage ? `<img src="${r.profileImage}" alt="">` : r.nickname[0].toUpperCase()}
        </div>
        <div class="rank-info">
          <div class="rank-name">${r.nickname}${r.isMe ? ' (나)' : ''}</div>
          <div class="rank-tier" style="color:${TIER_COLORS[r.tier] || '#aaa'}">${r.tier} Lv.${r.level}</div>
        </div>
        <span class="rank-score">${(r.weeklyScore || r.totalScore || 0).toLocaleString()}</span>
      </div>
    `).join('');
  } else {
    container.innerHTML = rankings.map(r => `
      <div class="ranking-full-item ${r.isMe ? 'is-me' : ''}">
        <span class="rank-number ${topClass(r.rank)}">${rankEmoji(r.rank)}</span>
        <div class="rank-avatar">
          ${r.profileImage ? `<img src="${r.profileImage}" alt="">` : r.nickname[0].toUpperCase()}
        </div>
        <div class="rank-info">
          <div class="rank-name">${r.nickname}${r.isMe ? ' 👈 나' : ''}</div>
          <div class="rank-tier" style="color:${TIER_COLORS[r.tier] || '#aaa'}">${r.tier} Lv.${r.level}</div>
        </div>
        <div style="text-align:right">
          <div class="rank-score">${(r.weeklyScore || r.totalScore || 0).toLocaleString()}점</div>
          ${r.streakDays ? `<div style="font-size:0.75rem;color:var(--text-muted)">🔥 ${r.streakDays}일 연속</div>` : ''}
        </div>
      </div>
    `).join('');
  }
};

/**
 * 레벨업 애니메이션 표시
 */
const showLevelUpAnimation = (newLevel) => {
  const overlay = document.getElementById('levelUpOverlay');
  const levelText = document.getElementById('levelUpNewLevel');

  if (!overlay) return;

  if (levelText) levelText.textContent = `Lv. ${newLevel}`;
  overlay.classList.remove('hidden');

  // 3초 후 자동 닫기
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 3000);

  // 클릭으로 닫기
  overlay.onclick = () => overlay.classList.add('hidden');
};

/**
 * 업적 달성 알림
 */
const showAchievementUnlocked = (achievement) => {
  showToast(`🎖️ 업적 달성! "${achievement.title}" +${achievement.points} 포인트`, 'success', 5000);
};

/**
 * 업적 페이지 로드
 */
const loadAchievements = async () => {
  const container = document.getElementById('achievementGrid');
  const progressEl = document.getElementById('achievementProgress');
  if (!container) return;

  try {
    const data = await api.game.achievements();

    if (progressEl) {
      progressEl.textContent = `${data.unlockedCount} / ${data.totalCount} 달성`;
    }

    container.innerHTML = data.achievements.map(a => `
      <div class="achievement-card ${a.unlocked ? 'unlocked' : 'achievement-locked'}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-title">${a.title}</div>
        <div class="achievement-desc">${a.description}</div>
        <div class="achievement-points">+${a.points} 포인트</div>
        ${a.unlocked
          ? `<div style="font-size:0.75rem;color:var(--neon-green);margin-top:0.4rem">✅ ${new Date(a.unlockedAt).toLocaleDateString()}</div>`
          : '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem">🔒 미달성</div>'
        }
      </div>
    `).join('');

  } catch (error) {
    container.innerHTML = '<div class="skeleton-loading">업적 로드 실패</div>';
  }
};

/**
 * 랭킹 페이지 로드
 */
const loadRankingPage = async (type = 'weekly') => {
  const container = document.getElementById('rankingList');
  if (!container) return;

  container.innerHTML = '<div class="skeleton-loading">로딩 중...</div>';

  try {
    let data;
    if (type === 'weekly') data = await api.ranking.weekly();
    else if (type === 'global') data = await api.ranking.global();
    else data = await api.ranking.friends();

    renderRankingList(container, data.rankings, 'full');

  } catch (error) {
    container.innerHTML = '<div class="skeleton-loading">랭킹 로드 실패</div>';
  }
};

/**
 * 프로필 페이지 로드
 */
const loadProfilePage = async () => {
  const user = window.currentUser?.();
  if (!user) return;

  setTextContent('profileName', user.nickname);
  setTextContent('profileLevel', `Lv. ${user.gameStats.level}`);

  const tierBadge = document.getElementById('profileTierBadge');
  if (tierBadge) {
    tierBadge.textContent = user.gameStats.tier;
    tierBadge.style.color = TIER_COLORS[user.gameStats.tier] || '#00d4ff';
    tierBadge.style.borderColor = TIER_COLORS[user.gameStats.tier] || '#00d4ff';
  }

  const avatar = document.getElementById('profileAvatarLarge');
  if (avatar) {
    if (user.profileImage) {
      avatar.innerHTML = `<img src="${user.profileImage}" alt="프로필">`;
    } else {
      avatar.textContent = user.nickname[0].toUpperCase();
    }
  }

  // 게임 스탯 불러오기
  try {
    const statusData = await api.game.status();
    const { gameStatus } = statusData;
    setTextContent('profileTotalScore', (gameStatus.totalScore || 0).toLocaleString());
    setTextContent('profileBattleWins', gameStatus.battleWins || 0);
    setTextContent('profileStreak', gameStatus.streakDays || 0);
  } catch (e) {
    console.warn('프로필 스탯 로드 실패:', e);
  }

  // 프로필 수정 폼
  const editNickname = document.getElementById('editNickname');
  if (editNickname) editNickname.value = user.nickname;
};

/**
 * 프로필 수정 폼 제출
 */
const initProfileEdit = () => {
  document.getElementById('profileEditForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();

    const nickname = document.getElementById('editNickname')?.value.trim();
    const imageFile = document.getElementById('editProfileImage')?.files[0];

    if (nickname) formData.append('nickname', nickname);
    if (imageFile) formData.append('profileImage', imageFile);

    try {
      const data = await api.auth.updateProfile(formData);
      // 로컬 유저 정보 업데이트
      localStorage.setItem('fitgame_user', JSON.stringify(data.user));
      updateSidebarProfile(data.user);
      showToast('프로필이 업데이트되었습니다!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
};

// ================================
// 헬퍼: 텍스트 컨텐츠 설정 (null 안전)
// ================================
const setTextContent = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// 전역 노출
window.loadDashboard = loadDashboard;
window.loadAchievements = loadAchievements;
window.loadRankingPage = loadRankingPage;
window.loadProfilePage = loadProfilePage;
window.showLevelUpAnimation = showLevelUpAnimation;
window.showAchievementUnlocked = showAchievementUnlocked;
window.renderRankingList = renderRankingList;
window.TIER_COLORS = TIER_COLORS;

// 프로필 수정 초기화 (DOMContentLoaded 후)
document.addEventListener('DOMContentLoaded', initProfileEdit);

// =====================================================
// GamePage 객체 및 상세 버튼 이벤트 보강
// =====================================================
let __gameEventsBound = false;

const loadAchievementsPage = async () => loadAchievements();

const loadBattlePage = async () => {
  try {
    const statusData = await api.game.status();
    updateDashboardUI(statusData.gameStatus || {});
  } catch (e) {
    console.warn('배틀 스탯 로드 실패:', e);
  }
  bindGameDetailEventsOnce();
};

function bindGameDetailEventsOnce() {
  if (__gameEventsBound) return;
  __gameEventsBound = true;

  document.querySelectorAll('.ranking-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.ranking-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await loadRankingPage(btn.dataset.type || 'weekly');
    });
  });

  document.getElementById('battleSearchBtn')?.addEventListener('click', searchBattleOpponent);
  document.getElementById('battleSearchInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBattleOpponent();
  });
}

async function searchBattleOpponent() {
  const input = document.getElementById('battleSearchInput');
  const results = document.getElementById('battleSearchResults');
  const q = input?.value.trim();
  if (!results) return;
  if (!q) {
    showToast('검색할 닉네임을 입력해주세요.', 'warning');
    return;
  }

  results.innerHTML = '<div class="skeleton-loading">검색 중...</div>';
  try {
    const data = await api.user.search(q);
    const users = data.users || [];
    if (!users.length) {
      results.innerHTML = '<div class="text-muted text-center">검색 결과가 없습니다.</div>';
      return;
    }

    results.innerHTML = users.map(u => `
      <div class="ranking-full-item">
        <div class="rank-avatar">${u.profileImage ? `<img src="${u.profileImage}" alt="">` : (u.nickname?.[0] || '?').toUpperCase()}</div>
        <div class="rank-info">
          <div class="rank-name">${u.nickname}</div>
          <div class="rank-tier">${u.gameStats?.tier || 'BRONZE'} Lv.${u.gameStats?.level || 1}</div>
        </div>
        <button class="btn-primary btn-sm battle-challenge-btn" data-id="${u._id}">배틀 신청</button>
      </div>`).join('');

    results.querySelectorAll('.battle-challenge-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.game.battle(btn.dataset.id);
          showToast('배틀 신청이 완료되었습니다.', 'success');
        } catch (e) {
          showToast(e.message || '배틀 신청 실패', 'error');
        }
      });
    });
  } catch (e) {
    results.innerHTML = '<div class="text-muted text-center">검색 실패</div>';
  }
}

window.GamePage = {
  loadDashboard,
  loadRankingPage: async (type = 'weekly') => { bindGameDetailEventsOnce(); return loadRankingPage(type); },
  loadBattlePage,
  loadAchievementsPage,
  loadProfilePage,
  showLevelUpAnimation,
  showAchievementUnlocked
};
