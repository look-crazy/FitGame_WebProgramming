/**
 * API 유틸리티 모듈
 * 모든 HTTP 요청을 처리하는 중앙 API 클라이언트
 * fetch + async/await 사용
 */

const API_BASE = '/api';

/**
 * 로컬스토리지에서 JWT 토큰 가져오기
 */
const getToken = () => localStorage.getItem('fitgame_token');

/**
 * 인증 헤더 생성
 */
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {})
});

/**
 * 핵심 API 요청 함수
 * @param {string} endpoint - API 엔드포인트 경로
 * @param {object} options - fetch 옵션
 * @returns {Promise<object>} - 응답 데이터
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    const url = `${API_BASE}${endpoint}`;

    const config = {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {})
      }
    };

    // FormData는 Content-Type 헤더 자동 설정 (boundary 포함)
    if (config.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const response = await fetch(url, config);
    const data = await response.json();

    // 401 토큰 만료 처리
    if (response.status === 401) {
      localStorage.removeItem('fitgame_token');
      localStorage.removeItem('fitgame_user');
      if (!window.location.pathname.includes('login')) {
        showAuth(); // 인증 화면으로 이동
      }
      throw new Error(data.message || '인증이 만료되었습니다.');
    }

    if (!response.ok) {
      throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
    }

    return data;

  } catch (error) {
    console.error(`API 에러 [${endpoint}]:`, error.message);
    throw error;
  }
};

// ================================
// API 메서드들
// ================================

const api = {
  // ---- 인증 ----
  auth: {
    login: (email, password) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),

    register: (formData) =>
      apiRequest('/auth/register', {
        method: 'POST',
        body: formData // FormData (이미지 포함)
      }),

    checkNickname: (nickname) =>
      apiRequest(`/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`),

    me: () => apiRequest('/auth/me'),

    updateProfile: (formData) =>
      apiRequest('/auth/profile', {
        method: 'PUT',
        body: formData
      })
  },

  // ---- 운동 기록 ----
  workout: {
    create: (workoutData) =>
      apiRequest('/workouts', {
        method: 'POST',
        body: JSON.stringify(workoutData)
      }),

    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/workouts${query ? '?' + query : ''}`);
    },

    calendar: (year, month) =>
      apiRequest(`/workouts/calendar?year=${year}&month=${month}`),

    stats: (period = 'week') =>
      apiRequest(`/workouts/stats?period=${period}`),

    update: (id, workoutData) =>
      apiRequest(`/workouts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(workoutData)
      }),

    delete: (id) =>
      apiRequest(`/workouts/${id}`, { method: 'DELETE' })
  },

  // ---- 게임 시스템 ----
  game: {
    status: () => apiRequest('/game/status'),
    achievements: () => apiRequest('/game/achievements'),
    tiers: () => apiRequest('/game/tiers'),
    battle: (opponentId) =>
      apiRequest('/game/battle/challenge', {
        method: 'POST',
        body: JSON.stringify({ opponentId })
      })
  },

  // ---- 랭킹 ----
  ranking: {
    weekly: () => apiRequest('/ranking/weekly'),
    global: () => apiRequest('/ranking/global'),
    friends: () => apiRequest('/ranking/friends')
  },

  // ---- AI ----
  ai: {
    analyze: () =>
      apiRequest('/ai/analyze', { method: 'POST', body: JSON.stringify({}) }),
    routine: (goal, daysPerWeek) =>
      apiRequest('/ai/routine', {
        method: 'POST',
        body: JSON.stringify({ goal, daysPerWeek })
      }),
    chat: (payload) =>
      apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
  },

  // ---- 유저 ----
  user: {
    search: (q) => apiRequest(`/users/search?q=${encodeURIComponent(q)}`),
    profile: (id) => apiRequest(`/users/${id}`),
    friendRequest: (id) =>
      apiRequest(`/users/${id}/friend-request`, { method: 'POST', body: JSON.stringify({}) }),
    acceptFriend: (requesterId) =>
      apiRequest(`/users/friend-request/accept/${requesterId}`, { method: 'POST', body: JSON.stringify({}) }),
    friends: () => apiRequest('/users/me/friends')
  }
};

// ================================
// 토스트 알림 함수 (전역)
// ================================
window.showToast = (message, type = 'info', duration = 3000) => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // 자동 제거
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// 전역 노출
window.api = api;
window.getToken = getToken;
