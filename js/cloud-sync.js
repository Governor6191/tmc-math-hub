// Optional accounts: Google sign-in + cloud sync of practice progress and the
// activity log. localStorage stays the source of truth that every page reads;
// this module pulls cloud data down and merges it in, then pushes local
// changes back (debounced). Dormant until js/firebase-config.js holds a real
// config, so the default site is untouched. See accounts/README.md.

import { FIREBASE_CONFIG } from './firebase-config.js';
import { mergeQuestionMaps, mergeActivityMaps } from './cloud-merge.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const PRACTICE_PREFIX = 'tmc.v1.practice.';
const ACTIVITY_KEY = 'tmc.v1.activity';
const PULL_STAMP = 'tmc.v1.sync.pulledAt';
const DIRTY_KEY = 'tmc.v1.sync.dirty';
const PULL_EVERY_MS = 30 * 60 * 1000;
const PUSH_DEBOUNCE_MS = 4000;

export function accountsEnabled() {
  return !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

let fb = null;          // { auth, db, authMod, fsMod } once initialized
let currentUser = null;
let userListeners = [];
let pushTimer = null;
let metaDirty = false;
const dirtyCourses = new Set();

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === 'object' ? v : fallback;
  } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or private */ }
}

function loadDirty() {
  try { (JSON.parse(sessionStorage.getItem(DIRTY_KEY)) || []).forEach(c => dirtyCourses.add(c)); } catch { /* none */ }
}
function saveDirty() {
  try { sessionStorage.setItem(DIRTY_KEY, JSON.stringify([...dirtyCourses])); } catch { /* fine */ }
}

async function init() {
  if (fb) return fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js'),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  fb = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), authMod, fsMod };
  return fb;
}

function notifyUser() { userListeners.forEach(cb => { try { cb(currentUser); } catch { /* listener error */ } }); }

// Subscribe to auth state. Starts Firebase lazily; safe to call when dormant
// (the callback simply fires once with null and nothing loads).
export function onUser(cb) {
  userListeners.push(cb);
  if (!accountsEnabled()) { cb(null); return; }
  init().then(({ auth, authMod }) => {
    authMod.onAuthStateChanged(auth, u => {
      const was = currentUser;
      currentUser = u || null;
      notifyUser();
      if (currentUser && !was) pullAndMerge(false);
    });
  }).catch(() => cb(null));
}

export async function signIn() {
  const { auth, authMod } = await init();
  const provider = new authMod.GoogleAuthProvider();
  try {
    await authMod.signInWithPopup(auth, provider);
    try { sessionStorage.removeItem(PULL_STAMP); } catch { /* force a fresh pull */ }
  } catch (e) {
    const code = e && e.code ? String(e.code) : '';
    if (code.includes('popup')) await authMod.signInWithRedirect(auth, provider);
    else throw e;
  }
}

export async function signOutUser() {
  if (!fb) return;
  await fb.authMod.signOut(fb.auth);
}

function localCourseIds() {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PRACTICE_PREFIX)) ids.push(k.slice(PRACTICE_PREFIX.length));
    }
  } catch { /* storage off */ }
  return ids;
}

// Pull the cloud copy, merge into localStorage, and queue a push for anything
// the device knew that the cloud did not. Throttled to one pull per 30 minutes
// per tab session, except right after an explicit sign-in.
export async function pullAndMerge(respectThrottle = true) {
  if (!accountsEnabled() || !currentUser) return;
  if (respectThrottle) {
    try {
      const last = Number(sessionStorage.getItem(PULL_STAMP)) || 0;
      if (Date.now() - last < PULL_EVERY_MS) return;
    } catch { /* no session storage: pull anyway */ }
  }
  const { db, fsMod } = await init();
  const uid = currentUser.uid;
  let anythingChangedLocally = false;

  const metaSnap = await fsMod.getDoc(fsMod.doc(db, 'users', uid));
  const cloudActivity = metaSnap.exists() ? (metaSnap.data().activity || {}) : {};
  const localActivity = readJson(ACTIVITY_KEY, {});
  const mergedActivity = mergeActivityMaps(localActivity, cloudActivity);
  if (JSON.stringify(mergedActivity) !== JSON.stringify(localActivity)) {
    writeJson(ACTIVITY_KEY, mergedActivity);
    anythingChangedLocally = true;
  }
  if (JSON.stringify(mergedActivity) !== JSON.stringify(cloudActivity)) metaDirty = true;

  const courseSnaps = await fsMod.getDocs(fsMod.collection(db, 'users', uid, 'courses'));
  const cloudCourses = new Map();
  courseSnaps.forEach(snap => cloudCourses.set(snap.id, snap.data().questions || {}));

  const allCourses = new Set([...localCourseIds(), ...cloudCourses.keys()]);
  for (const courseId of allCourses) {
    const local = readJson(PRACTICE_PREFIX + courseId, {});
    const cloud = cloudCourses.get(courseId) || {};
    const merged = mergeQuestionMaps(local, cloud);
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      writeJson(PRACTICE_PREFIX + courseId, merged);
      anythingChangedLocally = true;
    }
    if (JSON.stringify(merged) !== JSON.stringify(cloud)) dirtyCourses.add(courseId);
  }
  saveDirty();

  try { sessionStorage.setItem(PULL_STAMP, String(Date.now())); } catch { /* fine */ }
  if (dirtyCourses.size || metaDirty) schedulePush();
  if (anythingChangedLocally) {
    try { window.dispatchEvent(new CustomEvent('tmc:synced')); } catch { /* old browser */ }
  }
}

async function pushNow() {
  if (!accountsEnabled() || !currentUser || !fb) return;
  const { db, fsMod } = fb;
  const uid = currentUser.uid;
  const courses = [...dirtyCourses];
  dirtyCourses.clear();
  saveDirty();
  const wasMetaDirty = metaDirty;
  metaDirty = false;
  try {
    for (const courseId of courses) {
      const questions = readJson(PRACTICE_PREFIX + courseId, {});
      await fsMod.setDoc(fsMod.doc(db, 'users', uid, 'courses', courseId),
        { questions, updatedAt: fsMod.serverTimestamp() }, { merge: true });
    }
    if (wasMetaDirty || courses.length) {
      await fsMod.setDoc(fsMod.doc(db, 'users', uid), {
        displayName: currentUser.displayName || '',
        activity: readJson(ACTIVITY_KEY, {}),
        updatedAt: fsMod.serverTimestamp(),
      }, { merge: true });
    }
  } catch {
    // Offline or quota trouble: remember the work for a later push.
    courses.forEach(c => dirtyCourses.add(c));
    if (wasMetaDirty) metaDirty = true;
    saveDirty();
  }
}

function schedulePush() {
  if (!currentUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
}

// Wire the account UI into the header slot. Called by renderChrome on every
// page; a no-op while dormant so the slot stays hidden.
export function wireAccountUI(slot) {
  if (!slot || !accountsEnabled()) return;
  slot.hidden = false;
  const render = user => {
    if (!user) {
      slot.innerHTML = '<button class="account-btn" type="button">Sign in</button>';
      slot.querySelector('.account-btn').addEventListener('click', () => {
        signIn().catch(() => { /* student closed the popup */ });
      });
      return;
    }
    const first = (user.displayName || 'Account').split(' ')[0];
    slot.innerHTML = `
      <button class="account-chip" type="button" aria-haspopup="true" aria-expanded="false">${first.replace(/[<>&"]/g, '')}</button>
      <div class="account-menu" hidden>
        <p class="account-menu-note">Signed in. Your progress follows you across devices.</p>
        <button class="account-out" type="button">Sign out</button>
      </div>`;
    const chip = slot.querySelector('.account-chip');
    const menu = slot.querySelector('.account-menu');
    chip.addEventListener('click', () => {
      const open = !menu.hidden;
      menu.hidden = open;
      chip.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', e => { if (!slot.contains(e.target)) menu.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
    slot.querySelector('.account-out').addEventListener('click', () => { menu.hidden = true; signOutUser(); });
  };
  onUser(render);

  loadDirty();
  window.addEventListener('tmc:answer', e => {
    if (!currentUser) return;
    const courseId = e && e.detail && e.detail.courseId;
    if (courseId) { dirtyCourses.add(courseId); saveDirty(); metaDirty = true; schedulePush(); }
  });
  const flush = () => { if (dirtyCourses.size || metaDirty) { clearTimeout(pushTimer); pushNow(); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
