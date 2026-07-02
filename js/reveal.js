// Scroll reveal: elements marked data-reveal rise in as they enter the
// viewport. The hiding rule in site.css only applies under html.is-js (set
// by the head script), so a failed script can never blank a page. Under
// reduced motion, or without IntersectionObserver, everything shows at once.

let observer = null;
const seen = new WeakSet();

function reducedMotion() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

export function initReveals(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]')].filter(el => !seen.has(el));
  if (!els.length) return;
  els.forEach(el => seen.add(el));
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-revealed'));
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-revealed');
          observer.unobserve(en.target);
        }
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  }
  els.forEach(el => observer.observe(el));
}
