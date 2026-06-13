import { loadCatalog } from './catalog.js';
import { initThemeToggle, applyTheme, currentTheme } from './theme.js';

const SECTIONS = [
  { href: 'index.html', label: 'Library' },
  { href: 'progress.html', label: 'My progress' },
  { href: 'about.html', label: 'About' },
];

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const drivePreviewUrl = id => `https://drive.google.com/file/d/${id}/preview`;
export const driveViewUrl = id => `https://drive.google.com/file/d/${id}/view`;
// Note: Google shows a "can't scan for viruses" interstitial for very large files. Expected, not a bug.
export const driveDownloadUrl = id => `https://drive.google.com/uc?export=download&id=${id}`;

const here = () => location.pathname.split('/').pop() || 'index.html';
const courseParam = () => new URLSearchParams(location.search).get('c');

let treeLoaded = false;

export function renderChrome() {
  const header = document.querySelector('[data-chrome="header"]');
  if (header) {
    header.innerHTML = `
      <button class="nav-burger" aria-label="Open navigation" aria-controls="tmc-drawer" aria-expanded="false">&#9776;</button>
      <a class="wordmark" href="index.html"><span aria-hidden="true">&#8721;</span> TMC Math Hub</a>
      <button class="theme-toggle" aria-label="Switch theme"></button>`;

    if (!document.getElementById('tmc-drawer')) {
      const scrim = document.createElement('div');
      scrim.className = 'drawer-scrim';
      scrim.setAttribute('aria-hidden', 'true');
      const drawer = document.createElement('aside');
      drawer.id = 'tmc-drawer';
      drawer.className = 'drawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Site navigation');
      drawer.hidden = true;
      drawer.innerHTML = `
        <div class="drawer-head">
          <a class="wordmark" href="index.html"><span aria-hidden="true">&#8721;</span> TMC Math Hub</a>
          <button class="drawer-close" aria-label="Close navigation">&times;</button>
        </div>
        ${SECTIONS.map(s => `<a class="drawer-link" href="${s.href}"${s.href === here() ? ' aria-current="page"' : ''}>${s.label}</a>`).join('')}
        <hr class="drawer-sep">
        <div id="drawer-tree"><p class="hint">Loading courses...</p></div>`;
      document.body.append(scrim, drawer);
      wireDrawer(drawer, scrim, header.querySelector('.nav-burger'));
    }
    applyTheme(currentTheme());
    initThemeToggle();
  }

  const footer = document.querySelector('[data-chrome="footer"]');
  if (footer) {
    footer.innerHTML = `
      <p>Built by and for fellows of the KNUST Mathematics Department.</p>
      <p>All PDFs stream from the <a href="https://drive.google.com/drive/folders/1k-3KXvCbHkT3RKFBFY2XOz9wbcI2pbb3">TMC Drive hub</a>. Nothing is hosted here.</p>`;
  }
}

function wireDrawer(drawer, scrim, burger) {
  const FOCUSABLE = 'a[href], button:not([disabled])';
  let lastFocus = null;
  let hideTimer = null;

  const open = () => {
    clearTimeout(hideTimer);
    lastFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(() => { drawer.classList.add('is-open'); scrim.classList.add('is-open'); });
    document.body.classList.add('drawer-open');
    burger.setAttribute('aria-expanded', 'true');
    const first = drawer.querySelector(FOCUSABLE);
    if (first) first.focus();
    if (!treeLoaded) { treeLoaded = true; loadDrawerTree(); }
  };
  const close = () => {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    burger.setAttribute('aria-expanded', 'false');
    hideTimer = setTimeout(() => { drawer.hidden = true; }, 220);
    const restore = lastFocus && lastFocus.isConnected ? lastFocus : burger;
    restore.focus();
  };

  burger.addEventListener('click', open);
  scrim.addEventListener('click', close);
  drawer.querySelector('.drawer-close').addEventListener('click', close);
  drawer.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    if (e.key === 'Tab' && drawer.classList.contains('is-open')) {
      const items = [...drawer.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
  });
}

async function loadDrawerTree() {
  const mount = document.getElementById('drawer-tree');
  if (!mount) return;
  const activeCourse = courseParam();
  try {
    const catalog = await loadCatalog();
    mount.innerHTML = catalog.years.map(y => `
      <p class="drawer-year">Year ${y.year}</p>
      ${y.semesters.map(s => `
        <p class="drawer-sem">Semester ${s.semester}</p>
        ${s.courses.map(c => {
          const active = c.id === activeCourse;
          const sub = active && c.topics.some(t => t.questionCount)
            ? `<div class="drawer-sub">
                 <a href="practice.html?c=${encodeURIComponent(c.id)}">Practice</a>
                 <a href="exam.html?c=${encodeURIComponent(c.id)}">Mock exam</a>
               </div>` : '';
          return `<a class="drawer-course" href="course.html?c=${encodeURIComponent(c.id)}"${active ? ' aria-current="page"' : ''}>${escapeHtml(c.title)}</a>${sub}`;
        }).join('')}`).join('')}`).join('');
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<p class="hint">Could not load the course list. The links above still work.</p>`;
  }
}
