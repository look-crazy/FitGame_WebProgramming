// =====================================================
// socket.js - Socket.io 클라이언트 연결, 실시간 피드
// =====================================================

const SocketManager = (() => {
  let socket = null;
  let reconnectTimer = null;

  function connect(token) {
    if (socket?.connected) return;

    socket = io({ auth: { token } });

    socket.on('connect', () => {
      console.log('[Socket] 연결됨:', socket.id);
      clearTimeout(reconnectTimer);
      appendFeedItem('🔗 실시간 서버에 연결되었습니다.', 'system');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] 연결 해제:', reason);
      if (reason !== 'io client disconnect') {
        reconnectTimer = setTimeout(() => {
          const t = localStorage.getItem('token');
          if (t) connect(t);
        }, 5000);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] 연결 오류:', err.message);
    });

    // ── 게임 이벤트 ──────────────────────────────────
    socket.on('levelUp', (data) => {
      showLevelUpOverlay(data.newLevel);
      appendFeedItem(`🎉 레벨 업! Lv.${data.newLevel} 달성!`, 'levelup');
    });

    socket.on('achievementUnlocked', (data) => {
      showToast(`🏆 업적 달성: ${data.name}`, 'success');
      appendFeedItem(`🏆 새 업적 달성: ${data.name}`, 'achievement');
    });

    socket.on('workoutAdded', (data) => {
      appendFeedItem(`💪 ${data.username}님이 ${data.workoutName} 완료! +${data.score}pts`, 'workout');
    });

    socket.on('rankingUpdate', (data) => {
      // 랭킹 페이지가 열려 있으면 갱신
      if (window.RankingPage?.refresh) window.RankingPage.refresh(data);
    });

    socket.on('battleResult', (data) => {
      const resultText = data.result === 'win' ? '승리' : '패배';
      showToast(`⚔️ 배틀 ${resultText}! ${data.opponentName}과의 대결`, data.result === 'win' ? 'success' : 'error');
      appendFeedItem(`⚔️ 배틀 ${resultText} vs ${data.opponentName}`, data.result === 'win' ? 'win' : 'loss');
    });

    socket.on('friendActivity', (data) => {
      appendFeedItem(`👥 ${data.username}님: ${data.message}`, 'friend');
    });
  }

  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  // ── 실시간 피드 UI ───────────────────────────────────
  function appendFeedItem(message, type = 'info') {
    const feed = document.getElementById('realtimeFeed');
    if (!feed) return;

    const icons = {
      system: '🔗', levelup: '🎉', achievement: '🏆',
      workout: '💪', win: '⚔️', loss: '😤', friend: '👥', info: 'ℹ️',
    };

    const colors = {
      system: '#a0aec0', levelup: '#ffd700', achievement: '#ffd700',
      workout: '#00d4ff', win: '#00ff88', loss: '#ff4757', friend: '#7c3aed', info: '#a0aec0',
    };

    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    const item = document.createElement('div');
    item.className = 'feed-item';
    item.style.cssText = `
      padding: 8px 12px;
      border-left: 3px solid ${colors[type] || '#a0aec0'};
      margin-bottom: 8px;
      font-size: 0.85rem;
      color: var(--text-secondary);
      animation: slideInRight 0.3s ease;
    `;
    item.innerHTML = `<span style="color:${colors[type]}">${message}</span> <span style="color:var(--text-muted);font-size:0.75rem">${now}</span>`;

    feed.insertBefore(item, feed.firstChild);

    // 최대 20개 유지
    while (feed.children.length > 20) feed.removeChild(feed.lastChild);
  }

  // ── 레벨업 오버레이 ──────────────────────────────────
  function showLevelUpOverlay(level) {
    const overlay = document.getElementById('levelUpOverlay');
    if (!overlay) return;

    overlay.querySelector('.levelup-number').textContent = level;
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => { overlay.style.display = 'none'; }, 500);
    }, 3500);

    // 대시보드 갱신
    if (window.GamePage?.loadDashboard) window.GamePage.loadDashboard();
  }

  function getSocket() { return socket; }

  return { connect, disconnect, appendFeedItem, getSocket };
})();

window.SocketManager = SocketManager;
