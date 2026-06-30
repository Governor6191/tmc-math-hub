// Pure grading for `code` questions. No DOM, no Pyodide. Runs in browsers and Node.
// The harness prints one @@TMC@@<json> line per test; parseResults/gradeCode read them.

const MARK = '@@TMC@@';

function pyStr(s) {
  // Embed an arbitrary JS string as a Python triple-quoted string literal safely.
  return '"""' + String(s).replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"') + '"""';
}

export function buildHarness(question, studentCode) {
  const tests = question.tests || [];
  const lines = [];
  lines.push('import sys, io, json');
  lines.push('def _emit(name, passed, got):');
  lines.push('    print(' + JSON.stringify(MARK) + ' + json.dumps({"name": name, "passed": bool(passed), "got": str(got)}))');
  lines.push('_student = ' + pyStr(studentCode));
  lines.push('_ns = {}');
  lines.push('try:');
  lines.push('    exec(_student, _ns)');
  lines.push('except Exception as e:');
  lines.push('    pass');
  tests.forEach((t, i) => {
    const nm = JSON.stringify(t.name || ('test' + i));
    if (t.kind === 'function') {
      lines.push('try:');
      lines.push('    _got = repr(eval(' + JSON.stringify(t.call) + ', _ns))');
      lines.push('    _emit(' + nm + ', _got == ' + JSON.stringify(String(t.expected)) + ', _got)');
      lines.push('except Exception as e:');
      lines.push('    _emit(' + nm + ', False, "error: " + str(e))');
    } else { // stdout
      lines.push('try:');
      lines.push('    _bak_in, _bak_out = sys.stdin, sys.stdout');
      lines.push('    sys.stdin = io.StringIO(' + pyStr(t.stdin || '') + ')');
      lines.push('    sys.stdout = io.StringIO()');
      lines.push('    _ns2 = {}');
      lines.push('    exec(' + pyStr(studentCode) + ', _ns2)');
      lines.push('    _out = sys.stdout.getvalue()');
      lines.push('    sys.stdin, sys.stdout = _bak_in, _bak_out');
      lines.push('    _emit(' + nm + ', _out.rstrip() == ' + JSON.stringify(String(t.expected)) + '.rstrip(), _out)');
      lines.push('except Exception as e:');
      lines.push('    sys.stdin, sys.stdout = _bak_in, _bak_out');
      lines.push('    _emit(' + nm + ', False, "error: " + str(e))');
    }
  });
  return lines.join('\n') + '\n';
}

export function parseResults(rawStdout) {
  const out = [];
  for (const line of String(rawStdout).split('\n')) {
    const i = line.indexOf(MARK);
    if (i === -1) continue;
    try { out.push(JSON.parse(line.slice(i + MARK.length))); } catch { /* skip */ }
  }
  return out;
}

export function gradeCode(question, rawStdout, errorText = '') {
  const parsed = parseResults(rawStdout);
  const byName = {};
  parsed.forEach(p => { byName[p.name] = p; });
  const tests = (question.tests || []).map((t, i) => {
    const got = byName[t.name];
    return {
      name: t.name || ('test' + i),
      kind: t.kind,
      hidden: !!t.hidden,
      expected: String(t.expected),
      got: got ? String(got.got) : (errorText ? 'error' : 'no output'),
      passed: got ? !!got.passed : false,
    };
  });
  const total = tests.length;
  const passed = tests.filter(t => t.passed).length;
  return { tests, passed, total, score: total ? passed / total : 0, allCorrect: total > 0 && passed === total };
}
