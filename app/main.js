import { sb, S, MANAGE, ALL, ROLE_TH, loadSession, loadTournaments, setTid, canManage, html, mount, esc, $, toast } from './core.js';
import { dashboard } from './dashboard.js';
import { tournamentsPage, tournamentEdit } from './tournaments.js';
import { registerHome, registerPage, statusPage, myPage } from './register.js';
import { athletesPage } from './athletes.js';
import { bracketsPage } from './brackets.js';
import { schedulePage } from './schedule.js';
import { courtsPage } from './courts.js';
import { livePage } from './live.js';
import { staffPage } from './staff.js';
import { rulesPage } from './rules.js';
import { resultsPage } from './results.js';
import { reportsPage } from './reports.js';
import { loginPage, settingsPage } from './account.js';

const NAV = [
  ['dashboard', '📊', 'Dashboard', MANAGE],
  ['tournaments', '🏆', 'รายการแข่งขัน', ALL],
  ['register', '📝', 'สมัครแข่งขัน', ['anon', 'player', 'referee']],
  ['my', '🎫', 'การสมัครของฉัน', ['anon', 'player', 'referee']],
  ['athletes', '👥', 'จัดการนักกีฬา', MANAGE],
  ['rules', '📏', 'กติกา', MANAGE],
  ['brackets', '🧩', 'จัดสายแข่งขัน', MANAGE],
  ['schedule', '🗓', 'ตารางการแข่งขัน', ALL],
  ['courts', '🏟', 'จัดการสนาม', MANAGE],
  ['staff', '⏱', 'กรรมการและสตาฟฟ์', ['referee', ...MANAGE]],
  ['live', '🔴', 'Live Score', ALL],
  ['results', '🥇', 'ผลการแข่งขัน', ALL],
  ['reports', '📈', 'รายงานและสถิติ', MANAGE],
  ['settings', '⚙', 'ตั้งค่าระบบ', ALL],
];
const TITLE = Object.fromEntries(NAV.map(([k, , l]) => [k, l]));
TITLE.login = 'เข้าสู่ระบบ';

const routes = {
  dashboard, tournaments: tournamentsPage, register: registerHome, my: myPage, athletes: athletesPage, brackets: bracketsPage,
  schedule: schedulePage, courts: courtsPage, live: livePage, rules: rulesPage, staff: staffPage, results: resultsPage, reports: reportsPage, settings: settingsPage, login: loginPage,
};
const PRIMARY = ['dashboard', 'tournaments', 'register', 'athletes', 'schedule', 'live', 'results'];

const app = $('#app');
let cleanup = null;
let token = 0;
const visible = () => NAV.filter(([, , , roles]) => roles.includes(S.role));

function drawChrome(cur) {
  const items = visible();
  const nav = (k, ic, l) => {
    const href = `#/${k}`;
    return `<a class="nav ${k === cur ? 'on' : ''}" href="${href}"><span class="ic">${ic}</span>${l}</a>`;
  };
  $('#side').innerHTML = `
    <div class="brand"><img src="img/matchon-icon.png" alt=""><b>MatchON</b></div>
    <nav>${items.map(([k, ic, l]) => nav(k, ic, l)).join('')}</nav>
    <div class="foot">
      ${S.user ? `<div class="who">${esc(S.name)}</div><div>${ROLE_TH[S.role]}</div><button class="btn sm" id="logout">ออกจากระบบ</button>`
               : `<a class="btn sm" href="#/login">เข้าสู่ระบบ / สมัครสมาชิก</a>`}
    </div>`;
  const prim = items.filter(([k]) => PRIMARY.includes(k)).slice(0, 4);
  $('#tabbar').innerHTML = prim.map(([k, ic, l]) => {
    const href = `#/${k}`;
    return `<a class="${k === cur ? 'on' : ''}" href="${href}"><span class="ic">${ic}</span>${l.length > 9 ? l.slice(0, 8) + '…' : l}</a>`;
  }).join('') + `<button type="button" id="moreBtn"><span class="ic">☰</span>เมนู</button>`;
  $('#sheetin').innerHTML = items.map(([k, ic, l]) => nav(k, ic, l).replace('class="nav', 'class="nav')).join('') +
    (S.user ? `<button id="logout2"><span class="ic">🚪</span>ออกจากระบบ</button>` : `<a href="#/login"><span class="ic">🔑</span>เข้าสู่ระบบ</a>`);
  for (const id of ['logout', 'logout2']) {
    const b = $('#' + id);
    if (b) b.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; };
  }
  $('#moreBtn').onclick = () => $('#sheet').classList.add('on');
  $('#sheet').onclick = (e) => { if (e.target.id === 'sheet' || e.target.closest('a')) $('#sheet').classList.remove('on'); };
  // tournament picker for pages that work on one tournament
  const sel = $('#tsel');
  const show = S.tournaments.length > 0 && !['login', 'settings', 'register', 'my', 'tournaments'].includes(cur);
  sel.hidden = !show;
  sel.innerHTML = S.tournaments.map((t) => `<option value="${t.id}" ${t.id === S.tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  sel.onchange = () => { setTid(sel.value); navigate(); };
}

async function navigate() {
  const my = ++token;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  let key = parts[0] || (canManage() ? 'dashboard' : 'tournaments');
  const params = parts.slice(1);
  let view = routes[key];
  if (key === 'tournaments' && params.length) view = tournamentEdit;
  if (key === 'register' && params.length) view = registerPage;
  if (key === 'status') { view = statusPage; key = 'my'; }
  if (!view) { key = 'tournaments'; view = tournamentsPage; }
  const need = NAV.find(([k]) => k === key);
  if (need && !need[3].includes(S.role) && key !== 'tournaments') {
    if (!S.user && canNeedLogin(key)) { location.hash = '#/login'; return; }
    key = 'tournaments'; view = tournamentsPage;
  }
  drawChrome(key);
  $('#title').textContent = TITLE[key] || 'MatchON';
  document.title = (TITLE[key] || 'MatchON') + ' · MatchON';
  const box = document.createElement('div');
  box.className = 'page-in';
  box.style.cssText = 'display:flex;flex-direction:column;gap:18px;min-width:0';
  app.replaceChildren(box);
  mount(box, html`<div class="empty">กำลังโหลด…</div>`);
  try {
    const c = await view(box, params);
    if (my === token) cleanup = typeof c === 'function' ? c : null; else if (typeof c === 'function') c();
  } catch (e) {
    console.error(e);
    mount(box, html`<div class="card"><p class="err">เกิดข้อผิดพลาด: ${e.message || e}</p><button class="btn" id="retry">ลองอีกครั้ง</button></div>`);
    const r = $('#retry', box); if (r) r.onclick = navigate;
  }
  window.scrollTo(0, 0);
}
const canNeedLogin = (key) => MANAGE.includes('organizer') && ['dashboard', 'athletes', 'brackets', 'courts', 'reports'].includes(key);

window.addEventListener('hashchange', navigate);
document.addEventListener('matchon:reload', async () => { await loadTournaments(); navigate(); });
let lastUid = null;
sb.auth.onAuthStateChange((ev, session) => {
  const uid = (session && session.user && session.user.id) || null;
  if (ev === 'INITIAL_SESSION') { lastUid = uid; return; }
  if (uid === lastUid) return;          // token refreshes and tab re-focus must not reset the page
  lastUid = uid;
  setTimeout(async () => { await loadSession(); navigate(); }, 0);
});
loadSession().catch((e) => toast(e.message || String(e), 'err')).finally(() => navigate().then(() => { app.dataset.ready = '1'; }));
