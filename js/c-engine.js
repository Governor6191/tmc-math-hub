// Pure grading for C `code` questions (stdin to stdout). No Wasmer, no DOM, so
// it runs in browsers and Node. The C runtime compiles the student's full
// program once, runs it against each test's stdin, and passes the results here.

function rstrip(s) { return String(s == null ? '' : s).replace(/\s+$/, ''); }

// results: { [testName]: { stdout, exitCode, timedOut } }
// compile: { ok, stderr }
export function gradeC(question, results = {}, compile = { ok: true, stderr: '' }) {
  const compileError = compile && compile.ok === false ? (compile.stderr || 'compile error') : '';
  const tests = (question.tests || []).map((t, i) => {
    const name = t.name || ('test' + i);
    const r = results[name];
    let got, passed;
    if (compileError) { got = '(compile error)'; passed = false; }
    else if (!r) { got = 'no output'; passed = false; }
    else if (r.timedOut) { got = '(timed out)'; passed = false; }
    else { got = String(r.stdout == null ? '' : r.stdout); passed = rstrip(got) === rstrip(t.expected); }
    return { name, hidden: !!t.hidden, kind: t.kind || 'stdout', expected: String(t.expected), got, passed };
  });
  const total = tests.length;
  const passed = tests.filter(t => t.passed).length;
  return { tests, passed, total, score: total ? passed / total : 0, allCorrect: total > 0 && passed === total, compileError };
}
