import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, courseStats } from './catalog.js';

renderChrome();
const root = document.getElementById('library');

function courseCard(c) {
  const st = courseStats(c);
  const meta = [`${st.files} files`];
  if (st.topics) meta.push(`${st.topics} topics`);
  if (st.videos) meta.push(`${st.videos} videos`);
  return `<li><a class="course-card" href="course.html?c=${encodeURIComponent(c.id)}">
    <span class="course-title">${escapeHtml(c.title)}</span>
    <span class="course-meta">${meta.join(' · ')}</span>
  </a></li>`;
}

function semesterBlock(s) {
  const untracked = s.courses.filter(c => !c.track);
  const tracks = [...new Set(s.courses.filter(c => c.track).map(c => c.track))].sort();
  let html = `<h3 class="sem">Semester ${s.semester}</h3>`;
  if (untracked.length) html += `<ul class="course-list">${untracked.map(courseCard).join('')}</ul>`;
  for (const t of tracks) {
    html += `<p class="track">${escapeHtml(t)} option</p>
      <ul class="course-list">${s.courses.filter(c => c.track === t).map(courseCard).join('')}</ul>`;
  }
  return html;
}

try {
  const catalog = await loadCatalog();
  root.innerHTML = catalog.years.map(y => `
    <section class="year">
      <h2>Year ${y.year}</h2>
      ${y.semesters.map(semesterBlock).join('')}
    </section>`).join('');
} catch (err) {
  console.error(err);
  root.innerHTML = `<div class="error"><p>The course catalog failed to load.
    Check your connection, then <a href="">reload the page</a>.</p></div>`;
}
