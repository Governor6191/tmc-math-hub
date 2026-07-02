// C Coding Lab controller. Lives at /clab/ (cross-origin isolated so the Wasmer
// clang runtime can use SharedArrayBuffer). Lists a course's C `code` questions
// and lets the student write, compile and run real C, checked against tests.
// Work and best score persist per problem on this device. Mirrors js/lab.js.

import { escapeHtml } from './app.js';
import { initReveals } from './reveal.js';
import { loadCatalog, findCourse } from './catalog.js';
import { cCardHtml, mountC } from './c-render.js';

const root = document.getElementById('clab');
const params = new URLSearchParams(location.search);
const courseId = params.get('c');
const problemId = params.get('p');

const keyFor = (cid, qid) => `tmc.v1.clab.${cid}.${qid}`;
function loadSaved(cid, qid) {
  try { return JSON.parse(localStorage.getItem(keyFor(cid, qid))) || {}; }
  catch { return {}; }
}
function saveState(cid, qid, patch) {
  // The at timestamp lets cloud sync decide which device's code is newer.
  const next = { ...loadSaved(cid, qid), ...patch, at: Date.now() };
  try { localStorage.setItem(keyFor(cid, qid), JSON.stringify(next)); } catch { /* private mode */ }
}

function firstLine(stem) {
  const line = String(stem || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || 'Problem';
  const clean = line.replace(/[*_`#>]/g, '').trim();
  return clean.length > 90 ? clean.slice(0, 88) + '…' : clean;
}

async function loadCProblems(course) {
  const out = [];
  for (const t of course.topics || []) {
    if (!t.questionFile) continue;
    try {
      const res = await fetch('../' + t.questionFile);
      if (!res.ok) continue;
      const bank = await res.json();
      if (bank.status !== 'approved') continue;
      for (const q of bank.questions) {
        if (q.format === 'code' && q.language === 'c') out.push({ ...q, topicTitle: t.title });
      }
    } catch { /* skip a missing or malformed bank */ }
  }
  return out;
}

function crumb(course) {
  return `<p class="crumb"><a href="../index.html">Library</a> · <a href="../course.html?c=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a> · C coding lab</p>`;
}

function renderList(course, problems) {
  document.title = `C Coding Lab · ${course.title} - TMC Math Hub`;
  const items = problems.map((p, pi) => {
    const st = loadSaved(course.id, p.id);
    const tag = st.best === 1
      ? '<span class="lab-tag is-solved">Solved</span>'
      : (st.code ? '<span class="lab-tag is-progress">In progress</span>' : '');
    return `<a class="lab-item" data-reveal style="--reveal-delay: ${Math.min(pi, 7) * 60}ms" href="index.html?c=${encodeURIComponent(course.id)}&p=${encodeURIComponent(p.id)}">
      <span class="lab-item-text"><strong>${escapeHtml(firstLine(p.stem))}</strong>
      <span class="hint">${escapeHtml(p.topicTitle)} · ${escapeHtml(p.difficulty)}</span></span>
      ${tag}
    </a>`;
  }).join('');
  root.innerHTML = `
    ${crumb(course)}
    <h1>C Coding Lab</h1>
    <p class="lab-intro">Write real C here, compile it with clang and run it against the tests, all in your browser. The first compile downloads the compiler once (about 100MB) and is cached after. Nothing is timed and your work saves on this device.</p>
    ${problems.length
      ? `<div class="lab-list">${items}</div>`
      : '<p class="hint">No C problems for this course yet. Check back soon.</p>'}`;
  initReveals();
}

function renderProblem(course, p) {
  document.title = `${firstLine(p.stem)} · C Coding Lab - TMC Math Hub`;
  const st = loadSaved(course.id, p.id);
  root.innerHTML = `
    ${crumb(course)}
    <p class="lab-back"><a href="index.html?c=${encodeURIComponent(course.id)}">← All problems</a></p>
    <article class="quiz-card lab-card">
      <p class="lab-meta hint">${escapeHtml(p.topicTitle)} · ${escapeHtml(p.difficulty)}</p>
      ${cCardHtml(p, { savedCode: st.code })}
      ${p.explanation ? `<details class="lab-notes"><summary>Notes</summary><div class="explain">${escapeHtml(p.explanation)}</div></details>` : ''}
    </article>`;
  const card = root.querySelector('.quiz-card');
  const handle = mountC(card, p, {
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
    const catalog = await loadCatalog('../data/catalog.json');
    const hit = courseId ? findCourse(catalog, courseId) : null;
    if (!hit) {
      root.innerHTML = `<div class="error"><p>We couldn't find that course.
        <a href="../index.html">Back to the library</a>.</p></div>`;
      return;
    }
    const problems = await loadCProblems(hit.course);
    const chosen = problemId ? problems.find(x => x.id === problemId) : null;
    if (chosen) renderProblem(hit.course, chosen);
    else renderList(hit.course, problems);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The C coding lab failed to load.
      Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
