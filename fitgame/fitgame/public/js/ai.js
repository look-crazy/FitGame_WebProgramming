// =====================================================
// ai.js - AI 코치 페이지 (객체 응답 표시 오류 수정본)
// =====================================================

const AIPage = (() => {
  let eventsBound = false;

  async function init() {
    bindEventsOnce();
  }

  function bindEventsOnce() {
    if (eventsBound) return;
    eventsBound = true;

    document.getElementById('analyzeBtn')?.addEventListener('click', analyzeWorkouts);
    document.getElementById('getRoutineBtn')?.addEventListener('click', getRoutine);
  }

  // ─────────────────────────────────────────────
  // 운동 밸런스 분석
  // 서버 응답 예시:
  // { analysis: { feedback, routine, balance, warnings } }
  // 기존에는 객체를 그대로 화면에 넣어서 [object Object]가 표시됨
  // ─────────────────────────────────────────────
  async function analyzeWorkouts() {
    const btn = document.getElementById('analyzeBtn');
    const result = document.getElementById('aiAnalysisResult');
    if (!result) return;

    if (btn) btn.disabled = true;
    result.classList.remove('hidden');
    result.innerHTML = '<div class="ai-loading-text">분석 중...</div>';

    try {
      const res = await api.ai.analyze();
      result.innerHTML = renderAnalysisResult(res.analysis, res.workoutSummary, res.message);
    } catch (e) {
      console.error('AI 분석 표시 에러:', e);
      result.innerHTML = '<p>분석에 실패했습니다. OpenAI API 키 또는 서버 로그를 확인해주세요.</p>';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ─────────────────────────────────────────────
  // 루틴 추천
  // 서버 응답 예시:
  // { routine: [{ day, name, exercises }], tips: [...] }
  // 기존에는 배열/객체를 그대로 String 처리해서 [object Object]가 표시됨
  // ─────────────────────────────────────────────
  async function getRoutine() {
    const btn = document.getElementById('getRoutineBtn');
    const result = document.getElementById('routineResult');
    if (!result) return;

    const goal = document.getElementById('routineGoal')?.value || '근력 향상';
    const days = Number(document.getElementById('routineDays')?.value || 4);

    if (btn) btn.disabled = true;
    result.classList.remove('hidden');
    result.innerHTML = '<div class="ai-loading-text">루틴 생성 중...</div>';

    try {
      const res = await api.ai.routine(goal, days);
      result.innerHTML = renderRoutineResult(res.routine, res.tips, res.message);
    } catch (e) {
      console.error('AI 루틴 표시 에러:', e);
      result.innerHTML = '<p>루틴 추천에 실패했습니다. OpenAI API 키 또는 서버 로그를 확인해주세요.</p>';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderAnalysisResult(analysis, workoutSummary, fallbackMessage) {
    if (!analysis) return `<p>${escapeHtml(fallbackMessage || '분석 결과가 없습니다.')}</p>`;

    // OpenAI 파싱 실패 등으로 문자열이 온 경우
    if (typeof analysis === 'string') {
      return `<p>${formatPlainText(analysis)}</p>`;
    }

    const feedback = analysis.feedback || analysis.comment || fallbackMessage || '전반적인 운동 데이터를 분석했습니다.';
    const balance = analysis.balance || {};
    const routine = Array.isArray(analysis.routine) ? analysis.routine : [];
    const warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];

    return `
      <div class="ai-result-section">
        <h4>📌 종합 피드백</h4>
        <p>${formatPlainText(feedback)}</p>
      </div>

      ${renderBalance(balance)}
      ${routine.length ? `
        <div class="ai-result-section">
          <h4>🏋️ 추천 방향</h4>
          <ul>${routine.map(item => `<li>${formatPlainText(item)}</li>`).join('')}</ul>
        </div>` : ''}

      ${warnings.length ? `
        <div class="ai-result-section">
          <h4>⚠️ 주의사항</h4>
          <ul>${warnings.map(item => `<li>${formatPlainText(item)}</li>`).join('')}</ul>
        </div>` : ''}

      ${workoutSummary ? renderWorkoutSummary(workoutSummary) : ''}
    `;
  }

  function renderBalance(balance) {
    if (!balance || typeof balance !== 'object') return '';

    const hasRatio = ['upper', 'lower', 'cardio'].some(key => balance[key] !== undefined);
    if (!hasRatio && !balance.comment) return '';

    return `
      <div class="ai-result-section">
        <h4>⚖️ 운동 밸런스</h4>
        ${hasRatio ? `
          <div class="balance-grid">
            <div class="balance-card"><strong>상체</strong><span>${Number(balance.upper || 0)}%</span></div>
            <div class="balance-card"><strong>하체</strong><span>${Number(balance.lower || 0)}%</span></div>
            <div class="balance-card"><strong>유산소</strong><span>${Number(balance.cardio || 0)}%</span></div>
          </div>` : ''}
        ${balance.comment ? `<p>${formatPlainText(balance.comment)}</p>` : ''}
      </div>`;
  }

  function renderWorkoutSummary(summary) {
    const total = summary.totalWorkouts ?? 0;
    const level = summary.level ?? '-';
    const tier = summary.tier ?? '-';
    const streak = summary.streakDays ?? 0;

    return `
      <div class="ai-result-section">
        <h4>📊 분석 기준</h4>
        <p>최근 운동 ${total}회 · Lv.${level} · ${escapeHtml(tier)} · 연속 ${streak}일</p>
      </div>`;
  }

  function renderRoutineResult(routine, tips, fallbackMessage) {
    if (!routine) return `<p>${escapeHtml(fallbackMessage || '루틴 결과가 없습니다.')}</p>`;

    // 문자열 응답 처리
    if (typeof routine === 'string') {
      return `<p>${formatPlainText(routine)}</p>`;
    }

    // 혹시 { routine: [...], tips: [...] } 형태로 들어와도 처리
    if (!Array.isArray(routine) && typeof routine === 'object') {
      tips = tips || routine.tips;
      routine = routine.routine || [];
    }

    if (!Array.isArray(routine) || routine.length === 0) {
      return `<p>${escapeHtml(fallbackMessage || '루틴 결과가 없습니다.')}</p>`;
    }

    const routineHtml = routine.map(item => {
      // item이 문자열인 경우
      if (typeof item === 'string') {
        return `<li>${formatPlainText(item)}</li>`;
      }

      // item이 { day, name, exercises } 객체인 경우
      const day = item.day || '운동일';
      const name = item.name || item.title || '추천 운동';
      const exercises = Array.isArray(item.exercises) ? item.exercises : [];

      return `
        <li class="routine-day-card">
          <strong>${escapeHtml(day)} - ${escapeHtml(name)}</strong>
          ${exercises.length ? `<ul>${exercises.map(ex => `<li>${formatPlainText(ex)}</li>`).join('')}</ul>` : ''}
        </li>`;
    }).join('');

    const tipsHtml = Array.isArray(tips) && tips.length
      ? `<div class="ai-result-section"><h4>💡 운동 팁</h4><ul>${tips.map(tip => `<li>${formatPlainText(tip)}</li>`).join('')}</ul></div>`
      : '';

    return `
      <div class="ai-result-section">
        <h4>✅ 맞춤 루틴</h4>
        <ul class="routine-list">${routineHtml}</ul>
      </div>
      ${tipsHtml}`;
  }

  function formatPlainText(value) {
    if (value === null || value === undefined) return '';

    // 객체/배열이 들어와도 [object Object]가 나오지 않도록 안전 변환
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => formatPlainText(v)).join('<br>');
      }
      return Object.entries(value)
        .map(([key, val]) => `${escapeHtml(key)}: ${formatPlainText(val)}`)
        .join('<br>');
    }

    return escapeHtml(String(value))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return { init };
})();

window.AIPage = AIPage;
