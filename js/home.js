import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, yearStats } from './catalog.js';
import { getProgress, isAvailable } from './progress.js';

renderChrome();
const root = document.getElementById('library');
const status = document.getElementById('library-status');

function yearBox(y) {
  const st = yearStats(y);
  const bits = [`${st.courses} course${st.courses === 1 ? '' : 's'}`];
  if (st.questions) bits.push(`${st.questions} practice questions`);
  return `<a class="pick-box" href="year.html?y=${y.year}">
    <span class="pick-label">Year ${y.year}</span>
    <span class="pick-meta">${bits.join(' · ')}</span>
  </a>`;
}

// Animated count-up for the hero stats. Skipped under reduced motion.
function countUp(el, target) {
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browser */ }
  if (reduced || target < 10) { el.textContent = target.toLocaleString(); return; }
  const dur = 900;
  const t0 = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function heroStats(catalog) {
  let courses = 0;
  let questions = 0;
  let labs = 0;
  for (const y of catalog.years) {
    const st = yearStats(y);
    courses += st.courses;
    questions += st.questions || 0;
    for (const s of y.semesters) for (const c of s.courses) {
      if (c.hasCode) labs += 1;
      if (c.hasC) labs += 1;
    }
  }
  return `
    <div class="home-stats" aria-label="What is inside">
      <div class="home-stat"><span class="home-stat-n" data-count="${questions}">0</span><span class="home-stat-l">practice questions</span></div>
      <div class="home-stat"><span class="home-stat-n" data-count="${courses}">0</span><span class="home-stat-l">courses, Year 1 to 4</span></div>
      <div class="home-stat"><span class="home-stat-n" data-count="${labs}">0</span><span class="home-stat-l">in-browser coding labs</span></div>
    </div>`;
}

function continueCards(catalog) {
  if (!isAvailable()) return '';
  const active = [];
  for (const y of catalog.years) for (const s of y.semesters) for (const c of s.courses) {
    const p = getProgress(c.id);
    if (p.attempted === 0) continue;
    let lastActive = 0;
    for (const q of Object.values(p.byQuestion)) if (q && q.at > lastActive) lastActive = q.at;
    active.push({ c, p, lastActive });
  }
  if (!active.length) return '';
  active.sort((a, b) => b.lastActive - a.lastActive);
  return `
    <section class="home-continue" aria-label="Pick up where you left off">
      <h2>Pick up where you left off</h2>
      <div class="continue-grid">
        ${active.slice(0, 3).map(({ c, p }) => `
          <a class="continue-card" href="practice.html?c=${encodeURIComponent(c.id)}">
            <span class="continue-title">${escapeHtml(c.title)}</span>
            <span class="continue-meta">${p.attempted} question${p.attempted === 1 ? '' : 's'} tried · keep practicing</span>
            <span class="continue-cta">Continue &#8594;</span>
          </a>`).join('')}
      </div>
    </section>`;
}

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    root.innerHTML = `
      ${heroStats(catalog)}
      ${continueCards(catalog)}
      <div class="pick-grid">${catalog.years.map(yearBox).join('')}</div>`;
    root.querySelectorAll('.home-stat-n').forEach(el => countUp(el, Number(el.dataset.count) || 0));
    if (status) status.textContent = '';
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
    if (status) status.textContent = 'The course catalog failed to load.';
  }
})();
