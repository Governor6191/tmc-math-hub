// Owns the Pyodide worker. The only module that knows Pyodide exists.
// runCode resolves with captured output; on timeout it kills the worker so a
// student infinite loop never freezes the tab.
let worker = null;
function spawn() { worker = new Worker(new URL('./python-worker.js', import.meta.url)); return worker; }

export default function runCode(code, { timeoutMs = 8000, onProgress } = {}) {
  if (!worker) spawn();
  const w = worker;
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { w.terminate(); } catch {}
      worker = null; // force a fresh worker next time
      resolve({ stdout: '', stderr: '', error: 'Your code timed out (over ' + (timeoutMs / 1000) + 's). Check for an infinite loop.', timedOut: true });
    }, timeoutMs);
    w.onmessage = (e) => {
      if (e.data.type === 'progress') { if (onProgress) onProgress(e.data.msg); return; }
      if (e.data.type === 'done') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout: e.data.stdout, stderr: e.data.stderr, error: e.data.error, timedOut: false });
      }
    };
    w.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout: '', stderr: '', error: 'Worker error: ' + err.message, timedOut: false });
    };
    w.postMessage({ type: 'run', code });
  });
}
