// Real clang in the browser, via the Wasmer SDK. Compiles and runs C entirely
// client-side. Used only by the cross-origin isolated C lab (clab/), which the
// Wasmer SDK requires (it shares a SharedArrayBuffer across workers). The first
// compile downloads clang (about 100MB); Wasmer caches it in the browser after.

const SDK_URL = 'https://unpkg.com/@wasmer/sdk@0.10.0/dist/index.mjs';

let sdkPromise = null;    // resolves to the @wasmer/sdk module, already init()ed
let clangPromise = null;  // resolves to the clang package

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import(SDK_URL).then(async (mod) => { await mod.init(); return mod; });
  }
  return sdkPromise;
}

// Kick off the SDK load + clang download. Safe to call early to warm the cache.
export async function ensureClang(onProgress) {
  const sdk = await loadSdk();
  if (!clangPromise) {
    if (onProgress) onProgress('Setting up the C compiler (first run only, this can take a moment)...');
    clangPromise = sdk.Wasmer.fromRegistry('clang/clang');
  }
  return { sdk, clang: await clangPromise };
}

// Compile a full C program. Returns { ok, stderr, wasm?, sdk? }.
async function compile(src, onProgress, timeoutMs = 25000) {
  const { sdk, clang } = await ensureClang(onProgress);
  if (onProgress) onProgress('Compiling...');
  const project = new sdk.Directory();
  await project.writeFile('main.c', src);
  const compileRun = (async () => {
    const cc = await clang.entrypoint.run({
      args: ['/project/main.c', '-O2', '-lm', '-o', '/project/main.wasm'],
      mount: { '/project': project },
    });
    return cc.wait();
  })();
  let out;
  try { out = await Promise.race([compileRun, new Promise((res) => setTimeout(() => res({ __timeout: true }), timeoutMs))]); }
  catch (e) { return { ok: false, stderr: 'Compiler error: ' + String(e) }; }
  if (out && out.__timeout) return { ok: false, stderr: 'The compiler timed out. Reload the page and try again.' };
  if (out.code !== 0) return { ok: false, stderr: out.stderr || 'compilation failed' };
  const wasm = await project.readFile('main.wasm');
  return { ok: true, stderr: out.stderr || '', wasm, sdk };
}

async function runOne(sdk, wasm, stdin, timeoutMs) {
  const prog = await sdk.Wasmer.fromFile(wasm);
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs); });
  const exec = prog.entrypoint.run(stdin ? { stdin } : {}).then((inst) => inst.wait());
  let r;
  try { r = await Promise.race([exec, timeout]); }
  catch (e) { clearTimeout(timer); return { stdout: '', stderr: String(e), exitCode: null, timedOut: false }; }
  clearTimeout(timer);
  if (r && r.__timeout) return { stdout: '', stderr: '', exitCode: null, timedOut: true };
  return { stdout: r.stdout || '', stderr: r.stderr || '', exitCode: r.code, timedOut: false };
}

// Compile once, then run the program against each test's stdin.
// tests: [{ name, stdin }]. Returns { compile: { ok, stderr }, results: { [name]: runResult } }.
export default async function compileAndRunAll(src, tests, { onProgress, timeoutMs = 10000 } = {}) {
  const c = await compile(src, onProgress);
  if (!c.ok) return { compile: { ok: false, stderr: c.stderr }, results: {} };
  const results = {};
  for (const t of (tests || [])) {
    if (onProgress) onProgress('Running tests...');
    results[t.name] = await runOne(c.sdk, c.wasm, t.stdin || '', timeoutMs);
  }
  return { compile: { ok: true, stderr: c.stderr }, results };
}
