// DOM for a C `code` question in the C lab: the editor, Run/Check, the output
// panel and the per-test chips. Compiling/running go to c-runtime (real clang);
// grading to c-engine. Kept separate from the Python code-render so the isolated
// C runtime never entangles the working practice/exam/Python-lab paths.

import { escapeHtml, codeHtml } from './app.js';
import compileAndRunAll from './c-runtime.js';
import { gradeC } from './c-engine.js';

function escTA(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

export function cCardHtml(question, { savedCode } = {}) {
  const code = savedCode != null ? savedCode : (question.starterCode || '');
  const examples = (question.tests || []).filter(t => !t.hidden).length;
  return `
    <p class="quiz-stem">${codeHtml(question.stem)}</p>
    <textarea class="code-editor" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="C code editor">${escTA(code)}</textarea>
    <div class="code-actions">
      <button class="next-btn code-run" type="button">Run</button>
      <button class="next-btn code-check" type="button">Check</button>
      <span class="hint code-hint">${examples} example test${examples === 1 ? '' : 's'} shown; more run on Check.</span>
    </div>
    <div class="code-output" aria-live="polite"></div>
    <div class="code-tests"></div>
    <div class="code-solution"></div>`;
}

function chipsHtml(graded, tests, revealHidden) {
  const orig = {};
  (tests || []).forEach(t => { orig[t.name] = t; });
  return graded.tests
    .filter(t => revealHidden || !t.hidden)
    .map(t => {
      const mark = t.passed ? '✓' : '✗';
      const cls = t.passed ? 'is-pass' : 'is-fail';
      let detail;
      if (t.hidden) detail = 'hidden test';
      else {
        const o = orig[t.name];
        detail = 'input ' + escapeHtml(JSON.stringify(o ? (o.stdin || '') : ''));
        if (!t.passed) detail += '  got ' + escapeHtml(t.got) + ', expected ' + escapeHtml(t.expected);
      }
      return `<div class="code-test ${cls}"><span class="mark">${mark}</span><span>${detail}</span></div>`;
    }).join('');
}

// onGraded(graded) fires after Check. revealSolution shows the reference on Check.
export function mountC(root, question, { onGraded, onEdit, revealSolution = true } = {}) {
  const ta = root.querySelector('.code-editor');
  let cm = null;
  if (window.CodeMirror && ta) {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    cm = window.CodeMirror.fromTextArea(ta, { mode: 'text/x-csrc', lineNumbers: true, indentUnit: 4, theme: dark ? 'material-darker' : 'default' });
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

  async function execute(all) {
    runBtn.disabled = true; checkBtn.disabled = true;
    out.classList.add('code-loading');
    out.textContent = 'Working...';
    const tests = all ? (question.tests || []) : (question.tests || []).filter(t => !t.hidden);
    const { compile, results } = await compileAndRunAll(
      getCode(), tests.map(t => ({ name: t.name, stdin: t.stdin })),
      { onProgress: m => { out.textContent = m; } });
    const graded = gradeC({ tests }, results, compile);
    out.classList.remove('code-loading');
    if (compile.ok === false) {
      out.textContent = compile.stderr || 'Compilation failed.';
    } else {
      const first = tests[0];
      const r = first ? results[first.name] : null;
      let txt = r ? String(r.stdout || '') : '';
      if (r && r.stderr) txt += (txt ? '\n' : '') + String(r.stderr).trim();
      if (r && r.timedOut) txt += (txt ? '\n' : '') + '(timed out)';
      out.textContent = txt.replace(/\n+$/, '') || '(no output)';
    }
    testsEl.innerHTML = chipsHtml(graded, tests, all);
    if (all) {
      if (revealSolution) {
        solEl.innerHTML = `<p class="hint" style="margin-bottom:0.3rem;">Reference solution</p><pre class="code-ref">${escapeHtml(question.solution || '')}</pre>`;
      }
      checkBtn.textContent = compile.ok === false ? 'Did not compile' : 'Scored ' + Math.round(graded.score * 100) + '%';
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
