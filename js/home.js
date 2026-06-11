import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, courseStats } from './catalog.js';

renderChrome();
const root = document.getElementById('library');
const status = document.getElementById('library-status');

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

function semesterBlock(s) {
  const untracked = s.courses.filter(c => !c.track);
  const tracks = [...new Set(s.courses.filter(c => c.track).map(c => c.track))].sort();
  let html = `<h3 class="sem">Semester ${s.semester}</h3>`;
  if (s.courses.length === 0) {
    html += `<p class="hint">No courses listed yet.</p>`;
  } else {
    if (untracked.length) html += `<ul class="course-list">${untracked.map(courseCard).join('')}</ul>`;
    for (const t of tracks) {
      html += `<p class="track">${escapeHtml(t)} option</p>
        <ul class="course-list">${s.courses.filter(c => c.track === t).map(courseCard).join('')}</ul>`;
    }
  }
  return html;
}

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    root.innerHTML = catalog.years.map(y => `
      <section class="year">
        <h2>Year ${y.year}</h2>
        ${y.semesters.map(semesterBlock).join('')}
      </section>`).join('');
    if (status) status.textContent = '';
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
    if (status) status.textContent = 'The course catalog failed to load.';
  }
})();
