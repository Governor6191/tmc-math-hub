import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, statsForCourses, semesterStats, yearTracks, coursesForGroup } from './catalog.js';

renderChrome();
const root = document.getElementById('year-root');
const params = new URLSearchParams(location.search);
const yearNum = Number(params.get('y'));
const group = params.get('g');

function pickBox(href, label, st) {
  const bits = [`${st.courses} course${st.courses === 1 ? '' : 's'}`];
  if (st.questions) bits.push(`${st.questions} practice questions`);
  return `<a class="pick-box" href="${href}">
    <span class="pick-label">${escapeHtml(label)}</span>
    <span class="pick-meta">${bits.join(' · ')}</span>
  </a>`;
}

function notFound() {
  root.innerHTML = `<div class="error"><p>We couldn't find that year.
    <a href="index.html">Back to the library</a>.</p></div>`;
}

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    const year = catalog.years.find(y => y.year === yearNum);
    if (!year) { notFound(); return; }
    const tracks = yearTracks(year);
    const allCourses = year.semesters.flatMap(s => s.courses);

    // Year with streams, no group chosen yet: pick a group first.
    if (tracks.length && !group) {
      document.title = `Year ${year.year} - TMC Math Hub`;
      const boxes = tracks.map(t => pickBox(
        `year.html?y=${year.year}&amp;g=${encodeURIComponent(t)}`,
        t,
        statsForCourses(coursesForGroup(allCourses, t)),
      )).join('');
      root.innerHTML = `
        <p class="crumb"><a class="crumb-back" href="index.html" aria-label="Back to the library">&#8592;</a><a href="index.html">Library</a> · Year ${year.year}</p>
        <h1>Year ${year.year}</h1>
        <p class="hint">Pick your group.</p>
        <div class="pick-grid">${boxes}</div>`;
      return;
    }

    // Pick a semester (Years 1 to 3, or a chosen Year 4 group).
    document.title = group ? `${group}, Year ${year.year} - TMC Math Hub` : `Year ${year.year} - TMC Math Hub`;
    const crumb = group
      ? `<p class="crumb"><a class="crumb-back" href="year.html?y=${year.year}" aria-label="Back to the Year ${year.year} groups">&#8592;</a><a href="index.html">Library</a> · <a href="year.html?y=${year.year}">Year ${year.year}</a> · ${escapeHtml(group)}</p>`
      : `<p class="crumb"><a class="crumb-back" href="index.html" aria-label="Back to the library">&#8592;</a><a href="index.html">Library</a> · Year ${year.year}</p>`;
    const heading = group ? `Year ${year.year} · ${escapeHtml(group)}` : `Year ${year.year}`;
    const boxes = year.semesters.map(s => {
      const href = group
        ? `semester.html?y=${year.year}&amp;s=${s.semester}&amp;g=${encodeURIComponent(group)}`
        : `semester.html?y=${year.year}&amp;s=${s.semester}`;
      const st = group ? statsForCourses(coursesForGroup(s.courses, group)) : semesterStats(s);
      return pickBox(href, `Semester ${s.semester}`, st);
    }).join('');
    root.innerHTML = `
      ${crumb}
      <h1>${heading}</h1>
      <p class="hint">Pick a semester.</p>
      <div class="pick-grid">${boxes}</div>`;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
