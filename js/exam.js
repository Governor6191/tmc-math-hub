import { renderChrome, escapeHtml } from './app.js';
import { loadCatalog, findCourse } from './catalog.js';
import { createAttempt, remainingMs, answerQuestion, toggleFlag, answeredCount, scoreAttempt } from './exam-state.js';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, recordAttempt } from './exam-store.js';
import { renderMathIn } from './math-render.js';
import { gradeCloze } from './cloze-engine.js';
import { solutionHtml, readGapValues, markGaps } from './cloze-render.js';

renderChrome();
const root = document.getElementById('exam');
const params = new URLSearchParams(location.search);
const courseId = params.get('c');
const draftMode = params.get('draft') === '1';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

let course = null;
let attempt = null;
let timerHandle = null;

function fmtClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

async function loadPool() {
  const questions = [];
  for (const t of course.topics) {
    const url = draftMode ? `data/questions/${course.id}/drafts/${t.id}.json` : t.questionFile;
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bank = await res.json();
      if (!draftMode && bank.status !== 'approved') continue;
      questions.push(...bank.questions.map(q => ({ ...q, topicTitle: t.title })));
    } catch { /* missing bank: skip */ }
  }
  return questions;
}

function checkpoint() {
  if (!draftMode) saveCheckpoint(attempt);
}

function startTimer() {
  stopTimer();
  timerHandle = setInterval(() => {
    const left = remainingMs(attempt);
    const el = document.getElementById('timer');
    if (el) {
      el.textContent = `Time left ${fmtClock(left)}`;
      el.classList.toggle('warn', left < 5 * 60 * 1000);
    }
    if (left <= 0) submitAttempt(true);
  }, 1000);
}

function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function draftBanner() {
  return draftMode ? `<div class="draft-banner">Draft preview exam. Questions are not reviewed yet; this attempt is not saved.</div>` : '';
}

function renderPreStart(pool) {
  root.innerHTML = `
    <p class="crumb"><a class="crumb-back" href="course.html?c=${encodeURIComponent(course.id)}" aria-label="Back to ${escapeHtml(course.title)}">&#8592;</a><a href="index.html">Library</a> ·
      <a href="course.html?c=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a> · Mock exam hall</p>
    <h1>Mock exam hall</h1>
    ${draftBanner()}
    <p>Pick a paper. The clock starts immediately, keeps running even if you refresh, and the
    exam submits itself at zero, just like the real thing. Flag anything you want to revisit.</p>
    ${course.examFormats.map(f => `
      <div class="format-card">
        <div>
          <h3>${escapeHtml(f.label)}</h3>
          <p class="format-meta">${Math.min(f.questions, pool.length)} questions · ${f.minutes} minutes</p>
        </div>
        <button class="next-btn" data-format="${escapeHtml(f.id)}">Attempt now</button>
      </div>`).join('')}
    <p class="hint">${pool.length} questions in the bank. Your attempt draws a random paper, so every attempt is different.</p>`;
  root.querySelectorAll('[data-format]').forEach(btn => btn.addEventListener('click', () => {
    const format = course.examFormats.find(f => f.id === btn.dataset.format);
    attempt = createAttempt(course.id, format, pool);
    checkpoint();
    renderExam();
    startTimer();
  }));
}

function navGrid() {
  return `
    <div class="exam-side">
      <h2>Quiz navigation</h2>
      <div class="nav-grid">
        ${attempt.questions.map((_, i) => `
          <button class="cell${i in attempt.answers ? ' answered' : ''}${i === attempt.current ? ' current' : ''}${attempt.flags[i] ? ' flagged' : ''}" data-goto="${i}">${i + 1}</button>`).join('')}
      </div>
      <div class="exam-legend">
        <span>filled: answered</span>
        <span>outlined: current</span>
        <span>red dot: flagged</span>
      </div>
      <button class="next-btn" id="finish" style="width: 100%; margin-top: 0.8rem;">Finish attempt…</button>
      <p class="hint" style="text-align: center; margin: 0.5rem 0 0;">auto-submits at 0:00</p>
    </div>`;
}

function renderExam() {
  const i = attempt.current;
  const q = attempt.questions[i];
  root.innerHTML = `
    <div class="exam-top">
      <strong>${escapeHtml(course.title)}: ${escapeHtml(attempt.formatLabel)} mock</strong>
      <span class="exam-timer" id="timer">Time left ${fmtClock(remainingMs(attempt))}</span>
    </div>
    ${draftBanner()}
    <div class="exam-layout">
      <div class="quiz-card">
        <div style="display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
          <p class="hint" style="margin: 0;">Question ${i + 1} of ${attempt.questions.length}${i in attempt.answers ? '' : ' · not yet answered'}</p>
          <button class="flag-btn${attempt.flags[i] ? ' on' : ''}" id="flag">${attempt.flags[i] ? 'Flagged' : 'Flag question'}</button>
        </div>
        <p class="quiz-stem">${escapeHtml(q.stem)}</p>
        ${q.format === 'cloze'
          ? solutionHtml(q)
          : `<ul class="quiz-options">
          ${q.options.map((opt, oi) => `
            <li><button class="option-btn${attempt.answers[i] === oi ? ' is-correct' : ''}" data-pick="${oi}">
              <span class="option-letter">${LETTERS[oi]}</span><span>${escapeHtml(opt)}</span>
            </button></li>`).join('')}
        </ul>`}
        <div class="quiz-next">
          <button class="read-btn" id="prev"${i === 0 ? ' disabled' : ''}>Previous</button>
          <button class="next-btn" id="next">${i === attempt.questions.length - 1 ? 'Go to summary' : 'Next'}</button>
        </div>
      </div>
      ${navGrid()}
    </div>`;
  renderMathIn(root);
  wireExamEvents();
}

function wireExamEvents() {
  root.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
    answerQuestion(attempt, attempt.current, Number(btn.dataset.pick));
    checkpoint();
    renderExam();
  }));
  root.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => {
    attempt.current = Number(btn.dataset.goto);
    checkpoint();
    renderExam();
  }));
  document.getElementById('flag').addEventListener('click', () => {
    toggleFlag(attempt, attempt.current);
    checkpoint();
    renderExam();
  });
  const prev = document.getElementById('prev');
  if (prev) prev.addEventListener('click', () => { attempt.current--; checkpoint(); renderExam(); });
  document.getElementById('next').addEventListener('click', () => {
    if (attempt.current === attempt.questions.length - 1) renderSummary();
    else { attempt.current++; checkpoint(); renderExam(); }
  });
  document.getElementById('finish').addEventListener('click', renderSummary);
  const cloze = root.querySelector('.cloze-solution');
  if (cloze) {
    const i = attempt.current;
    const saved = attempt.answers[i] || {};
    const save = () => { answerQuestion(attempt, i, readGapValues(cloze)); checkpoint(); };
    cloze.querySelectorAll('input.cloze-gap').forEach(el => {
      if (saved[el.dataset.gap] !== undefined) el.value = saved[el.dataset.gap];
      el.addEventListener('input', save);
      el.addEventListener('change', save);
    });
    cloze.querySelectorAll('.cloze-choices').forEach(grp => {
      const v = saved[grp.dataset.gap];
      grp.querySelectorAll('input[type="radio"]').forEach(r => {
        if (v !== undefined && r.value === v) r.checked = true;
        r.addEventListener('change', save);
      });
    });
  }
}

function renderSummary() {
  root.innerHTML = `
    <div class="exam-top">
      <strong>Summary of attempt</strong>
      <span class="exam-timer" id="timer">Time left ${fmtClock(remainingMs(attempt))}</span>
    </div>
    ${draftBanner()}
    <ul class="summary-list">
      ${attempt.questions.map((_, i) => `
        <li><span>Question ${i + 1}${attempt.flags[i] ? ' (flagged)' : ''}</span>
          <span class="summary-state${i in attempt.answers ? '' : ' unanswered'}">${i in attempt.answers ? 'Answered' : 'Not yet answered'}</span></li>`).join('')}
    </ul>
    <p>${answeredCount(attempt)} of ${attempt.questions.length} answered.</p>
    <div class="quiz-next">
      <button class="read-btn" id="return">Return to attempt</button>
      <button class="next-btn" id="submit">Submit all and finish</button>
    </div>
    <div id="confirm-zone"></div>`;
  document.getElementById('return').addEventListener('click', () => renderExam());
  document.getElementById('submit').addEventListener('click', () => {
    document.getElementById('confirm-zone').innerHTML = `
      <div class="error" style="margin-top: 1rem;">
        <p>Once you submit, you cannot change your answers.</p>
        <button class="next-btn" id="confirm">Submit all and finish</button>
      </div>`;
    document.getElementById('confirm').addEventListener('click', () => submitAttempt(false));
  });
}

function submitAttempt(auto) {
  if (attempt.submitted) return;
  attempt.submitted = true;
  stopTimer();
  const s = scoreAttempt(attempt);
  const minutesUsed = Math.min(attempt.durationMs, attempt.durationMs - remainingMs(attempt)) / 60000;
  if (!draftMode) {
    recordAttempt(attempt.courseId, {
      date: Date.now(), formatId: attempt.formatId,
      score: s.correct, total: s.total, minutesUsed: Math.round(minutesUsed),
    });
    clearCheckpoint();
  }
  renderResults(s, auto);
}

function renderResults(s, auto) {
  const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  root.innerHTML = `
    <h1>Results: ${escapeHtml(course.title)}, ${escapeHtml(attempt.formatLabel)} mock</h1>
    ${draftBanner()}
    ${auto ? `<div class="draft-banner">Time ran out, so the attempt was submitted automatically.</div>` : ''}
    <div class="quiz-card quiz-summary">
      <p class="score">${Number.isInteger(s.correct) ? s.correct : s.correct.toFixed(1)}/${s.total}</p>
      <p>${pct}%. ${pct >= 70 ? 'Exam-room ready.' : pct >= 50 ? 'Getting there. Work the review below.' : 'The review below is where the marks are. Read every explanation.'}</p>
      <div class="quiz-next" style="justify-content: center;">
        <a href="exam.html?c=${encodeURIComponent(course.id)}${draftMode ? '&draft=1' : ''}">Take another paper</a>
        <a href="course.html?c=${encodeURIComponent(course.id)}">Back to ${escapeHtml(course.title)}</a>
      </div>
    </div>
    <h2>Review</h2>
    ${attempt.questions.map((q, i) => {
      if (q.format === 'cloze') {
        const graded = gradeCloze(q, attempt.answers[i] || {});
        return `
      <article class="review-q">
        <p class="meta">Question ${i + 1} · ${escapeHtml(q.topicTitle)} · ${escapeHtml(q.difficulty)}${attempt.flags[i] ? ' · flagged' : ''} · ${graded.correctCount}/${graded.total} blanks</p>
        <p class="quiz-stem">${escapeHtml(q.stem)}</p>
        <div data-review-cloze="${i}">${solutionHtml(q)}</div>
        <div class="explanation"><div>${escapeHtml(q.explanation)}</div></div>
      </article>`;
      }
      const chosen = attempt.answers[i];
      return `
      <article class="review-q">
        <p class="meta">Question ${i + 1} · ${escapeHtml(q.topicTitle)} · ${escapeHtml(q.difficulty)}${attempt.flags[i] ? ' · flagged' : ''}</p>
        <p class="quiz-stem">${escapeHtml(q.stem)}</p>
        <ul class="quiz-options">
          ${q.options.map((opt, oi) => `
            <li><span class="option-btn${oi === q.answerIndex ? ' is-correct' : ''}${chosen === oi && chosen !== q.answerIndex ? ' is-wrong' : ''}" style="cursor: default;">
              <span class="option-letter">${LETTERS[oi]}</span><span>${escapeHtml(opt)}</span>
            </span></li>`).join('')}
        </ul>
        <p class="hint" style="margin: 0.4rem 0;">${chosen === undefined ? 'Not answered.' : chosen === q.answerIndex ? 'Your answer was correct.' : `Your answer: ${LETTERS[chosen]}. Correct answer: ${LETTERS[q.answerIndex]}.`}</p>
        <div class="explanation"><div>${escapeHtml(q.explanation)}</div></div>
      </article>`;
    }).join('')}`;
  renderMathIn(root);
  root.querySelectorAll('[data-review-cloze]').forEach(div => {
    const i = Number(div.dataset.reviewCloze);
    const q = attempt.questions[i];
    const saved = attempt.answers[i] || {};
    div.querySelectorAll('input.cloze-gap').forEach(el => { if (saved[el.dataset.gap] !== undefined) el.value = saved[el.dataset.gap]; });
    div.querySelectorAll('.cloze-choices').forEach(grp => { const v = saved[grp.dataset.gap]; if (v !== undefined) grp.querySelectorAll('input[type="radio"]').forEach(r => { if (r.value === v) r.checked = true; }); });
    markGaps(div, gradeCloze(q, saved));
  });
  renderMathIn(root);
}

(async () => {
  try {
    const catalog = await loadCatalog();
    const hit = courseId ? findCourse(catalog, courseId) : null;
    if (!hit) {
      root.innerHTML = `<div class="error"><p>We couldn't find that course. <a href="index.html">Back to the library</a>.</p></div>`;
      return;
    }
    course = hit.course;
    document.title = `Mock exam: ${course.title} - TMC Math Hub`;
    const pool = await loadPool();
    if (pool.length === 0) {
      root.innerHTML = `<div class="error"><p>No exam questions are live for this course yet. They are coming.
        <a href="course.html?c=${encodeURIComponent(course.id)}">Back to ${escapeHtml(course.title)}</a>.</p></div>`;
      return;
    }
    const saved = draftMode ? null : loadCheckpoint();
    if (saved && saved.courseId === course.id && !saved.submitted) {
      attempt = saved;
      if (remainingMs(attempt) <= 0) { submitAttempt(true); return; }
      renderExam();
      startTimer();
      return;
    }
    renderPreStart(pool);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>The exam hall failed to load. Check your connection, then <a href="">reload the page</a>.</p></div>`;
  }
})();
