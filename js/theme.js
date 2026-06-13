// Light/dark theme: a pure, Node-testable core plus thin DOM wiring.
// Saved choice wins forever once set; otherwise the OS preference decides.

const KEY = 'tmc.v1.theme';
const VALID = new Set(['light', 'dark']);

export function readSavedTheme(store) {
  if (!store) return null;
  try {
    const v = store.getItem(KEY);
    return VALID.has(v) ? v : null;
  } catch {
    return null;
  }
}

export function resolveInitialTheme(store, prefersDark) {
  return readSavedTheme(store) ?? (prefersDark ? 'dark' : 'light');
}

export function saveTheme(theme, store) {
  if (!store || !VALID.has(theme)) return false;
  try {
    store.setItem(KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function nextTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}

// ---- DOM wiring (browser only; not unit tested) ----

const THEME_COLOR = { dark: '#0f1f1c', light: '#fbfbf7' };

function defaultStore() {
  try {
    const probe = '__tmc_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] ?? THEME_COLOR.dark);
}

const SUN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

// The button shows the CURRENT mode (sun by day, moon by night) and its
// label states the action, matching the approved mockup.
export function initThemeToggle() {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const store = defaultStore();
  const sync = () => {
    const t = currentTheme();
    btn.innerHTML = t === 'dark' ? MOON : SUN;
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  };
  sync();
  btn.addEventListener('click', () => {
    const t = nextTheme(currentTheme());
    applyTheme(t);
    saveTheme(t, store);
    sync();
  });
}
