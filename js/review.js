import { renderChrome, escapeHtml } from './app.js';
import { renderMathIn } from './math-render.js';

renderChrome();
const root = document.getElementById('review');
const params = new URLSearchParams(location.search);
const courseId = params.get('course');
const topicId = params.get('bank');
const SAFE = /^[a-z0-9-]+$/;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

(async () => {
  if (!SAFE.test(courseId ?? '') || !SAFE.test(topicId ?? '')) {
    root.innerHTML = `<div class="error"><p>Usage: review.html?course=calculus-i&bank=limits</p></div>`;
    return;
  }
  try {
    // drafts first; promoted banks live one level up, so reviews keep working after promotion
    let res = await fetch(`data/questions/${courseId}/drafts/${topicId}.json`);
    if (!res.ok) res = await fetch(`data/questions/${courseId}/${topicId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bank = await res.json();
    const counts = { warmup: 0, core: 0, stretch: 0 };
    bank.questions.forEach(q => { counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1; });
    const isDraft = bank.status === 'draft';
    document.title = `Review ${courseId}/${topicId} - TMC Math Hub`;
    root.innerHTML = `
      <h1>${isDraft ? 'Draft review' : 'Bank review'}: ${escapeHtml(courseId)} / ${escapeHtml(topicId)}</h1>
      <div class="draft-banner">Internal page. ${bank.questions.length} questions
        (${counts.warmup} warmup, ${counts.core} core, ${counts.stretch} stretch). Status: ${escapeHtml(bank.status)}.
        Correct answers are highlighted.${isDraft ? ` To publish: tell Claude to promote this bank, or run
        node tools/promote-bank.js ${escapeHtml(courseId)} ${escapeHtml(topicId)}` : ' This bank is live for students.'}</div>
      ${bank.questions.map((q, n) => `
        <article class="review-q">
          <p class="meta">${escapeHtml(q.id)} · ${escapeHtml(q.difficulty)} · ${escapeHtml(q.source)}</p>
          <p class="quiz-stem"><strong>Q${n + 1}.</strong> ${escapeHtml(q.stem)}</p>
          <ul class="quiz-options">
            ${q.options.map((opt, i) => `
              <li><span class="option-btn${i === q.answer ? ' is-correct' : ''}" style="cursor: default;">
                <span class="option-letter">${LETTERS[i]}</span><span>${escapeHtml(opt)}</span>
              </span></li>`).join('')}
          </ul>
          <div class="explanation"><div>${escapeHtml(q.explanation)}</div></div>
        </article>`).join('')}`;
    renderMathIn(root);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error"><p>No draft bank at data/questions/${escapeHtml(courseId)}/drafts/${escapeHtml(topicId)}.json</p></div>`;
  }
})();
