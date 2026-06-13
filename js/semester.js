import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, courseStats } from './catalog.js';

renderChrome();
const root = document.getElementById('semester-root');
const params = new URLSearchParams(location.search);
const yearNum = Number(params.get('y'));
const semNum = Number(params.get('s'));

function courseCard(c) {
  const st = courseStats(c);
  const meta = [`${st.files} file${st.files === 1 ? '' : 's'}`];
  if (st.topics) meta.push(`${st.topics} topics`);
  if (st.videos) meta.push(`${st.videos} videos`);
  if (st.questions) meta.push(`${st.questions} questions`);
  return `<li><a class="course-card" href="course.html?c=${encodeURIComponent(c.id)}">
    <span class="course-title">${escapeHtml(c.title)}</span>
    <span class="course-meta">${meta.join(' · ')}</span>
  </a></li>`;
}

function courseList(courses) {
  const untracked = courses.filter(c => !c.track);
  const tracks = [...new Set(courses.filter(c => c.track).map(c => c.track))].sort();
  let html = '';
  if (untracked.length) html += `<ul class="course-list">${untracked.map(courseCard).join('')}</ul>`;
  for (const t of tracks) {
    html += `<p class="track">${escapeHtml(t)} option</p>
      <ul class="course-list">${courses.filter(c => c.track === t).map(courseCard).join('')}</ul>`;
  }
  return html;
}

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    const year = catalog.years.find(y => y.year === yearNum);
    const sem = year && year.semesters.find(s => s.semester === semNum);
    if (!year || !sem) {
      root.innerHTML = `<div class="error"><p>We couldn't find that semester.
        <a href="index.html">Back to the library</a>.</p></div>`;
      return;
    }
    document.title = `Year ${year.year}, Semester ${sem.semester} - TMC Math Hub`;
    root.innerHTML = `
      <p class="crumb"><a class="crumb-back" href="year.html?y=${year.year}" aria-label="Back to Year ${year.year}">&#8592;</a><a href="index.html">Library</a> · <a href="year.html?y=${year.year}">Year ${year.year}</a> · Semester ${sem.semester}</p>
      <h1>Year ${year.year}, Semester ${sem.semester}</h1>
      ${sem.courses.length ? courseList(sem.courses) : '<p class="hint">No courses listed yet.</p>'}`;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
