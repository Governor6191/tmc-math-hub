// Pyodide runs here, on a background thread, so the main thread can terminate a
// runaway (infinite loop) by killing the worker. Classic worker (new Worker(url)).
let pyodideReady = null;
function load() {
  if (!pyodideReady) {
    self.postMessage({ type: 'progress', msg: 'Loading Python (one-time, about 7 MB)...' });
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js');
    pyodideReady = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/' });
  }
  return pyodideReady;
}
self.onmessage = async (e) => {
  if (e.data.type !== 'run') return;
  let stdout = '', stderr = '';
  try {
    const py = await load();
    py.setStdout({ batched: (s) => { stdout += s + '\n'; } });
    py.setStderr({ batched: (s) => { stderr += s + '\n'; } });
    self.postMessage({ type: 'progress', msg: 'Running...' });
    await py.runPythonAsync(e.data.code);
    self.postMessage({ type: 'done', stdout, stderr, error: '' });
  } catch (err) {
    self.postMessage({ type: 'done', stdout, stderr, error: String((err && err.message) || err) });
  }
};
