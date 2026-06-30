// DOM for a `code` question, shared by practice/exam/lab. Owns the editor, the
// Run/Check buttons, the output panel and the per-test result chips. Running and
// grading are delegated to python-runtime + code-engine; this file is the view.

import { escapeHtml, codeHtml } from './app.js';
import { renderMathIn } from './math-render.js';
import runCode from './python-runtime.js';
import { buildHarness, gradeCode } from './code-engine.js';

function escTA(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

export function codeCardHtml(question, { savedCode } = {}) {
  const code = savedCode != null ? savedCode : (question.starterCode || '');
  const examples = (question.tests || []).filter(t => !t.hidden).length;
  return `
    <p class="quiz-stem">${codeHtml(question.stem)}</p>
    <textarea class="code-editor" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Python code editor">${escTA(code)}</textarea>
    <div class="code-actions">
      <button class="next-btn code-run" type="button">Run</button>
      <button class="next-btn code-check" type="button">Check</button>
      <span class="hint code-hint">${examples} example test${examples === 1 ? '' : 's'} shown; more run on Check.</span>
    </div>
    <div class="code-output" aria-live="polite"></div>
    <div class="code-tests"></div>
    <div class="code-solution"></div>`;
}

export function testChipsHtml(graded, question, revealHidden) {
  const orig = {};
  (question.tests || []).forEach(t => { orig[t.name] = t; });
  return graded.tests
    .filter(t => revealHidden || !t.hidden)
    .map(t => {
      const mark = t.passed ? '✓' : '✗';
      const cls = t.passed ? 'is-pass' : 'is-fail';
      let detail;
      if (t.hidden) detail = 'hidden test';
      else {
        const o = orig[t.name];
        detail = escapeHtml(o && o.kind === 'function' ? o.call : t.name);
        if (!t.passed) detail += '  got ' + escapeHtml(t.got) + ', expected ' + escapeHtml(t.expected);
      }
      return `<div class="code-test ${cls}"><span class="mark">${mark}</span><span>${detail}</span></div>`;
    }).join('');
}

// Wires the editor + Run/Check. onGraded(graded) fires after Check. revealSolution
// shows the reference solution on Check (true for practice/lab, false mid-exam).
export function mountCode(root, question, { onGraded, onEdit, revealSolution = true } = {}) {
  const ta = root.querySelector('.code-editor');
  let cm = null;
  if (window.CodeMirror && ta) {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    cm = window.CodeMirror.fromTextArea(ta, { mode: 'python', lineNumbers: true, indentUnit: 4, theme: dark ? 'material-darker' : 'default' });
  }
  const getCode = () => (cm ? cm.getValue() : (ta ? ta.value : ''));
  if (onEdit) {
    if (cm) cm.on('change', () => onEdit(getCode()));
    else if (ta) ta.addEventListener('input', () => onEdit(getCode()));
  }

  const out = root.querySelector('.code-output');
  const testsEl = root.querySelector('.code-tests');
  const solEl = root.querySelector('.code-solution');
  const runBtn = root.querySelector('.code-run');
  const checkBtn = root.querySelector('.code-check');

  function showOutput(result) {
    const userLines = String(result.stdout || '').split('\n').filter(l => l.indexOf('@@TMC@@') === -1);
    let txt = userLines.join('\n').replace(/\n+$/, '');
    if (result.stderr) txt += (txt ? '\n' : '') + result.stderr.trim();
    if (result.error) txt += (txt ? '\n' : '') + result.error;
    out.classList.remove('code-loading');
    out.textContent = txt || '(no output)';
  }

  async function execute(all) {
    runBtn.disabled = true; checkBtn.disabled = true;
    out.classList.add('code-loading');
    out.textContent = 'Running...';
    const result = await runCode(buildHarness(question, getCode()), { onProgress: m => { out.textContent = m; } });
    showOutput(result);
    const graded = gradeCode(question, result.stdout, result.error || (result.timedOut ? 'timeout' : ''));
    testsEl.innerHTML = testChipsHtml(graded, question, all);
    if (all) {
      if (revealSolution) {
        solEl.innerHTML = `<p class="hint" style="margin-bottom:0.3rem;">Reference solution</p><pre class="code-ref">${escapeHtml(question.solution || '')}</pre>`;
      }
      checkBtn.textContent = 'Scored ' + Math.round(graded.score * 100) + '%';
      runBtn.disabled = false;
      if (onGraded) onGraded(graded);
    } else {
      runBtn.disabled = false; checkBtn.disabled = false;
    }
  }

  runBtn.addEventListener('click', () => execute(false));
  checkBtn.addEventListener('click', () => execute(true));
  return { getCode };
}
