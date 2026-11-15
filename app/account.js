import { sb, S, ROLE_TH, html, raw, mount, $, $$, toast, busy, esc, store } from './core.js';

export async function loginPage(root) {
  if (S.user) { location.hash = '#/'; return; }
  mount(root, html`<div class="card stack" style="max-width:460px;margin:0 auto;width:100%">
    <h1 id="h">เข้าสู่ระบบ</h1>
    <form id="auth" class="stack" novalidate>
      <label class="field" id="nf" hidden><span>ชื่อที่แสดง</span><input id="dn" maxlength="60" autocomplete="name"></label>
      <label class="field"><span>อีเมล</span><input id="email" type="email" autocomplete="email" required></label>
      <label class="field"><span>รหัสผ่าน (อย่างน้อย 8 ตัว)</span><input id="password" type="password" autocomplete="current-password" minlength="8" required></label>
      <label class="check" id="of" hidden><input id="org" type="checkbox"><span>ฉันเป็นผู้จัดการแข่งขัน (สร้างรายการแข่งขันได้)</span></label>
      <button class="btn primary big" id="go" type="submit">เข้าสู่ระบบ</button>
      <button class="btn" type="button" id="tg">สมัครสมาชิกใหม่</button>
    </form>
    <p class="muted small">นักกีฬาไม่ต้องสมัครสมาชิกก็สมัครแข่งขันได้ แต่ถ้าสมัครสมาชิกจะเห็นประวัติและแจ้งเตือนทั้งหมดในที่เดียว</p>
  </div>`);
  let signup = false;
  $('#tg', root).onclick = () => {
    signup = !signup;
    $('#nf', root).hidden = $('#of', root).hidden = !signup;
    $('#h', root).textContent = signup ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
    $('#go', root).textContent = signup ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
    $('#tg', root).textContent = signup ? 'มีบัญชีแล้ว เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่';
  };
  $('#auth', root).onsubmit = async (ev) => {
    ev.preventDefault();
    const email = $('#email', root).value.trim();
    const password = $('#password', root).value;
    if (!email || password.length < 8) return toast('กรอกอีเมลและรหัสผ่านอย่างน้อย 8 ตัว', 'err');
    await busy($('#go', root), async () => {
      if (signup) {
        const display_name = $('#dn', root).value.trim() || email.split('@')[0];
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name } } });
        if (error) throw error;
        if (!data.session) return toast('ส่งอีเมลยืนยันแล้ว กดลิงก์ในอีเมลแล้วกลับมาเข้าสู่ระบบ');
        if ($('#org', root).checked) {
          const { error: e2 } = await sb.rpc('become_organizer', { p_name: display_name });
          if (e2) throw e2;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      location.hash = '#/';
    });
  };
}

export async function settingsPage(root) {
  const theme = store.get('matchon.theme') || 'auto';
  const isAdmin = S.role === 'super_admin';
  let users = [];
  if (isAdmin) {
    const { data } = await sb.from('profiles').select('id,display_name,role,created_at').order('created_at');
    users = data || [];
  }
  mount(root, html`
    <div class="card stack"><h2>บัญชี</h2>
      ${S.user ? html`<p><b>${S.name}</b> · ${ROLE_TH[S.role]}</p>
        ${S.role === 'player' ? html`<div class="row"><button class="btn" id="beorg">ขอเป็นผู้จัดการแข่งขัน</button></div>` : ''}`
      : html`<p class="muted">ยังไม่ได้เข้าสู่ระบบ</p><a class="btn primary" href="#/login">เข้าสู่ระบบ / สมัครสมาชิก</a>`}
    </div>
    <div class="card stack"><h2>หน้าตา</h2>
      <div class="tabs" id="th">
        ${[['auto', 'ตามอุปกรณ์'], ['light', 'โหมดสว่าง'], ['dark', 'โหมดมืด']].map(([k, l]) => raw(`<button type="button" data-k="${k}" class="${k === theme ? 'on' : ''}">${l}</button>`))}
      </div>
    </div>
    ${isAdmin ? html`<div class="card"><h2>ผู้ใช้งานและสิทธิ์</h2>
      <div class="tw"><table class="t"><thead><tr><th>ชื่อ</th><th>สิทธิ์</th></tr></thead><tbody>
        ${users.map((u) => html`<tr><td data-l="ชื่อ">${u.display_name}</td><td data-l="สิทธิ์">
          <select data-uid="${u.id}">${Object.entries(ROLE_TH).filter(([k]) => k !== 'anon').map(([k, l]) => raw(`<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`))}</select></td></tr>`)}
      </tbody></table></div></div>` : ''}
    <div class="card"><h2>เกี่ยวกับ</h2><p class="muted small">MatchON ระบบจัดการแข่งขันแบดมินตัน · ข้อมูลเก็บบน Supabase · คะแนนสดใช้ Firebase</p></div>`);
  $$('#th button', root).forEach((b) => (b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'auto') { delete document.documentElement.dataset.theme; store.set('matchon.theme', ''); }
    else { document.documentElement.dataset.theme = k; store.set('matchon.theme', k); }
    $$('#th button', root).forEach((x) => x.classList.toggle('on', x === b));
  }));
  const be = $('#beorg', root);
  if (be) be.onclick = () => busy(be, async () => {
    const { error } = await sb.rpc('become_organizer', { p_name: S.name });
    if (error) throw error;
    toast('เปลี่ยนเป็นผู้จัดการแข่งขันแล้ว');
    location.reload();
  });
  $$('select[data-uid]', root).forEach((sel) => (sel.onchange = async () => {
    const { error } = await sb.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.uid);
    toast(error ? error.message : 'บันทึกสิทธิ์แล้ว', error ? 'err' : 'ok');
  }));
}
