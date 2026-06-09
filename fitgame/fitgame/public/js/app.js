// =====================================================
// app.js - SPA 라우터, 페이지 전환, 이벤트 연결 수정본
// =====================================================

const App = (() => {
  let currentPage = null;
  let navBound = false;
  let globalBound = false;

  async function init() {
    bindNavEvents();
    bindGlobalEvents();

    const token = localStorage.getItem('fitgame_token');
    if (!token) {
      window.initAuth?.();
      hideLoading();
      return;
    }

    try {
      const me = await api.auth.me();
      localStorage.setItem('fitgame_user', JSON.stringify(me.user));
      window.showApp?.(me.user);
      await navigateTo('dashboard', true);
    } catch (e) {
      localStorage.removeItem('fitgame_token');
      localStorage.removeItem('fitgame_user');
      window.initAuth?.();
      hideLoading();
    }
  }

  function bindNavEvents() {
    if (navBound) return;
    navBound = true;

    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(el.dataset.page, true);
      });
    });
  }

  async function navigateTo(page, force = false) {
    if (!force && currentPage === page) return;
    currentPage = page;

    document.querySelectorAll('.page').forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('active');
    });

    const section = document.getElementById(`page-${page}`);
    if (section) {
      section.classList.remove('hidden');
      section.classList.add('active');
    }

    document.querySelectorAll('[data-page]').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

    try {
      if (page === 'dashboard') await window.GamePage?.loadDashboard?.();
      if (page === 'workout') await window.WorkoutPage?.init?.();
      if (page === 'stats') await window.StatsPage?.init?.();
      if (page === 'ranking') await window.GamePage?.loadRankingPage?.();
      if (page === 'battle') await window.GamePage?.loadBattlePage?.();
      if (page === 'achievements') await window.GamePage?.loadAchievementsPage?.();
      if (page === 'ai') await window.AIPage?.init?.();
      if (page === 'profile') await window.GamePage?.loadProfilePage?.();
    } catch (e) {
      console.error(`[App] 페이지 로드 오류 (${page}):`, e);
    }
  }

  function bindGlobalEvents() {
    if (globalBound) return;
    globalBound = true;

    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      if (!confirm('로그아웃 하시겠습니까?')) return;
      window.SocketManager?.disconnect?.();
      localStorage.removeItem('fitgame_token');
      localStorage.removeItem('fitgame_user');
      location.reload();
    });
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  return { init, navigateTo };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;