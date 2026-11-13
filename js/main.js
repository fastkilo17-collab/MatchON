import { sb, $, html, mount } from './lib.js';
import { home, tournamentPage } from './public.js';
import { registerPage, statusPage } from './register.js';
import { adminHome, adminTournament, currentUser } from './admin.js';
import { scorePage } from './score.js';

const routes = [
  [/^#?\/?$/, home],
  [/^#\/t\/([\w-]+)$/, tournamentPage],
  [/^#\/t\/([\w-]+)\/register$/, registerPage],
  [/^#\/status\/([\w-]+)\/([\w-]+)$/, statusPage],
  [/^#\/admin$/, adminHome],
  [/^#\/admin\/t\/([\w-]+)$/, adminTournament],
  [/^#\/score\/([\w-]+)$/, scorePage],
];

const app = $('#app');
let cleanup = null;
let token = 0;

async function navigate() {
  const my = ++token;
  if (cleanup) {
    try { cleanup(); } catch { /* channel already closed */ }
    cleanup = null;
  }
  const hash = location.hash || '#/';
  for (const [re, view] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    // a fresh container per navigation so old listeners never leak into the next view
    const box = document.createElement('div');
    app.replaceChildren(box);
    try {
      const slow = setTimeout(() => {
        if (my === token && /กำลังโหลด/.test(box.textContent)) {
          mount(box, html`<section class="wrap"><p class="err">โหลดข้อมูลนานผิดปกติ ตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้านี้</p></section>`);
        }
      }, 15000);
      const c = await view(box, ...m.slice(1));
      clearTimeout(slow);
      if (my === token) cleanup = typeof c === 'function' ? c : null;
      else if (typeof c === 'function') c();
    } catch (e) {
      mount(box, html`<section class="wrap"><p class="err">เกิดข้อผิดพลาด: ${e.message || e}</p></section>`);
    }
    window.scrollTo(0, 0);
    return;
  }
  mount(app, html`<section class="wrap"><p class="err">ไม่พบหน้านี้</p><a href="#/">กลับหน้าแรก</a></section>`);
}

async function drawNav() {
  const user = await currentUser();
  $('#nav-right').innerHTML = user
    ? `<a href="#/admin">รายการของฉัน</a><button type="button" id="logout" class="linkbtn">ออกจากระบบ</button>`
    : `<a href="#/admin">ผู้จัดเข้าสู่ระบบ</a>`;
  const lo = $('#logout');
  if (lo)
    lo.addEventListener('click', async () => {
      await sb.auth.signOut();
      location.hash = '#/';
      drawNav();
    });
}

window.addEventListener('hashchange', navigate);
document.addEventListener('courtday:auth', drawNav);
// Never call other supabase functions directly inside this callback (it can deadlock the auth lock).
sb.auth.onAuthStateChange(() => {
  setTimeout(drawNav, 0);
});
drawNav();
navigate().then(() => {
  app.dataset.ready = '1';
});
