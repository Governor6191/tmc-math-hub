import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, courseStats } from './catalog.js';
import { getProgress, isAvailable } from './progress.js';
import { getAttempts } from './exam-store.js';

renderChrome();
const root = document.getElementById('progress');

(async () => {
  try {
    if (!isAvailable()) {
      root.innerHTML = `<h1>My progress</h1>
        <div class="error"><p>This browser is not saving progress (private browsing or storage is off).
        Practice and exams still work; they just will not be remembered here.</p></div>`;
      return;
    }
    const catalog = await loadCatalog();
    const rows = [];
    for (const y of catalog.years) for (const s of y.semesters) for (const c of s.courses) {
      const p = getProgress(c.id);
      const attempts = getAttempts(c.id);
      if (p.attempted === 0 && attempts.length === 0) continue;
      rows.push({ course: c, stats: courseStats(c), p, attempts });
    }
    root.innerHTML = `
      <h1>My progress</h1>
      <p class="hint">Everything here lives on this device only. Nothing is uploaded anywhere.</p>
      ${rows.length === 0 ? `<div class="error"><p>Nothing yet. Open a course and try some practice questions;
        your progress will appear here.</p></div>` : rows.map(r => `
        <section class="quiz-card" style="margin: 1rem 0;">
          <h2 style="margin-top: 0;"><a href="course.html?c=${encodeURIComponent(r.course.id)}">${escapeHtml(r.course.title)}</a></h2>
          <p>${r.p.attempted} question${r.p.attempted === 1 ? '' : 's'} tried${r.stats.questions ? ` of ${r.stats.questions} live` : ''}, ${Math.round(r.p.correct)} right on latest answers.</p>
          ${r.attempts.length ? `
            <h3>Mock exam attempts</h3>
            <ul class="summary-list">
              ${r.attempts.map(a => `
                <li><span>${new Date(a.date).toLocaleDateString()} · ${escapeHtml(String(a.formatId))}</span>
                  <span class="summary-state">${a.score}/${a.total} in ${a.minutesUsed} min</span></li>`).join('')}
            </ul>` : ''}
        </section>`).join('')}`;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>Progress failed to load. <a href="">Reload the page</a>.</p></div>`;
  }
})();
