// Optional accounts: Google sign-in + cloud sync of practice progress and the
// activity log. localStorage stays the source of truth that every page reads;
// this module pulls cloud data down and merges it in, then pushes local
// changes back (debounced). Dormant until js/firebase-config.js holds a real
// config, so the default site is untouched. See accounts/README.md.

import { FIREBASE_CONFIG } from './firebase-config.js';
import { mergeQuestionMaps, mergeActivityMaps, mergeAttemptLists, mergeLabMaps } from './cloud-merge.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const PRACTICE_PREFIX = 'tmc.v1.practice.';
const ATTEMPTS_PREFIX = 'tmc.v1.exam.attempts.';
const LAB_PREFIX = 'tmc.v1.lab.';
const CLAB_PREFIX = 'tmc.v1.clab.';
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

// Every course this device knows anything about, across all four stores.
// Lab keys are tmc.v1.lab.<courseId>.<questionId>; ids never contain dots.
function localCourseIds() {
  const ids = new Set();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(PRACTICE_PREFIX)) ids.add(k.slice(PRACTICE_PREFIX.length));
      else if (k.startsWith(ATTEMPTS_PREFIX)) ids.add(k.slice(ATTEMPTS_PREFIX.length));
      else if (k.startsWith(LAB_PREFIX)) ids.add(k.slice(LAB_PREFIX.length).split('.')[0]);
      else if (k.startsWith(CLAB_PREFIX)) ids.add(k.slice(CLAB_PREFIX.length).split('.')[0]);
    }
  } catch { /* storage off */ }
  return [...ids];
}

// Lab saves live one localStorage key per problem; gather them into a map for
// the course document, and spread a merged map back onto the per-problem keys.
function readLabMap(prefix, courseId) {
  const out = {};
  const p = prefix + courseId + '.';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(p)) continue;
      const entry = readJson(k, null);
      if (entry && typeof entry === 'object') out[k.slice(p.length)] = entry;
    }
  } catch { /* storage off */ }
  return out;
}
function writeLabMap(prefix, courseId, map) {
  for (const [qid, entry] of Object.entries(map || {})) {
    writeJson(prefix + courseId + '.' + qid, entry);
  }
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
  courseSnaps.forEach(snap => cloudCourses.set(snap.id, snap.data() || {}));

  const allCourses = new Set([...localCourseIds(), ...cloudCourses.keys()]);
  for (const courseId of allCourses) {
    const cloud = cloudCourses.get(courseId) || {};
    let courseDirty = false;

    const localQ = readJson(PRACTICE_PREFIX + courseId, {});
    const mergedQ = mergeQuestionMaps(localQ, cloud.questions || {});
    if (JSON.stringify(mergedQ) !== JSON.stringify(localQ)) {
      writeJson(PRACTICE_PREFIX + courseId, mergedQ);
      anythingChangedLocally = true;
    }
    if (JSON.stringify(mergedQ) !== JSON.stringify(cloud.questions || {})) courseDirty = true;

    const rawA = readJson(ATTEMPTS_PREFIX + courseId, []);
    const localA = Array.isArray(rawA) ? rawA : [];
    const mergedA = mergeAttemptLists(localA, cloud.examAttempts || []);
    if (JSON.stringify(mergedA) !== JSON.stringify(localA)) {
      writeJson(ATTEMPTS_PREFIX + courseId, mergedA);
      anythingChangedLocally = true;
    }
    if (mergedA.length !== (cloud.examAttempts || []).length) courseDirty = true;

    for (const [prefix, field] of [[LAB_PREFIX, 'labs'], [CLAB_PREFIX, 'clabs']]) {
      const localL = readLabMap(prefix, courseId);
      const mergedL = mergeLabMaps(localL, cloud[field] || {});
      if (JSON.stringify(mergedL) !== JSON.stringify(localL)) {
        writeLabMap(prefix, courseId, mergedL);
        anythingChangedLocally = true;
      }
      if (JSON.stringify(mergedL) !== JSON.stringify(cloud[field] || {})) courseDirty = true;
    }

    if (courseDirty) dirtyCourses.add(courseId);
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
      const payload = {
        questions: readJson(PRACTICE_PREFIX + courseId, {}),
        labs: readLabMap(LAB_PREFIX, courseId),
        clabs: readLabMap(CLAB_PREFIX, courseId),
        updatedAt: fsMod.serverTimestamp(),
      };
      // arrayUnion so a push that raced another device only ever adds attempts.
      const rawA = readJson(ATTEMPTS_PREFIX + courseId, []);
      const attempts = Array.isArray(rawA) ? rawA : [];
      if (attempts.length) payload.examAttempts = fsMod.arrayUnion(...attempts);
      await fsMod.setDoc(fsMod.doc(db, 'users', uid, 'courses', courseId), payload, { merge: true });
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
  const markDirty = e => {
    if (!currentUser) return;
    const courseId = e && e.detail && e.detail.courseId;
    if (courseId) { dirtyCourses.add(courseId); saveDirty(); metaDirty = true; schedulePush(); }
  };
  window.addEventListener('tmc:answer', markDirty);
  window.addEventListener('tmc:attempt', markDirty);
  window.addEventListener('tmc:lab', markDirty);
  const flush = () => { if (dirtyCourses.size || metaDirty) { clearTimeout(pushTimer); pushNow(); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
