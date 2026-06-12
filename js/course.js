import { renderChrome, drivePreviewUrl, driveViewUrl, driveDownloadUrl, escapeHtml } from './app.js';
import { loadCatalog, findCourse, courseStats } from './catalog.js';
import { getProgress, isAvailable } from './progress.js';

renderChrome();
const root = document.getElementById('course');
const courseId = new URLSearchParams(location.search).get('c');

function fileRow(item) {
  const pathHint = item.path ? ` <span class="pdf-path">${escapeHtml(item.path)}</span>` : '';
  return `<li class="pdf-row">
    <span class="pdf-title">${escapeHtml(item.title)}${pathHint}</span>
    <span class="pdf-actions">
      <button class="read-btn" data-file="${escapeHtml(item.driveFileId)}" data-title="${escapeHtml(item.title)}">Read here</button>
      <a href="${driveDownloadUrl(escapeHtml(item.driveFileId))}">Download</a>
    </span>
  </li>`;
}

function section(title, items) {
  if (!items.length) return '';
  return `<section><h2>${title}</h2><ul class="pdf-list">${items.map(fileRow).join('')}</ul></section>`;
}

function render(course, year, semester) {
  const prog = isAvailable() ? getProgress(course.id) : null;
  const attemptedLine = prog && prog.attempted > 0
    ? ` You have answered ${prog.attempted} on this device.` : '';
  const st = courseStats(course);
  const practice = course.materials.filter(m => m.kind === 'practice');
  const textbooks = course.materials.filter(m => m.kind === 'textbook');
  const others = course.materials.filter(m => m.kind !== 'practice' && m.kind !== 'textbook');

  root.innerHTML = `
    <p class="crumb"><a href="index.html">Library</a> · Year ${year} · Semester ${semester}${course.track ? ` · ${escapeHtml(course.track)} option` : ''}</p>
    <h1>${escapeHtml(course.title)}</h1>
    <p class="badges">
      ${st.topics ? `<span class="badge">${st.topics} topic${st.topics === 1 ? '' : 's'}</span>` : ''}
      <span class="badge">${st.files} file${st.files === 1 ? '' : 's'}</span>
      ${st.questions ? `<span class="badge">${st.questions} questions</span>` : ''}
      ${st.videos ? `<span class="badge">${st.videos} videos</span>` : ''}
    </p>

    <section class="viewer" id="viewer" tabindex="-1" hidden>
      <div class="viewer-head">
        <strong id="viewer-title"></strong>
        <span class="viewer-links">
          <a id="viewer-download" href="#">Download</a>
          <a id="viewer-open" href="#" target="_blank" rel="noopener">Open in Drive</a>
        </span>
      </div>
      <iframe id="viewer-frame" title="Document viewer"></iframe>
      <p class="viewer-note">Trouble viewing, or want it offline? Use the links above.</p>
    </section>

    ${course.topics.length ? `<section><h2>Topics</h2>${course.topics.map(t => `
      <article class="topic">
        <h3>${escapeHtml(t.title)}</h3>
        <ul class="pdf-list">${t.slides.map(fileRow).join('')}</ul>
        ${t.questionCount ? `<p><a href="practice.html?c=${encodeURIComponent(course.id)}&t=${encodeURIComponent(t.id)}">Practice ${t.questionCount} questions on ${escapeHtml(t.title)}</a></p>` : ''}
        ${t.videos.length ? `<div class="videos">${t.videos.map(v => `
          <figure class="video">
            <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtubeId)}"
              title="${escapeHtml(v.title)}" loading="lazy" allowfullscreen></iframe>
            <figcaption>${escapeHtml(v.title)}</figcaption>
          </figure>`).join('')}</div>`
        : `<p class="hint">Video lessons for this topic are coming.</p>`}
      </article>`).join('')}</section>` : ''}

    ${section('Practice sheets &amp; assignments', practice)}
    ${section('Textbooks', textbooks)}
    ${section(course.topics.length ? 'Other files' : 'Slides &amp; files', others)}

    <section class="coming" aria-label="Coming soon">
      ${st.questions ? `
      <div class="coming-card"><h3>Practice questions</h3>
        <p>${st.questions} questions with instant marking and worked solutions.${attemptedLine}</p>
        <a class="next-btn" style="display: inline-block; text-decoration: none;" href="practice.html?c=${encodeURIComponent(course.id)}">Start practice</a></div>`
      : `
      <div class="coming-card"><h3>Practice questions</h3>
        <p>Hundreds of trial questions with instant marking and worked solutions.</p>
        <span class="badge soon">Coming soon</span></div>`}
      ${st.questions ? `
      <div class="coming-card"><h3>Mock exam hall</h3>
        <p>Timed, Moodle-style trial exams drawn from ${st.questions} questions. Feel the real format before exam day.</p>
        <a class="next-btn" style="display: inline-block; text-decoration: none;" href="exam.html?c=${encodeURIComponent(course.id)}">Enter exam hall</a></div>`
      : `
      <div class="coming-card"><h3>Mock exam hall</h3>
        <p>Timed, Moodle-style trial exams. Feel the real format before exam day.</p>
        <span class="badge soon">Coming soon</span></div>`}
    </section>`;
}

root.addEventListener('click', e => {
  const btn = e.target.closest('.read-btn');
  if (!btn) return;
  document.getElementById('viewer-title').textContent = btn.dataset.title;
  document.getElementById('viewer-download').href = driveDownloadUrl(btn.dataset.file);
  document.getElementById('viewer-open').href = driveViewUrl(btn.dataset.file);
  document.getElementById('viewer-frame').src = drivePreviewUrl(btn.dataset.file);
  const viewer = document.getElementById('viewer');
  viewer.hidden = false;
  viewer.focus({ preventScroll: true });
  viewer.scrollIntoView({ block: 'start' });
});

// async IIFE rather than top-level await: old mobile browsers that can't parse
// top-level await would otherwise reject the whole module, chrome included
(async () => {
  try {
    const catalog = await loadCatalog();
    const hit = courseId ? findCourse(catalog, courseId) : null;
    if (!hit) {
      root.innerHTML = `<div class="error"><p>We couldn't find that course.
        <a href="index.html">Back to the library</a>.</p></div>`;
    } else {
      document.title = `${hit.course.title} - TMC Math Hub`;
      render(hit.course, hit.year, hit.semester);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The course catalog failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
