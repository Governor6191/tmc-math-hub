// DOM building for Cloze questions, shared by practice and exam.
// No grading here (see cloze-engine.js): this only renders the gapped
// solution, reads the inputs, and marks them after grading.

import { escapeHtml } from './app.js';
import { splitSolution } from './cloze-engine.js';
import { shuffle } from './quiz-engine.js';

function gapWidget(gap, shuffleDropdowns) {
  if (gap.type === 'dropdown') {
    const opts = shuffleDropdowns ? shuffle(gap.options) : gap.options;
    return `<select class="cloze-gap" data-gap="${gap.id}" aria-label="blank ${gap.id}">` +
      `<option value="">choose</option>` +
      opts.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('') +
      `</select>`;
  }
  const mode = gap.type === 'number' ? ' inputmode="decimal"' : '';
  return `<input type="text" class="cloze-gap" data-gap="${gap.id}" aria-label="blank ${gap.id}" autocomplete="off" autocapitalize="off" spellcheck="false"${mode} size="6">`;
}

// opts.shuffleDropdowns: shuffle dropdown options at render (practice shows a
// question once). The exam pre-shuffles in the attempt snapshot and passes false.
export function solutionHtml(question, opts = {}) {
  const html = splitSolution(question.solution).map(seg => {
    if (seg.type === 'text') return escapeHtml(seg.value);
    const gap = question.gaps.find(g => g.id === seg.id);
    return gap ? gapWidget(gap, !!opts.shuffleDropdowns) : '';
  }).join('');
  return `<div class="cloze-solution">${html}</div>`;
}

export function readGapValues(container) {
  const values = {};
  container.querySelectorAll('.cloze-gap').forEach(el => { values[Number(el.dataset.gap)] = el.value; });
  return values;
}

// graded is the gradeCloze(...) result. Disables inputs, colors each gap, and
// writes the correct value after a wrong one.
export function markGaps(container, graded) {
  const byId = {};
  graded.gaps.forEach(g => { byId[g.id] = g; });
  container.querySelectorAll('.cloze-gap').forEach(el => {
    const g = byId[Number(el.dataset.gap)];
    if (!g) return;
    el.disabled = true;
    el.classList.add(g.correct ? 'is-correct' : 'is-wrong');
    if (!g.correct && !el.nextElementSibling?.classList?.contains('cloze-correct')) {
      const tag = document.createElement('span');
      tag.className = 'cloze-correct';
      tag.textContent = ` ${g.correctDisplay}`;
      el.insertAdjacentElement('afterend', tag);
    }
  });
}
