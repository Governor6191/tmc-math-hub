import { renderChrome } from './app.js';
import { loadCatalog, semesterStats } from './catalog.js';

renderChrome();
const root = document.getElementById('year-root');
const yearNum = Number(new URLSearchParams(location.search).get('y'));

function semesterBox(yearNumber, s) {
  const st = semesterStats(s);
  const bits = [`${st.courses} course${st.courses === 1 ? '' : 's'}`];
  if (st.questions) bits.push(`${st.questions} practice questions`);
  return `<a class="pick-box" href="semester.html?y=${yearNumber}&amp;s=${s.semester}">
    <span class="pick-label">Semester ${s.semester}</span>
    <span class="pick-meta">${bits.join(' · ')}</span>
  </a>`;
}

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    const year = catalog.years.find(y => y.year === yearNum);
    if (!year) {
      root.innerHTML = `<div class="error"><p>We couldn't find that year.
        <a href="index.html">Back to the library</a>.</p></div>`;
      return;
    }
    document.title = `Year ${year.year} - TMC Math Hub`;
    root.innerHTML = `
      <p class="crumb"><a class="crumb-back" href="index.html" aria-label="Back to the library">&#8592;</a><a href="index.html">Library</a> · Year ${year.year}</p>
      <h1>Year ${year.year}</h1>
      <p class="hint">Pick a semester.</p>
      <div class="pick-grid">${year.semesters.map(s => semesterBox(year.year, s)).join('')}</div>`;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
