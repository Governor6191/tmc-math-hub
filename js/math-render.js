// KaTeX auto-render wrapper. KaTeX loads from the CDN in the page head;
// when it fails to load (offline, blocked CDN), math shows as raw $...$ text,
// which is still readable. Never throws.

export function renderMathIn(el) {
  if (typeof globalThis.renderMathInElement !== 'function') return false;
  globalThis.renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
  });
  return true;
}
