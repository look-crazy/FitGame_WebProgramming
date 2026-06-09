/**
 * 인증 모듈
 * 로그인, 회원가입, 로그아웃 UI 처리
 */

// 현재 앱 상태
let currentUser = null;

/**
 * 앱 초기화 시 로그인 상태 확인
 */
const initAuth = async () => {
  const token = getToken();

  if (token) {
    try {
      const data = await api.auth.me();
      currentUser = data.user;
      showApp(currentUser);
    } catch (error) {
      // 토큰 만료 등의 에러 → 로그인 화면
      localStorage.removeItem('fitgame_token');
      localStorage.removeItem('fitgame_user');
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
};

/**
 * 인증 화면 표시
 */
const showAuthScreen = () => {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  hideLoading();
};

/**
 * 메인 앱 화면 표시
 */
const showApp = (user) => {
  currentUser = user;
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  hideLoading();

  // 사이드바 유저 정보 업데이트
  updateSidebarProfile(user);

  // 대시보드는 app.js 라우터를 통해 로드합니다.
  // 이렇게 해야 새로고침/로그인 직후에도 메뉴 클릭 이벤트가 정상 유지됩니다.
  window.App?.navigateTo?.('dashboard');
};

/**
 * showAuth 전역 함수 (api.js에서 호출용)
 */
window.showAuth = showAuthScreen;

/**
 * 사이드바 프로필 업데이트
 */
const updateSidebarProfile = (user) => {
  const nickname = document.getElementById('sidebarNickname');
  const tier = document.getElementById('sidebarTier');
  const avatar = document.getElementById('sidebarAvatar');

  if (nickname) nickname.textContent = user.nickname;
  if (tier) tier.textContent = `${user.gameStats.tier} Lv.${user.gameStats.level}`;
  if (avatar) {
    if (user.profileImage) {
      avatar.innerHTML = `<img src="${user.profileImage}" alt="프로필">`;
    } else {
      avatar.textContent = user.nickname[0].toUpperCase();
    }
  }
};

/**
 * 로딩 오버레이 숨기기
 */
const hideLoading = () => {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.style.display = 'none', 500);
    }, 1200); // 로딩 애니메이션 최소 시간
  }
};

// ================================
// 이벤트 리스너 등록
// ================================
document.addEventListener('DOMContentLoaded', () => {

  // 탭 전환 (로그인 ↔ 회원가입)
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
        form.classList.add('hidden');
      });

      const targetForm = document.getElementById(`${targetTab}Form`);
      targetForm.classList.remove('hidden');
      targetForm.classList.add('active');
    });
  });

  // ================================
  // 로그인 폼 제출
  // ================================
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('loginError');
    const btn = loginForm.querySelector('button[type="submit"]');

    try {
      btn.disabled = true;
      btn.textContent = '로그인 중...';
      errorDiv.classList.add('hidden');

      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      const data = await api.auth.login(email, password);

      // 토큰과 유저 정보 저장
      localStorage.setItem('fitgame_token', data.token);
      localStorage.setItem('fitgame_user', JSON.stringify(data.user));

      showToast('로그인 성공! 오늘도 파이팅! 💪', 'success');
      showApp(data.user);

    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>로그인</span><span class="btn-icon">→</span>';
    }
  });

  // ================================
  // 닉네임 중복 확인
  // ================================
  let nicknameChecked = false;

  document.getElementById('checkNicknameBtn')?.addEventListener('click', async () => {
    const nickname = document.getElementById('regNickname').value.trim();
    const statusDiv = document.getElementById('nicknameStatus');

    if (nickname.length < 2) {
      statusDiv.textContent = '닉네임은 2자 이상이어야 합니다.';
      statusDiv.className = 'form-hint error';
      return;
    }

    try {
      const data = await api.auth.checkNickname(nickname);
      nicknameChecked = data.available;
      statusDiv.textContent = data.message;
      statusDiv.className = `form-hint ${data.available ? 'success' : 'error'}`;
    } catch (error) {
      statusDiv.textContent = '확인 중 오류가 발생했습니다.';
      statusDiv.className = 'form-hint error';
    }
  });

  // 닉네임 변경 시 중복확인 초기화
  document.getElementById('regNickname')?.addEventListener('input', () => {
    nicknameChecked = false;
    document.getElementById('nicknameStatus').textContent = '';
  });

  // ================================
  // 프로필 이미지 미리보기
  // ================================
  const fileUploadArea = document.getElementById('fileUploadArea');
  const profileImageInput = document.getElementById('regProfileImage');
  const profilePreview = document.getElementById('profilePreview');

  fileUploadArea?.addEventListener('click', () => profileImageInput?.click());

  profileImageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        profilePreview.src = evt.target.result;
        profilePreview.classList.remove('hidden');
        fileUploadArea.querySelector('.file-upload-placeholder').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });

  // ================================
  // 회원가입 폼 제출
  // ================================
  const registerForm = document.getElementById('registerForm');
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('registerError');
    const btn = registerForm.querySelector('button[type="submit"]');

    try {
      btn.disabled = true;
      btn.textContent = '가입 중...';
      errorDiv.classList.add('hidden');

      const formData = new FormData();
      formData.append('email', document.getElementById('regEmail').value);
      formData.append('password', document.getElementById('regPassword').value);
      formData.append('nickname', document.getElementById('regNickname').value.trim());

      const imageFile = profileImageInput?.files[0];
      if (imageFile) {
        formData.append('profileImage', imageFile);
      }

      const data = await api.auth.register(formData);

      localStorage.setItem('fitgame_token', data.token);
      localStorage.setItem('fitgame_user', JSON.stringify(data.user));

      showToast('🎮 FitGame에 오신 것을 환영합니다!', 'success');
      showApp(data.user);

    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>게임 시작하기</span><span class="btn-icon">⚡</span>';
    }
  });

  // ================================
  // 로그아웃
  // ================================
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('fitgame_token');
    localStorage.removeItem('fitgame_user');
    currentUser = null;
    showAuthScreen();
    showToast('로그아웃되었습니다.', 'info');
  });

  // 앱 초기화는 app.js에서 한 번만 실행합니다.
});

// 전역 노출
window.initAuth = initAuth;
window.showApp = showApp;
window.currentUser = () => currentUser;
window.updateSidebarProfile = updateSidebarProfile;
