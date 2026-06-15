// DOM building for Cloze questions, shared by practice and exam.
// No grading here (see cloze-engine.js): this only renders the gapped
// solution, reads the inputs, and marks them after grading.
//
// Number and text gaps render as <input class="cloze-gap">. Dropdown gaps
// render as a group of selectable chips (radio labels) so their math can be
// KaTeX-rendered, which a native <select><option> cannot do.

import { escapeHtml } from './app.js';
import { splitSolution } from './cloze-engine.js';
import { shuffle } from './quiz-engine.js';

function gapWidget(gap, shuffleDropdowns, qid) {
  if (gap.type === 'dropdown') {
    const opts = shuffleDropdowns ? shuffle(gap.options) : gap.options;
    const name = `clz-${escapeHtml(String(qid))}-${gap.id}`;
    return `<span class="cloze-choices" data-gap="${gap.id}" role="radiogroup" aria-label="blank ${gap.id}">` +
      opts.map(o => `<label class="cloze-choice"><input type="radio" name="${name}" value="${escapeHtml(o)}"><span>${escapeHtml(o)}</span></label>`).join('') +
      `</span>`;
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
    return gap ? gapWidget(gap, !!opts.shuffleDropdowns, question.id) : '';
  }).join('');
  return `<div class="cloze-solution">${html}</div>`;
}

// Read every gap's current value: typed inputs by their value, dropdown chip
// groups by the checked radio (empty string if none chosen).
export function readGapValues(container) {
  const values = {};
  container.querySelectorAll('input.cloze-gap').forEach(el => { values[Number(el.dataset.gap)] = el.value; });
  container.querySelectorAll('.cloze-choices').forEach(grp => {
    const checked = grp.querySelector('input[type="radio"]:checked');
    values[Number(grp.dataset.gap)] = checked ? checked.value : '';
  });
  return values;
}

// graded is the gradeCloze(...) result. Locks every gap, colors it, and shows
// the correct value after a wrong one.
export function markGaps(container, graded) {
  const byId = {};
  graded.gaps.forEach(g => { byId[g.id] = g; });

  container.querySelectorAll('input.cloze-gap').forEach(el => {
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

  container.querySelectorAll('.cloze-choices').forEach(grp => {
    const g = byId[Number(grp.dataset.gap)];
    if (!g) return;
    grp.querySelectorAll('input[type="radio"]').forEach(r => { r.disabled = true; });
    const checked = grp.querySelector('input[type="radio"]:checked');
    if (checked) checked.closest('.cloze-choice').classList.add(g.correct ? 'is-correct' : 'is-wrong');
    if (!g.correct) {
      grp.querySelectorAll('.cloze-choice').forEach(lab => {
        if (lab.querySelector('input').value === g.correctDisplay) lab.classList.add('is-answer');
      });
    }
  });
}
