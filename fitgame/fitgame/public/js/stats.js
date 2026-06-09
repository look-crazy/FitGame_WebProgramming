// =====================================================
// stats.js - 통계 페이지 (index.html ID 기준 수정본)
// =====================================================

const StatsPage = (() => {
  let scoreChart = null;
  let typeChart = null;
  let currentPeriod = 'week';
  let eventsBound = false;

  async function init() {
    bindEventsOnce();
    await loadStats(currentPeriod);
  }

  function bindEventsOnce() {
    if (eventsBound) return;
    eventsBound = true;

    document.querySelectorAll('.period-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.dataset.period || 'week';
        await loadStats(currentPeriod);
      });
    });
  }

  async function loadStats(period = 'week') {
    try {
      const [statsRes, workoutsRes] = await Promise.all([
        api.workout.stats(period),
        api.workout.list({ limit: 100 })
      ]);
      const stats = statsRes.stats || {};
      const workouts = workoutsRes.workouts || [];
      renderKpis(stats);
      renderScoreChart(stats.dailyScores || {}, workouts);
      renderTypeChart(stats.typeDistribution || {});
    } catch (e) {
      console.error('통계 로드 에러:', e);
      showToast('통계를 불러오지 못했습니다.', 'error');
    }
  }

  function renderKpis(stats) {
    const kpiGrid = document.getElementById('kpiGrid');
    if (!kpiGrid) return;
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-value">${stats.totalWorkouts || 0}</div><div class="kpi-label">총 운동</div></div>
      <div class="kpi-card"><div class="kpi-value">${(stats.totalScore || 0).toLocaleString()}</div><div class="kpi-label">총 점수</div></div>
      <div class="kpi-card"><div class="kpi-value">${stats.totalExp || 0}</div><div class="kpi-label">총 EXP</div></div>
      <div class="kpi-card"><div class="kpi-value">${Math.round(stats.avgScore || 0)}</div><div class="kpi-label">평균 점수</div></div>`;
  }

  function renderScoreChart(dailyScores, workouts) {
    const canvas = document.getElementById('scoreChart');
    if (!canvas || !window.Chart) return;

    const labels = Object.keys(dailyScores).sort();
    const data = labels.map(day => dailyScores[day]);

    if (!labels.length && workouts.length) {
      const grouped = {};
      workouts.forEach(w => {
        const day = new Date(w.date).toISOString().split('T')[0];
        grouped[day] = (grouped[day] || 0) + (w.score || 0);
      });
      labels.push(...Object.keys(grouped).sort().slice(-14));
      data.push(...labels.map(day => grouped[day]));
    }

    scoreChart?.destroy();
    scoreChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['데이터 없음'],
        datasets: [{ label: '점수', data: data.length ? data : [0], tension: 0.35 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  function renderTypeChart(typeDistribution) {
    const canvas = document.getElementById('typeChart');
    if (!canvas || !window.Chart) return;

    const labels = Object.keys(typeDistribution);
    const data = labels.map(key => typeDistribution[key]);

    typeChart?.destroy();
    typeChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['데이터 없음'],
        datasets: [{ data: data.length ? data : [1] }]
      },
      options: { responsive: true }
    });
  }

  return { init, loadStats };
})();

window.StatsPage = StatsPage;
