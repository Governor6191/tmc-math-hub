// Coding Lab: a calm, untimed home for a course's `code` questions. Lists every
// coding problem in the course, and lets the student write/run/check Python in
// the browser. Work and best score persist per problem on this device.

import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, findCourse } from './catalog.js';
import { codeCardHtml, mountCode } from './code-render.js';
import { renderMathIn } from './math-render.js';

renderChrome();
const root = document.getElementById('lab');
const params = new URLSearchParams(location.search);
const courseId = params.get('c');
const problemId = params.get('p');

const keyFor = (cid, qid) => `tmc.v1.lab.${cid}.${qid}`;
function loadSaved(cid, qid) {
  try { return JSON.parse(localStorage.getItem(keyFor(cid, qid))) || {}; }
  catch { return {}; }
}
function saveState(cid, qid, patch) {
  const next = { ...loadSaved(cid, qid), ...patch };
  try { localStorage.setItem(keyFor(cid, qid), JSON.stringify(next)); } catch { /* private mode */ }
}

function firstLine(stem) {
  const line = String(stem || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || 'Problem';
  const clean = line.replace(/[*_`#>]/g, '').trim();
  return clean.length > 90 ? clean.slice(0, 88) + '…' : clean;
}

async function loadCodeProblems(course) {
  const out = [];
  for (const t of course.topics || []) {
    if (!t.questionFile) continue;
    try {
      const res = await fetch(t.questionFile);
      if (!res.ok) continue;
      const bank = await res.json();
      if (bank.status !== 'approved') continue;
      for (const q of bank.questions) {
        if (q.format === 'code') out.push({ ...q, topicTitle: t.title });
      }
    } catch { /* skip a missing or malformed bank */ }
  }
  return out;
}

function crumb(course) {
  return `<p class="crumb"><a href="index.html">Library</a> · <a href="course.html?c=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a> · Coding lab</p>`;
}

function renderList(course, problems) {
  document.title = `Coding Lab · ${course.title} - TMC Math Hub`;
  const items = problems.map(p => {
    const st = loadSaved(course.id, p.id);
    const tag = st.best === 1
      ? '<span class="lab-tag is-solved">Solved</span>'
      : (st.code ? '<span class="lab-tag is-progress">In progress</span>' : '');
    return `<a class="lab-item" href="lab.html?c=${encodeURIComponent(course.id)}&p=${encodeURIComponent(p.id)}">
      <span class="lab-item-text"><strong>${escapeHtml(firstLine(p.stem))}</strong>
      <span class="hint">${escapeHtml(p.topicTitle)} · ${escapeHtml(p.difficulty)}</span></span>
      ${tag}
    </a>`;
  }).join('');
  root.innerHTML = `
    ${crumb(course)}
    <h1>Coding Lab</h1>
    <p class="lab-intro">Write Python here, run it, and check it against the tests, all in your browser. Nothing is timed and your work saves on this device, so experiment freely.</p>
    ${problems.length
      ? `<div class="lab-list">${items}</div>`
      : '<p class="hint">No coding problems for this course yet. Check back soon.</p>'}`;
}

function renderProblem(course, p) {
  document.title = `${firstLine(p.stem)} · Coding Lab - TMC Math Hub`;
  const st = loadSaved(course.id, p.id);
  root.innerHTML = `
    ${crumb(course)}
    <p class="lab-back"><a href="lab.html?c=${encodeURIComponent(course.id)}">← All problems</a></p>
    <article class="quiz-card lab-card">
      <p class="lab-meta hint">${escapeHtml(p.topicTitle)} · ${escapeHtml(p.difficulty)}</p>
      ${codeCardHtml(p, { savedCode: st.code })}
      ${p.explanation ? `<details class="lab-notes"><summary>Notes</summary><div class="explain">${escapeHtml(p.explanation)}</div></details>` : ''}
    </article>`;
  renderMathIn(root);
  const card = root.querySelector('.quiz-card');
  const handle = mountCode(card, p, {
    revealSolution: true,
    onEdit: code => saveState(course.id, p.id, { code }),
    onGraded: graded => saveState(course.id, p.id, {
      code: handle.getCode(),
      best: Math.max(loadSaved(course.id, p.id).best || 0, graded.score),
    }),
  });
}

(async () => {
  try {
    const catalog = await loadCatalog();
    const hit = courseId ? findCourse(catalog, courseId) : null;
    if (!hit) {
      root.innerHTML = `<div class="error"><p>We couldn't find that course.
        <a href="index.html">Back to the library</a>.</p></div>`;
      return;
    }
    const problems = await loadCodeProblems(hit.course);
    const chosen = problemId ? problems.find(x => x.id === problemId) : null;
    if (chosen) renderProblem(hit.course, chosen);
    else renderList(hit.course, problems);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The coding lab failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
