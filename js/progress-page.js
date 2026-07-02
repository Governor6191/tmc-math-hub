// My Progress dashboard: streak, all-time totals, a 14 day activity strip and
// per-course mastery rings, all computed from this device's localStorage.

import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, courseStats } from './catalog.js';
import { getProgress, getActivity, isAvailable } from './progress.js';
import { getAttempts } from './exam-store.js';
import { dayKey, streaks, mergeDayCounts, lastDays } from './progress-stats.js';
import { accountsEnabled } from './cloud-sync.js';

renderChrome();
const root = document.getElementById('progress');

const privacyLine = () => (accountsEnabled()
  ? 'Your progress lives on this device and, when you sign in, follows you across devices.'
  : 'Everything here lives on this device only. Nothing is uploaded anywhere.');

const fmt1 = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function ring(pct, size, delayMs) {
  const r = 26;
  const C = 2 * Math.PI * r;
  return `
    <svg class="ring-sm" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${pct} percent mastered">
      <circle class="ring-sm-track" cx="32" cy="32" r="${r}"></circle>
      <circle class="ring-sm-fill" cx="32" cy="32" r="${r}"
        style="stroke-dasharray:${C.toFixed(1)}; stroke-dashoffset:${C.toFixed(1)}; transition-delay:${delayMs}ms;"
        data-target="${(C * (1 - pct / 100)).toFixed(1)}"></circle>
      <text class="ring-sm-text" x="32" y="32" text-anchor="middle" dominant-baseline="central">${pct}%</text>
    </svg>`;
}

function sparkline(counts, todayKey) {
  const days = lastDays(counts, todayKey, 14);
  const max = Math.max(1, ...days.map(d => d.count));
  return `
    <div class="dash-spark" role="img" aria-label="Answers per day over the last 14 days">
      ${days.map(d => `<span class="spark-col" title="${d.day}: ${d.count} answer${d.count === 1 ? '' : 's'}">
        <i style="height:${Math.max(d.count > 0 ? 12 : 4, Math.round((d.count / max) * 100))}%"
           class="${d.count > 0 ? 'is-active' : ''}"></i></span>`).join('')}
    </div>
    <p class="hint dash-spark-label">Last 14 days</p>`;
}

async function renderDashboard() {
  try {
    if (!isAvailable()) {
      root.innerHTML = `<h1>My progress</h1>
        <div class="error"><p>This browser is not saving progress (private browsing or storage is off).
        Practice and exams still work; they just will not be remembered here.</p></div>`;
      return;
    }
    const catalog = await loadCatalog();
    const rows = [];
    let coursesWithQuestions = 0;
    for (const y of catalog.years) for (const s of y.semesters) for (const c of s.courses) {
      const stats = courseStats(c);
      if (stats.questions > 0) coursesWithQuestions += 1;
      const p = getProgress(c.id);
      const attempts = getAttempts(c.id);
      if (p.attempted === 0 && attempts.length === 0) continue;
      let lastActive = 0;
      for (const q of Object.values(p.byQuestion)) if (q && q.at > lastActive) lastActive = q.at;
      for (const a of attempts) { const t = new Date(a.date).getTime(); if (t > lastActive) lastActive = t; }
      rows.push({ course: c, stats, p, attempts, lastActive });
    }
    rows.sort((a, b) => b.lastActive - a.lastActive);

    // Day activity: the exact per-day log, blended with days recovered from
    // older answer timestamps and exam dates recorded before the log existed.
    const derived = {};
    for (const r of rows) {
      for (const q of Object.values(r.p.byQuestion)) {
        if (!q || !q.at) continue;
        const k = dayKey(q.at);
        derived[k] = (derived[k] || 0) + 1;
      }
      for (const a of r.attempts) {
        const t = new Date(a.date).getTime();
        if (Number.isFinite(t)) { const k = dayKey(t); derived[k] = (derived[k] || 0) + 1; }
      }
    }
    const counts = mergeDayCounts(getActivity(), derived);
    const today = dayKey(Date.now());
    const s = streaks(Object.keys(counts), today);

    const attemptedTotal = rows.reduce((n, r) => n + r.p.attempted, 0);
    const correctTotal = rows.reduce((n, r) => n + r.p.correct, 0);
    const answersAllTime = Math.max(attemptedTotal, Object.values(counts).reduce((n, v) => n + v, 0));
    const accuracy = attemptedTotal ? Math.round((correctTotal / attemptedTotal) * 100) : 0;

    if (rows.length === 0) {
      root.innerHTML = `
        <h1>My progress</h1>
        <p class="hint">${privacyLine()}</p>
        <div class="quiz-card dash-empty">
          <p class="dash-empty-big">Nothing here yet, and that is easy to fix.</p>
          <p>Open a course and answer a few practice questions. Your streak, accuracy and mastery rings will start growing right here.</p>
          <div class="quiz-next" style="justify-content: center;">
            <a class="next-btn" style="display: inline-block; text-decoration: none;" href="index.html">Browse the library</a>
          </div>
        </div>`;
      return;
    }

    root.innerHTML = `
      <h1>My progress</h1>
      <p class="hint">${privacyLine()}</p>
      <div class="dash-stats">
        <div class="stat-card">
          <p class="stat-value">${s.current} day${s.current === 1 ? '' : 's'}</p>
          <p class="stat-label">Study streak${s.best > s.current ? ` · best ${s.best}` : s.current > 1 ? ' · your best yet' : ''}</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${answersAllTime}</p>
          <p class="stat-label">Answers given</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${accuracy}%</p>
          <p class="stat-label">Accuracy on latest answers</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${rows.length}</p>
          <p class="stat-label">Course${rows.length === 1 ? '' : 's'} started of ${coursesWithQuestions}</p>
        </div>
      </div>
      ${sparkline(counts, today)}
      <h2 class="dash-h2">Courses</h2>
      <div class="dash-grid">
        ${rows.map((r, i) => {
          const mastery = r.stats.questions ? Math.min(100, Math.round((r.p.correct / r.stats.questions) * 100)) : 0;
          const acc = r.p.attempted ? Math.round((r.p.correct / r.p.attempted) * 100) : 0;
          const best = r.attempts.reduce((b, a) => {
            const ratio = a.total ? a.score / a.total : 0;
            return !b || ratio > b.ratio ? { ratio, a } : b;
          }, null);
          return `
        <section class="dash-card">
          <div class="dash-card-head">
            ${ring(mastery, 64, 120 + i * 90)}
            <div class="dash-card-title">
              <h3><a href="course.html?c=${encodeURIComponent(r.course.id)}">${escapeHtml(r.course.title)}</a></h3>
              <p class="hint">${fmt1(r.p.correct)} of ${r.stats.questions} question${r.stats.questions === 1 ? '' : 's'} mastered · ${r.p.attempted} tried · ${acc}% accuracy</p>
            </div>
          </div>
          <div class="dash-bar"><i style="width:${mastery}%"></i></div>
          ${best ? `<p class="dash-exam">Best mock exam: <strong>${fmt1(best.a.score)}/${best.a.total}</strong> (${Math.round(best.ratio * 100)}%)</p>` : ''}
          ${r.attempts.length ? `
          <details class="dash-attempts">
            <summary>${r.attempts.length} exam attempt${r.attempts.length === 1 ? '' : 's'}</summary>
            <ul class="summary-list">
              ${r.attempts.map(a => `
                <li><span>${new Date(a.date).toLocaleDateString()} · ${escapeHtml(String(a.formatId))}</span>
                  <span class="summary-state">${fmt1(a.score)}/${a.total} in ${a.minutesUsed} min</span></li>`).join('')}
            </ul>
          </details>` : ''}
          <div class="dash-links">
            <a href="practice.html?c=${encodeURIComponent(r.course.id)}">Practice</a>
            <a href="exam.html?c=${encodeURIComponent(r.course.id)}">Mock exam</a>
            ${r.course.hasCode ? `<a href="lab.html?c=${encodeURIComponent(r.course.id)}">Coding lab</a>` : ''}
            ${r.course.hasC ? `<a href="clab/index.html?c=${encodeURIComponent(r.course.id)}">C lab</a>` : ''}
          </div>
        </section>`;
        }).join('')}
      </div>`;

    // Animate the mastery rings in.
    requestAnimationFrame(() => {
      setTimeout(() => {
        root.querySelectorAll('.ring-sm-fill').forEach(el => {
          el.style.strokeDashoffset = el.dataset.target;
        });
      }, 60);
    });
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>Progress failed to load. <a href="">Reload the page</a>.</p></div>`;
  }
}

renderDashboard();
// When cloud sync merges fresh data in (signed-in students), redraw with it.
window.addEventListener('tmc:synced', () => { renderDashboard(); });
