// MatchON live layer: court scores + finished matches over Firebase Realtime Database.
// Shared by index.html (organizer) and referee.html. The config below is public by design;
// access is enforced by database.rules.json (a per-tournament referee key).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getDatabase, ref, onValue, set, update, push, runTransaction } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBiKqDDLwM7yanIKgFXI5Ob6UXojwDL7Oo',
  authDomain: 'matchon-c5217.firebaseapp.com',
  databaseURL: 'https://matchon-c5217-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'matchon-c5217',
  storageBucket: 'matchon-c5217.firebasestorage.app',
  messagingSenderId: '19880886814',
  appId: '1:19880886814:web:35f0b47f04f17164dde40f',
};

let db, auth;
function boot() {
  if (db) return;
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
}

const num = (v) => Number(v) || 0;
// Firebase returns keys sorted and may turn arrays into objects; always rebuild one fixed shape.
export function canon(c) {
  const sc = c.scores || [];
  return {
    courtNo: num(c.courtNo),
    status: c.status || 'READY',
    matchCode: c.matchCode || '',
    round: c.round || '',
    teamA: c.teamA || '',
    clubA: c.clubA || '',
    teamB: c.teamB || '',
    clubB: c.clubB || '',
    scores: [0, 1, 2].map((i) => [num(sc[i] && sc[i][0]), num(sc[i] && sc[i][1])]),
    shuttleUsed: num(c.shuttleUsed),
    nextMatch: c.nextMatch || '',
    activeSet: Number.isInteger(c.activeSet) ? c.activeSet : -1, // -1 = not chosen yet
    tournament: c.tournament || '',
    server: c.server === 'A' || c.server === 'B' ? c.server : '',
    paused: !!c.paused,
    startedAt: num(c.startedAt),
    log: Array.isArray(c.log) ? c.log.slice(-150) : (c.log && typeof c.log === 'object' ? Object.values(c.log).slice(-150) : []),
  };
}

export const newId = (n = 24) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
};

/**
 * Sign in anonymously and prove which key we hold.
 *   organizer: connect(liveId, { master })           -> may write every court and publish court keys
 *   referee:   connect(liveId, { courtNo, key })     -> may write that one court only
 * Resolves {canWrite, error?}.
 */
export async function connect(liveId, who) {
  boot();
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
  } catch (e) {
    return { canWrite: false, error: 'auth', detail: e.code || e.message };
  }
  const uid = auth.currentUser.uid;
  if (who && who.master) {
    try { await set(ref(db, `secrets/${liveId}`), who.master); } catch { /* already claimed by this organizer earlier */ }
    try { await set(ref(db, `refs/${liveId}/master/${uid}`), who.master); return { canWrite: true }; }
    catch { return { canWrite: false, error: 'badkey' }; }
  }
  if (who && who.courtNo && who.key) {
    try { await set(ref(db, `refs/${liveId}/c${who.courtNo}/${uid}`), who.key); return { canWrite: true }; }
    catch { return { canWrite: false, error: 'badkey' }; }
  }
  return { canWrite: false, error: 'nokey' };
}

/** Organizer only: publish (or rotate) the per-court referee keys, e.g. {c1: '...', c2: '...'}. */
export function publishCourtKeys(liveId, keys) {
  boot();
  return update(ref(db, `courtkeys/${liveId}`), keys);
}

export function watchConnection(cb) {
  boot();
  return onValue(ref(db, '.info/connected'), (s) => cb(!!s.val()));
}

export function watchCourts(liveId, cb) {
  boot();
  return onValue(ref(db, `live/${liveId}/courts`), (s) => {
    const v = s.val();
    cb(v ? Object.values(v).map(canon).sort((a, b) => a.courtNo - b.courtNo) : null);
  });
}

export function watchCourt(liveId, courtNo, cb) {
  boot();
  return onValue(ref(db, `live/${liveId}/courts/${courtNo}`), (s) => cb(s.val() ? canon(s.val()) : null));
}

export function writeCourts(liveId, courts) {
  boot();
  const o = {};
  courts.forEach((c) => { o[c.courtNo] = canon(c); });
  return update(ref(db, `live/${liveId}/courts`), o);
}

/** Atomic edit of one court, so two devices tapping at once never lose a point. */
export function updateCourt(liveId, courtNo, mutate) {
  boot();
  return runTransaction(ref(db, `live/${liveId}/courts/${courtNo}`), (cur) => {
    if (!cur) return undefined;
    const c = canon(cur);
    mutate(c);
    return canon(c);
  }).then((r) => {
    if (!r.committed) throw Object.assign(new Error('not committed'), { code: 'PERMISSION_DENIED' });
    return r;
  });
}

export async function addCompleted(liveId, match) {
  boot();
  const r = push(ref(db, `live/${liveId}/completed`));
  await set(r, { ...match, at: Date.now() });
  return r.key;
}

export function watchCompleted(liveId, cb) {
  boot();
  return onValue(ref(db, `live/${liveId}/completed`), (s) => {
    const v = s.val() || {};
    cb(Object.entries(v).map(([id, m]) => ({ ...m, fbId: id })).sort((a, b) => (b.at || 0) - (a.at || 0)));
  });
}
