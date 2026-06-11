import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, findCourse } from './catalog.js';
import { drawQuestions, shuffleOptions, mark, tally } from './quiz-engine.js';
import { recordAnswer, getProgress, isAvailable } from './progress.js';
import { renderMathIn } from './math-render.js';

renderChrome();
const root = document.getElementById('practice');
const params = new URLSearchParams(location.search);
const courseId = params.get('c');
const topicId = params.get('t');
const draftMode = params.get('draft') === '1';

const SESSION_SIZE = 10;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function bankUrl(course, topic) {
  if (draftMode) return `data/questions/${course.id}/drafts/${topic.id}.json`;
  return topic.questionFile;
}

async function loadBanks(course) {
  const topics = course.topics.filter(t => (topicId ? t.id === topicId : true));
  const questions = [];
  for (const t of topics) {
    const url = bankUrl(course, t);
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bank = await res.json();
      if (!draftMode && bank.status !== 'approved') continue;
      questions.push(...bank.questions.map(q => ({ ...q, topicId: t.id, topicTitle: t.title })));
    } catch { /* a missing draft bank is normal; skip it */ }
  }
  return questions;
}

function renderSession(course, year, semester, pool) {
  const queue = drawQuestions(pool, SESSION_SIZE);
  const results = [];
  let index = 0;

  function header() {
    const t = tally(results);
    return `
      <p class="crumb"><a href="index.html">Library</a> ·
        <a href="course.html?c=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a> ·
        Practice${topicId ? ` · ${escapeHtml(queue[0]?.topicTitle ?? topicId)}` : ''}</p>
      ${draftMode ? `<div class="draft-banner">Draft preview. These questions are not reviewed yet and your answers are not saved.</div>` : ''}
      <div class="quiz-head">
        <h1>Question ${index + 1} of ${queue.length}</h1>
        <span class="quiz-tally">${t.correct}/${t.answered} correct</span>
      </div>`;
  }

  function showQuestion() {
    const q = queue[index];
    const shuffled = shuffleOptions(q);
    root.innerHTML = `
      ${header()}
      <div class="quiz-card">
        <p class="quiz-stem">${escapeHtml(q.stem)}</p>
        <ul class="quiz-options">
          ${shuffled.options.map((opt, i) => `
            <li><button class="option-btn" data-i="${i}">
              <span class="option-letter">${LETTERS[i]}</span><span>${escapeHtml(opt)}</span>
            </button></li>`).join('')}
        </ul>
        <div id="feedback"></div>
      </div>`;
    renderMathIn(root);

    root.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', () => {
      const chosen = Number(btn.dataset.i);
      const result = mark(shuffled, chosen);
      results.push({ correct: result.correct });
      if (!draftMode) recordAnswer(course.id, q.id, result.correct);

      root.querySelectorAll('.option-btn').forEach((b, i) => {
        b.disabled = true;
        if (i === result.correctIndex) b.classList.add('is-correct');
        else if (i === chosen && !result.correct) b.classList.add('is-wrong');
      });

      const last = index === queue.length - 1;
      document.getElementById('feedback').innerHTML = `
        <div class="explanation">
          <p class="verdict ${result.correct ? 'right' : 'wrong'}">${result.correct ? 'Correct.' : 'Not quite.'}</p>
          <div>${escapeHtml(q.explanation)}</div>
        </div>
        <div class="quiz-next">
          <span class="hint">${escapeHtml(q.topicTitle)} · ${escapeHtml(q.difficulty)}</span>
          <button class="next-btn" id="next">${last ? 'See results' : 'Next question'}</button>
        </div>`;
      renderMathIn(document.getElementById('feedback'));
      document.querySelector('.quiz-head .quiz-tally').textContent =
        `${tally(results).correct}/${tally(results).answered} correct`;
      document.getElementById('next').addEventListener('click', () => {
        index++;
        if (index < queue.length) showQuestion();
        else showSummary();
      });
      document.getElementById('next').focus();
    }));
  }

  function showSummary() {
    const t = tally(results);
    const prog = !draftMode && isAvailable() ? getProgress(course.id) : null;
    root.innerHTML = `
      ${header()}
      <div class="quiz-card quiz-summary">
        <p class="score">${t.correct}/${t.answered}</p>
        <p>${t.percent >= 80 ? 'Strong work.' : t.percent >= 50 ? 'Solid. The explanations you just read are the gold.' : 'Rough round. Read the worked solutions and go again.'}</p>
        ${prog ? `<p class="hint">All time on this device: ${prog.attempted} questions tried in ${escapeHtml(course.title)}.</p>` : ''}
        <div class="quiz-next" style="justify-content: center;">
          <button class="next-btn" id="again">Practice ${queue.length} more</button>
          <a href="course.html?c=${encodeURIComponent(course.id)}">Back to ${escapeHtml(course.title)}</a>
        </div>
      </div>`;
    document.getElementById('again').addEventListener('click', () => renderSession(course, year, semester, pool));
  }

  showQuestion();
}

(async () => {
  try {
    const catalog = await loadCatalog();
    const hit = courseId ? findCourse(catalog, courseId) : null;
    if (!hit) {
      root.innerHTML = `<div class="error"><p>We couldn't find that course. <a href="index.html">Back to the library</a>.</p></div>`;
      return;
    }
    document.title = `Practice: ${hit.course.title} - TMC Math Hub`;
    const pool = await loadBanks(hit.course);
    if (pool.length === 0) {
      root.innerHTML = `<div class="error"><p>No practice questions are live for this course yet. They are coming.
        <a href="course.html?c=${encodeURIComponent(hit.course.id)}">Back to ${escapeHtml(hit.course.title)}</a>.</p></div>`;
      return;
    }
    renderSession(hit.course, hit.year, hit.semester, pool);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>Practice failed to load. Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
