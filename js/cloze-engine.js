// Pure grading logic for Cloze (fill in the blank) questions. No DOM, no fetch.
// Runs in browsers and Node, mirrors quiz-engine.js.

export function splitSolution(template) {
  const segments = [];
  const re = /\{\{(\d+)\}\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(template)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: template.slice(last, m.index) });
    segments.push({ type: 'gap', id: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < template.length) segments.push({ type: 'text', value: template.slice(last) });
  return segments;
}

export function normalizeText(s) {
  return String(s).replace(/\s+/g, '');
}

export function gradeGap(gap, raw) {
  if (gap.type === 'number') {
    const v = parseFloat(String(raw).trim());
    if (!Number.isFinite(v)) return false;
    const tol = Number.isFinite(gap.tolerance) ? gap.tolerance : 0;
    return Math.abs(v - gap.answer) <= tol;
  }
  if (gap.type === 'dropdown') return raw === gap.answer;
  if (gap.type === 'text') return (gap.accept || []).map(normalizeText).includes(normalizeText(raw));
  return false;
}

export function correctDisplay(gap) {
  if (gap.type === 'number') return String(gap.answer);
  if (gap.type === 'dropdown') return gap.answer;
  if (gap.type === 'text') return (gap.accept || [])[0] ?? '';
  return '';
}

export function gradeCloze(question, values = {}) {
  const gaps = question.gaps.map(gap => ({
    id: gap.id,
    correct: gradeGap(gap, values[gap.id]),
    given: values[gap.id],
    correctDisplay: correctDisplay(gap),
  }));
  const total = gaps.length;
  const correctCount = gaps.filter(g => g.correct).length;
  return { gaps, correctCount, total, score: total ? correctCount / total : 0, allCorrect: correctCount === total };
}
