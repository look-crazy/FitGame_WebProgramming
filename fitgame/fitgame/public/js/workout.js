// =====================================================
// workout.js - 운동 기록 CRUD UI (index.html ID 기준 수정본)
// =====================================================

const WorkoutPage = (() => {
  let selectedType = null;
  let selectedDate = null;
  let currentWorkouts = [];
  let eventsBound = false;
  let currentCalendarDate = new Date();

  const strengthTypes = ['bench_press', 'squat', 'deadlift', 'push_up'];
  const cardioTypes = ['running', 'cycling'];

  async function init() {
    bindEventsOnce();
    setDefaultDate();
    renderCalendar(currentCalendarDate);
    await loadWorkoutList();
  }

  function bindEventsOnce() {
    if (eventsBound) return;
    eventsBound = true;

    document.getElementById('openWorkoutModal')?.addEventListener('click', openAddModal);
    document.getElementById('closeWorkoutModal')?.addEventListener('click', closeModal);
    document.getElementById('workoutModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'workoutModal') closeModal();
    });

    document.getElementById('addSetBtn')?.addEventListener('click', () => addSetRow());
    document.getElementById('workoutForm')?.addEventListener('submit', handleSubmit);

    document.querySelectorAll('.workout-type-btn').forEach(btn => {
      btn.addEventListener('click', () => selectWorkoutType(btn.dataset.type));
    });

    document.getElementById('loadMoreWorkouts')?.addEventListener('click', () => loadWorkoutList());

    document.getElementById('calPrev')?.addEventListener('click', () => {
      currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1);
      renderCalendar(currentCalendarDate);
    });

    document.getElementById('calNext')?.addEventListener('click', () => {
      currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1);
      renderCalendar(currentCalendarDate);
    });
  }

  function toLocalDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function renderCalendar(date) {
    const title = document.getElementById('calendarTitle');
    const grid = document.getElementById('calendarGrid');
    if (!title || !grid) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const todayStr = toLocalDateString(new Date());
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    title.textContent = `${year}년 ${month + 1}월`;

    let html = `
      <div class="cal-day-name">일</div>
      <div class="cal-day-name">월</div>
      <div class="cal-day-name">화</div>
      <div class="cal-day-name">수</div>
      <div class="cal-day-name">목</div>
      <div class="cal-day-name">금</div>
      <div class="cal-day-name">토</div>`;

    for (let i = 0; i < firstDay; i++) {
      html += '<div class="cal-cell empty"></div>';
    }

    for (let day = 1; day <= lastDate; day++) {
      const cellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = cellDate === todayStr;
      const isSelected = cellDate === selectedDate;
      html += `<button type="button" class="cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${cellDate}">${day}</button>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', async () => {
        selectedDate = cell.dataset.date;
        document.getElementById('workoutDate') && (document.getElementById('workoutDate').value = selectedDate);
        document.getElementById('selectedDayTitle') && (document.getElementById('selectedDayTitle').textContent = selectedDate);
        renderCalendar(currentCalendarDate);
      });
    });
  }

  function setDefaultDate() {
    const dateInput = document.getElementById('workoutDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = toLocalDateString(new Date());
    }
  }

  async function loadWorkoutList() {
    const container = document.getElementById('workoutList');
    if (!container) return;

    try {
      container.innerHTML = '<div class="skeleton-loading">운동 기록 로딩 중...</div>';
      const res = await api.workout.list({ limit: 20 });
      currentWorkouts = res.workouts || [];
      renderWorkoutList(currentWorkouts);
    } catch (e) {
      console.error('운동 목록 로드 에러:', e);
      container.innerHTML = '<div class="empty-state">운동 기록을 불러오지 못했습니다.</div>';
    }
  }

  function renderWorkoutList(workouts) {
    const container = document.getElementById('workoutList');
    if (!container) return;

    if (!workouts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size:3rem">🏋️</div>
          <p>운동 기록이 없습니다.</p>
          <p style="color:var(--text-muted);font-size:0.85rem">새 운동을 추가해보세요!</p>
        </div>`;
      return;
    }

    container.innerHTML = workouts.map(buildWorkoutCard).join('');

    container.querySelectorAll('.workout-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteWorkout(btn.dataset.id));
    });
  }

  function buildWorkoutCard(w) {
    const date = new Date(w.date).toLocaleDateString('ko-KR');
    const detail = (w.sets && w.sets.length)
      ? w.sets.map(s => `<span class="tag">${s.weight || 0}kg × ${s.reps || 0}회</span>`).join('')
      : `<span class="tag">${w.duration || 0}분</span>${w.distance ? `<span class="tag">${w.distance}km</span>` : ''}`;

    return `
      <div class="workout-card glass-card">
        <div class="workout-card-header">
          <div>
            <span class="workout-type-badge">${w.name || w.type}</span>
            <h3 class="workout-name">${w.name || w.type}</h3>
          </div>
          <div class="workout-score">
            <span class="score-value">+${w.score || 0}pts</span>
            <span class="exp-value">+${w.expGained || 0}EXP</span>
          </div>
        </div>
        <div class="workout-card-details">${detail}</div>
        <div class="workout-card-footer">
          <span class="workout-date">${date}</span>
          <button class="btn-icon workout-delete-btn" data-id="${w._id}" title="삭제">🗑️</button>
        </div>
        ${w.note ? `<p class="workout-notes">${escapeHtml(w.note)}</p>` : ''}
      </div>`;
  }

  function openAddModal() {
    selectedType = null;
    document.getElementById('workoutForm')?.reset();
    setDefaultDate();
    document.querySelectorAll('.workout-type-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('strengthForm')?.classList.add('hidden');
    document.getElementById('cardioForm')?.classList.add('hidden');
    resetSets();

    const modal = document.getElementById('workoutModal');
    modal?.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('workoutModal')?.classList.add('hidden');
  }

  function selectWorkoutType(type) {
    selectedType = type;
    document.querySelectorAll('.workout-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });

    const strengthForm = document.getElementById('strengthForm');
    const cardioForm = document.getElementById('cardioForm');

    if (strengthTypes.includes(type)) {
      strengthForm?.classList.remove('hidden');
      cardioForm?.classList.add('hidden');
      resetSets();
    } else if (cardioTypes.includes(type) || type === 'free') {
      strengthForm?.classList.add('hidden');
      cardioForm?.classList.remove('hidden');
    }

    updatePreview();
  }

  function resetSets() {
    const container = document.getElementById('setsContainer');
    if (!container) return;
    container.innerHTML = '';
    addSetRow();
  }

  function addSetRow(weight = '', reps = '') {
    const container = document.getElementById('setsContainer');
    if (!container) return;

    const num = container.children.length + 1;
    const row = document.createElement('div');
    row.className = 'set-row';
    row.innerHTML = `
      <span class="set-label">세트 ${num}</span>
      <input type="number" placeholder="무게(kg)" class="set-weight" min="0" step="0.5" value="${weight}">
      <input type="number" placeholder="횟수" class="set-reps" min="0" value="${reps}">
      <button type="button" class="btn-remove-set">✕</button>`;

    row.querySelector('.btn-remove-set').addEventListener('click', () => {
      if (container.children.length > 1) row.remove();
      renumberSets();
      updatePreview();
    });

    row.querySelectorAll('input').forEach(input => input.addEventListener('input', updatePreview));
    container.appendChild(row);
  }

  function renumberSets() {
    document.querySelectorAll('#setsContainer .set-label').forEach((el, idx) => {
      el.textContent = `세트 ${idx + 1}`;
    });
  }

  function updatePreview() {
    let score = 0;
    if (strengthTypes.includes(selectedType)) {
      document.querySelectorAll('#setsContainer .set-row').forEach(row => {
        const weight = Number(row.querySelector('.set-weight')?.value || 0);
        const reps = Number(row.querySelector('.set-reps')?.value || 0);
        score += Math.round((weight * reps) / 10);
      });
    } else {
      score = Number(document.getElementById('workoutDuration')?.value || 0);
    }
    document.getElementById('previewScore') && (document.getElementById('previewScore').textContent = score);
    document.getElementById('previewExp') && (document.getElementById('previewExp').textContent = Math.round(score / 10) + 10);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedType) {
      showToast('운동 종류를 선택해주세요.', 'warning');
      return;
    }

    const payload = {
      type: selectedType,
      date: document.getElementById('workoutDate')?.value || toLocalDateString(new Date()),
      note: document.getElementById('workoutNote')?.value.trim() || ''
    };

    if (strengthTypes.includes(selectedType)) {
      payload.sets = Array.from(document.querySelectorAll('#setsContainer .set-row')).map((row, idx) => ({
        setNumber: idx + 1,
        weight: Number(row.querySelector('.set-weight')?.value || 0),
        reps: Number(row.querySelector('.set-reps')?.value || 0)
      })).filter(s => s.reps > 0);

      if (!payload.sets.length) {
        showToast('세트 정보를 입력해주세요.', 'warning');
        return;
      }
    } else {
      payload.duration = Number(document.getElementById('workoutDuration')?.value || 0);
      payload.distance = Number(document.getElementById('workoutDistance')?.value || 0);
      if (payload.duration <= 0) {
        showToast('운동 시간을 입력해주세요.', 'warning');
        return;
      }
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';

    try {
      const res = await api.workout.create(payload);
      const gained = res.rewards?.expGained || res.workout?.expGained || 0;
      showToast(`운동 기록 완료! +${gained} EXP 획득!`, 'success');
      closeModal();
      await loadWorkoutList();
      window.GamePage?.loadDashboard?.();
    } catch (err) {
      console.error('운동 저장 에러:', err);
      showToast(err.message || '저장에 실패했습니다.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async function deleteWorkout(id) {
    if (!confirm('이 운동 기록을 삭제하시겠습니까?')) return;
    try {
      await api.workout.delete(id);
      showToast('운동 기록이 삭제되었습니다.', 'info');
      await loadWorkoutList();
      window.GamePage?.loadDashboard?.();
    } catch (e) {
      showToast('삭제에 실패했습니다.', 'error');
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
  }

  return { init, loadWorkoutList, openAddModal };
})();

window.WorkoutPage = WorkoutPage;
