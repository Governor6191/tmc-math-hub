import { renderChrome, escapeHtml, codeHtml, confettiBurst } from './app.js';
import { tutorEnabled, openTutor, mountTutorFab } from './ai-tutor.js';
import { loadCatalog, findCourse } from './catalog.js';
import { drawQuestions, shuffleOptions, mark, tally } from './quiz-engine.js';
import { gradeCloze } from './cloze-engine.js';
import { solutionHtml, readGapValues, markGaps } from './cloze-render.js';
import { codeCardHtml, mountCode } from './code-render.js';
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
  const fmtCount = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  function header() {
    const t = tally(results);
    return `
      <p class="crumb"><a class="crumb-back" href="course.html?c=${encodeURIComponent(course.id)}" aria-label="Back to ${escapeHtml(course.title)}">&#8592;</a><a href="index.html">Library</a> ·
        <a href="course.html?c=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a> ·
        Practice${topicId ? ` · ${escapeHtml(queue[0]?.topicTitle ?? topicId)}` : ''}</p>
      ${draftMode ? `<div class="draft-banner">Draft preview. These questions are not reviewed yet and your answers are not saved.</div>` : ''}
      <div class="quiz-head">
        <h1>${index < queue.length ? `Question ${index + 1} of ${queue.length}` : 'Session complete'}</h1>
        <span class="quiz-tally">${fmtCount(t.correct)}/${t.answered} correct</span>
      </div>`;
  }

  function showQuestion() {
    const q = queue[index];
    if (q.format === 'cloze') { showCloze(q); return; }
    if (q.format === 'code') { showCode(q); return; }
    const shuffled = shuffleOptions(q);
    root.innerHTML = `
      ${header()}
      <div class="quiz-card">
        <p class="quiz-stem">${codeHtml(q.stem)}</p>
        <ul class="quiz-options">
          ${shuffled.options.map((opt, i) => `
            <li><button class="option-btn" data-i="${i}">
              <span class="option-letter">${LETTERS[i]}</span><span>${codeHtml(opt)}</span>
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
      const recap = result.correct ? '' :
        `<p class="answer-recap"><span class="recap-you">You chose ${LETTERS[chosen]}</span><span class="recap-arrow">&#8594;</span><span class="recap-ans">Answer: ${LETTERS[result.correctIndex]}</span></p>`;
      document.getElementById('feedback').innerHTML = `
        <div class="explanation ${result.correct ? 'is-right' : 'is-wrong'}">
          <p class="verdict ${result.correct ? 'right' : 'wrong'}">${result.correct ? 'Correct!' : 'Not quite.'}</p>
          ${recap}
          <p class="explain-label">Why</p>
          <div class="explain-body">${codeHtml(q.explanation)}</div>
          ${(!result.correct && tutorEnabled()) ? '<button class="ai-explain" id="ai-explain" type="button">Explain this with AI</button>' : ''}
        </div>
        <div class="quiz-next">
          <span class="hint">${escapeHtml(q.topicTitle)} · ${escapeHtml(q.difficulty)}</span>
          <button class="next-btn" id="next">${last ? 'See results' : 'Next question'}</button>
        </div>`;
      renderMathIn(document.getElementById('feedback'));
      const ax = document.getElementById('ai-explain');
      if (ax) ax.addEventListener('click', () => {
        const opts = shuffled.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n');
        openTutor(`I got this practice question wrong and want to understand it.\n\nQuestion: ${q.stem}\n\nOptions:\n${opts}\n\nI chose ${LETTERS[chosen]} but the correct answer is ${LETTERS[result.correctIndex]}. Explain simply why my choice is wrong and why the correct answer is right.`, true);
      });
      const tnow = tally(results);
      document.querySelector('.quiz-head .quiz-tally').textContent =
        `${fmtCount(tnow.correct)}/${tnow.answered} correct`;
      document.getElementById('next').addEventListener('click', () => {
        index++;
        if (index < queue.length) showQuestion();
        else showSummary();
      });
      document.getElementById('next').focus();
    }));
  }

  function showCloze(q) {
    root.innerHTML = `
      ${header()}
      <div class="quiz-card">
        <p class="quiz-stem">${codeHtml(q.stem)}</p>
        ${solutionHtml(q, { shuffleDropdowns: true })}
        <div class="quiz-next" style="margin-top: 1.1rem;">
          <span class="hint">Fill every blank, then check.</span>
          <button class="next-btn" id="check">Check</button>
        </div>
        <div id="feedback"></div>
      </div>`;
    renderMathIn(root);

    document.getElementById('check').addEventListener('click', () => {
      const graded = gradeCloze(q, readGapValues(root));
      markGaps(root, graded);
      renderMathIn(root);
      results.push({ score: graded.score });
      if (!draftMode) recordAnswer(course.id, q.id, graded.score);
      document.getElementById('check').disabled = true;

      const last = index === queue.length - 1;
      document.getElementById('feedback').innerHTML = `
        <div class="explanation">
          <p class="verdict ${graded.allCorrect ? 'right' : 'wrong'}">${graded.allCorrect ? 'All correct.' : `${graded.correctCount} of ${graded.total} blanks right.`}</p>
          <div>${codeHtml(q.explanation)}</div>
        </div>
        <div class="quiz-next">
          <span class="hint">${escapeHtml(q.topicTitle)} · ${escapeHtml(q.difficulty)}</span>
          <button class="next-btn" id="next">${last ? 'See results' : 'Next question'}</button>
        </div>`;
      renderMathIn(document.getElementById('feedback'));
      const t = tally(results);
      document.querySelector('.quiz-head .quiz-tally').textContent = `${fmtCount(t.correct)}/${t.answered} correct`;
      document.getElementById('next').addEventListener('click', () => {
        index++;
        if (index < queue.length) showQuestion();
        else showSummary();
      });
      document.getElementById('next').focus();
    });
  }

  function showCode(q) {
    root.innerHTML = `
      ${header()}
      <div class="quiz-card">
        ${codeCardHtml(q)}
        <div id="feedback"></div>
      </div>`;
    renderMathIn(root);
    mountCode(root.querySelector('.quiz-card'), q, { onGraded: (graded) => {
      results.push({ score: graded.score });
      if (!draftMode) recordAnswer(course.id, q.id, graded.score);
      const last = index === queue.length - 1;
      document.getElementById('feedback').innerHTML = `
        <div class="explanation">
          <p class="verdict ${graded.allCorrect ? 'right' : 'wrong'}">${graded.passed} of ${graded.total} tests passed.</p>
          <div>${codeHtml(q.explanation)}</div>
        </div>
        <div class="quiz-next">
          <span class="hint">${escapeHtml(q.topicTitle)} · ${escapeHtml(q.difficulty)}</span>
          <button class="next-btn" id="next">${last ? 'See results' : 'Next question'}</button>
        </div>`;
      renderMathIn(document.getElementById('feedback'));
      const t = tally(results);
      document.querySelector('.quiz-head .quiz-tally').textContent = `${fmtCount(t.correct)}/${t.answered} correct`;
      document.getElementById('next').addEventListener('click', () => {
        index++;
        if (index < queue.length) showQuestion();
        else showSummary();
      });
      document.getElementById('next').focus();
    } });
  }

  function showSummary() {
    const t = tally(results);
    const prog = !draftMode && isAvailable() ? getProgress(course.id) : null;
    const pct = t.answered ? Math.round((t.correct / t.answered) * 100) : 0;
    const C = 2 * Math.PI * 52;
    const msg = pct >= 80 ? 'Strong work!' : pct >= 50 ? 'Solid. The explanations you just read are the gold.' : 'Rough round. Read the worked solutions and go again.';
    root.innerHTML = `
      ${header()}
      <div class="quiz-card quiz-summary">
        <svg class="score-ring" width="150" height="150" viewBox="0 0 120 120" role="img" aria-label="Score ${pct} percent">
          <circle class="score-ring-track" cx="60" cy="60" r="52"></circle>
          <circle class="score-ring-fill" cx="60" cy="60" r="52" style="stroke-dasharray:${C.toFixed(1)}; stroke-dashoffset:${C.toFixed(1)};"></circle>
          <text class="score-ring-text" x="60" y="60" text-anchor="middle" dominant-baseline="central" font-size="27">${pct}%</text>
        </svg>
        <p class="score-sub" style="font-family: var(--font-mono); font-weight: 700; color: var(--mint); margin: 0 0 0.4rem;">${fmtCount(t.correct)} of ${t.answered} correct</p>
        <p>${msg}</p>
        ${prog ? `<p class="hint">All time on this device: ${prog.attempted} questions tried in ${escapeHtml(course.title)}.</p>` : ''}
        <div class="quiz-next" style="justify-content: center;">
          <button class="next-btn" id="again">Practice ${queue.length} more</button>
          <a href="course.html?c=${encodeURIComponent(course.id)}">Back to ${escapeHtml(course.title)}</a>
        </div>
      </div>`;
    const fill = root.querySelector('.score-ring-fill');
    if (fill) setTimeout(() => { fill.style.strokeDashoffset = (C * (1 - pct / 100)).toFixed(1); }, 60);
    if (pct >= 80) setTimeout(confettiBurst, 350);
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
    mountTutorFab();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>Practice failed to load. Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
