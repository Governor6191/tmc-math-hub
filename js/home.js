import { renderChrome } from './app.js';
import { loadCatalog, yearStats } from './catalog.js';

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

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    root.innerHTML = `<div class="pick-grid">${catalog.years.map(yearBox).join('')}</div>`;
    if (status) status.textContent = '';
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
    if (status) status.textContent = 'The course catalog failed to load.';
  }
})();
