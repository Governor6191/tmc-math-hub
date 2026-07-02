import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, courseStats, coursesForGroup } from './catalog.js';
import { initReveals } from './reveal.js';

renderChrome();
const root = document.getElementById('semester-root');
const params = new URLSearchParams(location.search);
const yearNum = Number(params.get('y'));
const semNum = Number(params.get('s'));
const group = params.get('g');

function courseCard(c, i = 0) {
  const st = courseStats(c);
  const meta = [`${st.files} file${st.files === 1 ? '' : 's'}`];
  if (st.topics) meta.push(`${st.topics} topics`);
  if (st.videos) meta.push(`${st.videos} videos`);
  if (st.questions) meta.push(`${st.questions} questions`);
  return `<li><a class="course-card" data-reveal style="--reveal-delay: ${Math.min(i, 7) * 60}ms" href="course.html?c=${encodeURIComponent(c.id)}">
    <span class="course-title">${escapeHtml(c.title)}</span>
    <span class="course-meta">${meta.join(' · ')}</span>
  </a></li>`;
}

function flatList(courses) {
  return `<ul class="course-list">${courses.map(courseCard).join('')}</ul>`;
}

// Fallback for a direct semester link with no group on a streamed year:
// group untracked courses first, then each stream under its own label.
function groupedList(courses) {
  const untracked = courses.filter(c => !c.track);
  const tracks = [...new Set(courses.filter(c => c.track).map(c => c.track))].sort();
  let html = '';
  if (untracked.length) html += flatList(untracked);
  for (const t of tracks) {
    html += `<p class="track">${escapeHtml(t)} option</p>${flatList(courses.filter(c => c.track === t))}`;
  }
  return html;
}

function notFound() {
  root.innerHTML = `<div class="error"><p>We couldn't find that semester.
    <a href="index.html">Back to the library</a>.</p></div>`;
}

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    const year = catalog.years.find(y => y.year === yearNum);
    const sem = year && year.semesters.find(s => s.semester === semNum);
    if (!year || !sem) { notFound(); return; }

    const crumb = group
      ? `<p class="crumb"><a class="crumb-back" href="year.html?y=${year.year}&amp;g=${encodeURIComponent(group)}" aria-label="Back to ${escapeHtml(group)} semesters">&#8592;</a><a href="index.html">Library</a> · <a href="year.html?y=${year.year}">Year ${year.year}</a> · <a href="year.html?y=${year.year}&amp;g=${encodeURIComponent(group)}">${escapeHtml(group)}</a> · Semester ${sem.semester}</p>`
      : `<p class="crumb"><a class="crumb-back" href="year.html?y=${year.year}" aria-label="Back to Year ${year.year}">&#8592;</a><a href="index.html">Library</a> · <a href="year.html?y=${year.year}">Year ${year.year}</a> · Semester ${sem.semester}</p>`;
    const heading = group
      ? `Year ${year.year} · ${escapeHtml(group)}, Semester ${sem.semester}`
      : `Year ${year.year}, Semester ${sem.semester}`;
    document.title = group
      ? `${group}, Year ${year.year} Semester ${sem.semester} - TMC Math Hub`
      : `Year ${year.year}, Semester ${sem.semester} - TMC Math Hub`;

    const shown = group ? coursesForGroup(sem.courses, group) : sem.courses;
    const body = shown.length
      ? (group ? flatList(shown) : groupedList(shown))
      : '<p class="hint">No courses listed yet.</p>';

    root.innerHTML = `${crumb}<h1>${heading}</h1>${body}`;
    initReveals();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
