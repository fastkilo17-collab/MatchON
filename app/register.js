import { openRegEdit } from './regedit.js';
import {
  sb, S, html, raw, mount, $, $$, toast, busy, esc, baht, fmtDate, fmtRange, fmtTime, uuid, go, uploadImage, teamName,
  PAY_TH, REG_STATUS_TH, KIND_TH, GENDER_TH, ageProblem, store, MATCH_TH, scoreText,
} from './core.js';
import { promptPayPayload } from '../v1/js/promptpay.js';
import { qrToCanvas } from '../js/qr.js';

const REGS = 'matchon.regs';
const savedRegs = () => { try { return JSON.parse(store.get(REGS) || '[]'); } catch { return []; } };
const saveReg = (rec) => store.set(REGS, JSON.stringify([rec, ...savedRegs().filter((x) => x.id !== rec.id)].slice(0, 30)));
const PLAYER = 'matchon.player';

// ---------------------------------------------------------------- choose a tournament
export async function registerHome(root) {
  const open = S.tournaments.filter((t) => t.status === 'open' && (!t.reg_deadline || new Date(t.reg_deadline) > new Date()));
  mount(root, html`
    <div class="hero"><h1>สมัครแข่งขันแบดมินตัน</h1><p>เลือกรายการ เลือกรุ่น กรอกข้อมูล ชำระเงิน แล้วรอผู้จัดอนุมัติ ทำได้ครบบนมือถือ</p></div>
    <div class="grid g2">
      ${open.length ? open.map((t) => html`<div class="card stack"><h3>${t.name}</h3>
        <div class="muted small">${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''}</div>
        ${t.reg_deadline ? html`<div class="small">ปิดรับสมัคร ${fmtDate(t.reg_deadline)}</div>` : ''}
        <a class="btn primary" href="#/register/${t.slug}">สมัครรายการนี้</a></div>`)
        : html`<div class="card empty" style="grid-column:1/-1">ตอนนี้ยังไม่มีรายการที่เปิดรับสมัคร</div>`}
    </div>
    ${savedRegs().length ? html`<a class="btn" href="#/my">🎫 ดูใบสมัครของฉัน (${savedRegs().length})</a>` : ''}`);
}

// ---------------------------------------------------------------- wizard
export async function registerPage(root, [slug]) {
  const t = S.tournaments.find((x) => x.slug === slug) || (await sb.from('tournaments').select('*').eq('slug', slug).maybeSingle()).data;
  if (!t) return mount(root, html`<div class="card"><p class="err">ไม่พบรายการนี้</p></div>`);
  const open = t.status === 'open' && (!t.reg_deadline || new Date(t.reg_deadline) > new Date());
  if (!open) return mount(root, html`<div class="card stack"><h2>${t.name}</h2><p class="err">ปิดรับสมัครแล้ว</p><a class="btn" href="#/register">← กลับ</a></div>`);
  const [{ data: cats }, { data: entries }] = await Promise.all([
    sb.from('categories').select('*').eq('tournament_id', t.id).order('sort').order('name'),
    sb.rpc('public_entries', { p_tournament: t.id }),
  ]);
  if (!cats || !cats.length) return mount(root, html`<div class="card"><p class="muted">ผู้จัดยังไม่ได้เปิดรุ่นให้สมัคร</p></div>`);
  const used = {};
  (entries || []).forEach((e) => { if (e.status === 'pending' || e.status === 'confirmed') used[e.category_id] = (used[e.category_id] || 0) + 1; });

  let prev = {};
  try { prev = JSON.parse(store.get(PLAYER) || '{}'); } catch { /* ignore */ }
  const F = { step: 1, catIds: [], p1: { name: prev.name || '', nick: prev.nick || '', phone: prev.phone || '', year: prev.year || '' }, p2: { name: '', nick: '', phone: '', year: '' }, video: '', club: '', files: {} };
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const doubles = () => F.catIds.some((id) => catById[id].kind === 'doubles');
  const total = () => F.catIds.reduce((n, id) => n + catById[id].fee, 0);
  const ce = (y) => { if (!y) return null; const n = Number(y); return n > 2400 ? n - 543 : n; };

  const draw = () => {
    const bar = `<div class="steps">${[1, 2, 3].map((i) => `<i class="${i <= F.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let body = '';
    if (F.step === 1) {
      body = html`<h2>1. เลือกรุ่นที่ต้องการสมัคร</h2><p class="muted small">เลือกได้หลายรุ่นตามเงื่อนไข (เช่น เดี่ยวและคู่)</p>
        ${cats.map((c) => {
          const full = (used[c.id] || 0) >= c.max_teams;
          return html`<label class="catopt"><input type="checkbox" value="${c.id}" ${F.catIds.includes(c.id) ? raw('checked') : ''}>
            <span><b>${c.name}</b><br><small class="muted">${KIND_TH[c.kind]} · ${GENDER_TH[c.gender]}${c.level ? ' · มือ ' + c.level : ''}${c.age_min != null || c.age_max != null ? ` · อายุ ${c.age_min ?? ''}–${c.age_max ?? ''} ปี` : ''}${full ? ' · เต็ม ลงสำรองได้' : ` · เหลือ ${c.max_teams - (used[c.id] || 0)}`}</small></span>
            <span class="fee">${c.fee ? baht(c.fee) : 'ฟรี'}</span></label>`;
        })}`;
    } else if (F.step === 2) {
      const person = (n, label) => html`<div class="card stack"><h3>${label}</h3>
        <label class="field"><span>ชื่อ-นามสกุล</span><input data-f="p${n}.name" value="${F['p' + n].name}" maxlength="80" autocomplete="name"></label>
        <label class="field"><span>ชื่อเล่น (แสดงบนจอ)</span><input data-f="p${n}.nick" value="${F['p' + n].nick}" maxlength="40"></label>
        <label class="field"><span>เบอร์โทร${n === 2 ? ' (ไม่บังคับ)' : ''}</span><input data-f="p${n}.phone" type="tel" inputmode="tel" value="${F['p' + n].phone}" maxlength="20"></label>
        <label class="field"><span>ปีเกิด พ.ศ. ${F.catIds.some((id) => catById[id].age_min != null || catById[id].age_max != null) ? '(รุ่นที่เลือกกำหนดอายุ ต้องกรอก)' : '(ไม่บังคับ)'}</span><input data-f="p${n}.year" inputmode="numeric" maxlength="4" placeholder="2538" value="${F['p' + n].year}"></label>
        <label class="field"><span>รูปนักกีฬา (บังคับ)</span><input data-file="p${n}" type="file" accept="image/*"></label></div>`;
      body = html`<h2>2. ข้อมูลนักกีฬา</h2>
        <label class="field"><span>ชื่อทีม / ก๊วน / สโมสร</span><input data-f="club" value="${F.club}" maxlength="60" placeholder="เช่น ก๊วนเจอแน่"></label>${person(1, 'ผู้สมัคร')}${doubles() ? person(2, 'คู่ของคุณ') : ''}
        <label class="field"><span>ลิงก์วิดีโอการเล่น (ไม่บังคับ)</span><input data-f="video" type="url" inputmode="url" placeholder="https://youtube.com/…" value="${F.video}"></label>`;
    } else {
      body = html`<h2>3. ตรวจสอบและยืนยัน</h2>
        <div class="card stack">
          ${F.catIds.map((id) => html`<div class="row between"><span>${catById[id].name}</span><b>${catById[id].fee ? baht(catById[id].fee) : 'ฟรี'}</b></div>`)}
          <hr style="border:0;border-top:1px solid var(--line);width:100%">
          ${F.club.trim() ? html`<div class="row between"><b>ทีม</b><span>${F.club}</span></div>` : ''}
          <div class="row between"><b>ผู้สมัคร</b><span>${F.p1.nick || F.p1.name} · ${F.p1.phone}</span></div>
          ${doubles() ? html`<div class="row between"><b>คู่</b><span>${F.p2.nick || F.p2.name}</span></div>` : ''}
          <div class="row between"><b>รวมค่าสมัคร</b><b style="font-size:1.3rem;color:var(--blue)">${total() ? baht(total()) : 'ฟรี'}</b></div>
        </div>
        <label class="check"><input id="consent" type="checkbox"><span>ยินยอมให้ผู้จัดเก็บข้อมูล และแสดงชื่อ รูป และผลการแข่งขันของฉัน</span></label>`;
    }
    mount(root, html`<div class="hero"><h2>${t.name}</h2><p>${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''}</p></div>
      ${raw(bar)}<div class="stack">${body}</div>
      <div class="row" style="position:sticky;bottom:80px;background:var(--bg);padding:8px 0">
        ${F.step > 1 ? html`<button class="btn" id="back" style="flex:1">ย้อนกลับ</button>` : html`<a class="btn" href="#/register" style="flex:1">← รายการ</a>`}
        <button class="btn primary" id="next" style="flex:2">${F.step === 3 ? 'ส่งใบสมัคร' : 'ถัดไป'}</button></div>`);
    $$('input[type=checkbox][value]', root).forEach((c) => (c.onchange = () => {
      F.catIds = $$('input[type=checkbox][value]:checked', root).map((x) => x.value);
    }));
    $$('[data-f]', root).forEach((i) => (i.oninput = () => {
      const [a, b] = i.dataset.f.split('.');
      if (b) F[a][b] = i.value; else F[a] = i.value;
    }));
    $$('[data-file]', root).forEach((i) => (i.onchange = () => { F.files[i.dataset.file] = i.files[0] || null; }));
    const bk = $('#back', root);
    if (bk) bk.onclick = () => { F.step--; draw(); };
    $('#next', root).onclick = () => next();
  };

  const validate = () => {
    if (F.step === 1) return F.catIds.length ? '' : 'เลือกอย่างน้อย 1 รุ่น';
    if (F.step === 2) {
      if (!F.p1.name.trim() || !F.p1.phone.trim()) return 'กรอกชื่อและเบอร์โทรของผู้สมัคร';
      if (doubles() && !F.p2.name.trim()) return 'กรอกชื่อคู่ของคุณ';
      if (!F.files.p1) return 'ต้องใส่รูปนักกีฬา (ผู้สมัคร)';
      if (doubles() && !F.files.p2) return 'ต้องใส่รูปของคู่ด้วย';
      if (F.video && !/^https?:\/\//i.test(F.video)) return 'ลิงก์วิดีโอต้องขึ้นต้นด้วย http หรือ https';
      for (const [k, y] of [['p1', F.p1.year], ...(doubles() ? [['p2', F.p2.year]] : [])]) {
        if (y && (!Number.isInteger(ce(y)) || ce(y) < 1930 || ce(y) > 2030)) return 'ปีเกิดไม่ถูกต้อง กรอกเป็น พ.ศ. 4 หลัก เช่น 2538';
        for (const id of F.catIds) {
          const c = catById[id];
          if (k === 'p2' && c.kind !== 'doubles') continue;
          const p = ageProblem(c, ce(y));
          if (p) return `${c.name}: ${p}${k === 'p2' ? ' (คู่)' : ''}`;
        }
      }
    }
    return '';
  };

  const next = async () => {
    const e = validate();
    if (e) return toast(e, 'err');
    if (F.step < 3) { F.step++; draw(); window.scrollTo(0, 0); return; }
    if (!$('#consent', root).checked) return toast('กรุณาติ๊กยินยอมการเก็บข้อมูล', 'err');
    await busy($('#next', root), async () => {
      const photo = async (k) => (F.files[k] ? uploadImage('photos', `${t.id}/${uuid()}`, F.files[k], 800, 0.8) : null);
      const p1 = { name: F.p1.name.trim(), nick: F.p1.nick.trim(), phone: F.p1.phone.trim(), birth_year: ce(F.p1.year), photo: await photo('p1'), club: F.club.trim() };
      const p2 = doubles() ? { name: F.p2.name.trim(), nick: F.p2.nick.trim(), phone: F.p2.phone.trim(), birth_year: ce(F.p2.year), photo: await photo('p2') } : {};
      const made = [];
      for (const id of F.catIds) {
        const c = catById[id];
        const { data, error } = await sb.rpc('register_team', { p_tournament: t.id, p_category: id, p_p1: p1, p_p2: c.kind === 'doubles' ? p2 : {}, p_video: F.video.trim() || null });
        if (error) { if (made.length) toast(`สมัครสำเร็จ ${made.length} รุ่น แต่ "${c.name}" ไม่ผ่าน: ${error.message}`, 'err'); else throw error; break; }
        made.push(data);
        saveReg({ id: data.id, token: data.token, tournament: t.name, category: c.name, at: new Date().toISOString() });
      }
      store.set(PLAYER, JSON.stringify({ name: F.p1.name, nick: F.p1.nick, phone: F.p1.phone, year: F.p1.year }));
      if (made.length) go(made.length === 1 ? `#/status/${made[0].id}/${made[0].token}` : '#/my');
    });
  };
  draw();
}

// ---------------------------------------------------------------- my registrations
export async function myPage(root) {
  let rows = savedRegs().map((r) => ({ ...r }));
  if (S.user) {
    const { data } = await sb.from('registrations').select('id,edit_token,p1_name,status,pay_status,category_id,tournament_id,created_at').eq('user_id', S.user.id);
    for (const r of data || []) if (!rows.some((x) => x.id === r.id)) rows.push({ id: r.id, token: r.edit_token, tournament: (S.tournaments.find((t) => t.id === r.tournament_id) || {}).name || '', category: '', at: r.created_at });
  }
  mount(root, html`<h2>ใบสมัครของฉัน</h2>
    ${rows.length ? rows.map((r) => html`<a class="card row between" href="#/status/${r.id}/${r.token}" style="color:var(--ink)">
      <span><b>${r.tournament}</b><br><span class="muted small">${r.category || ''} · ${fmtDate((r.at || '').slice(0, 10))}</span></span><span>›</span></a>`)
      : html`<div class="card empty">ยังไม่มีใบสมัครบนอุปกรณ์นี้ ${S.user ? '' : html`<br><a href="#/login">เข้าสู่ระบบ</a> เพื่อดูใบสมัครจากอุปกรณ์อื่น`}</div>`}`);
}

// ---------------------------------------------------------------- status, payment, my matches, notifications
export async function statusPage(root, [regId, token]) {
  const draw = async () => {
    const { data: r, error } = await sb.rpc('my_registration', { p_reg: regId, p_token: token });
    if (error || !r) return mount(root, html`<div class="card"><p class="err">ไม่พบใบสมัคร ตรวจลิงก์อีกครั้ง</p><a class="btn" href="#/my">← ใบสมัครของฉัน</a></div>`);
    const [notes, ms, ents] = await Promise.all([
      sb.rpc('my_notifications', { p_reg: regId, p_token: token }),
      sb.from('matches').select('*').eq('tournament_id', r.tournament_id).or(`reg_a.eq.${regId},reg_b.eq.${regId}`).order('scheduled_at', { nullsFirst: false }),
      sb.rpc('public_entries', { p_tournament: r.tournament_id }),
    ]);
    const E = Object.fromEntries((ents.data || []).map((e) => [e.id, e]));
    const needsPay = r.fee > 0 && ['pending', 'confirmed'].includes(r.status) && r.pay_status !== 'paid';
    const canPay = needsPay && r.promptpay_id;
    const ok = r.status === 'confirmed' && (r.pay_status === 'paid' || r.fee === 0);
    mount(root, html`
      <a class="btn sm" href="#/my" style="align-self:flex-start">← ใบสมัครของฉัน</a>
      <div class="card stack"><div class="muted">${r.tournament_name} · ${r.category}</div>
        <h2>${r.p1_name}${r.p2_name ? ' / ' + r.p2_name : ''}</h2>
        <div class="row"><span class="pill ${r.status === 'confirmed' ? 'ok' : r.status === 'cancelled' ? 'err' : 'warn'}">${REG_STATUS_TH[r.status]}</span>
          <span class="pill ${r.pay_status === 'paid' ? 'ok' : r.pay_status === 'rejected' ? 'err' : 'warn'}">${PAY_TH[r.pay_status]}</span></div>
        ${ok ? html`<p class="ok"><b>ยืนยันการสมัครเรียบร้อย</b> พบกันวันแข่ง</p>` : ''}
        ${r.status === 'waitlist' ? html`<p>รุ่นนี้เต็มแล้ว คุณอยู่ในรายชื่อสำรอง</p>` : ''}
        ${r.club ? html`<div class="muted">ทีม: ${r.club}</div>` : ''}
        ${r.status !== 'cancelled' ? html`<button class="btn sm" id="editreg" style="align-self:flex-start">${r.open ? '✏ แก้ไขข้อมูลสมัคร' : 'ปิดรับสมัครแล้ว (แก้ไขไม่ได้)'}</button>` : ''}
      </div>
      ${needsPay ? payCard(r, canPay) : ''}
      <div class="card"><h3>ตารางแข่งของฉัน</h3>
        ${(ms.data || []).length ? (ms.data || []).map((m) => html`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div class="row between"><b>${m.match_no ? '#' + m.match_no + ' · ' : ''}${m.round_label || ''}</b><span class="pill ${m.status === 'live' ? 'live' : m.status === 'finished' ? 'ok' : 'gray'}">${MATCH_TH[m.status]}</span></div>
          <div>${teamName(E[m.reg_a])} <span class="muted">vs</span> ${teamName(E[m.reg_b])}</div>
          <div class="muted small">${m.court ? 'สนาม ' + m.court : 'ยังไม่กำหนดสนาม'}${m.scheduled_at ? ' · ' + fmtDate(m.scheduled_at) + ' ' + fmtTime(m.scheduled_at) : ''}${scoreText(m) ? ' · ' + scoreText(m) : ''}</div></div>`)
          : html`<div class="empty">ยังไม่มีตารางแข่ง ผู้จัดจะแจ้งเมื่อจัดสายเสร็จ</div>`}
      </div>
      <div class="card"><h3>การแจ้งเตือน</h3>
        ${(notes.data || []).length ? (notes.data || []).map((n) => html`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${n.title}</b>
          <div class="small">${n.body || ''}</div><div class="muted small">${fmtDate(n.created_at)} ${fmtTime(n.created_at)}</div></div>`)
          : html`<div class="empty">ยังไม่มีการแจ้งเตือน</div>`}
      </div>
      <dialog id="pd"></dialog>`);

    const er = $('#editreg', root);
    if (er) er.onclick = () => { if (!r.open) return toast('ปิดรับสมัครแล้ว ติดต่อผู้จัดเพื่อแก้ไข', 'err'); openRegEdit($('#pd', root), { ...r, tournament_id: r.tournament_id }, { mode: 'player', token, onSaved: draw }); };
    const cp = $('#chpartner', root);
    if (cp) {
      cp.onclick = () => $('#pd', root).showModal();
      $('#psave', root).onclick = () => busy($('#psave', root), async () => {
        const y = Number($('#y2', root).value);
        const { error: e2 } = await sb.rpc('update_partner', { p_reg: regId, p_token: token, p_p2: { name: $('#n2', root).value, nick: $('#k2', root).value, phone: $('#h2', root).value, birth_year: y ? (y > 2400 ? y - 543 : y) : null } });
        if (e2) throw e2;
        $('#pd', root).close();
        toast('เปลี่ยนคู่แล้ว');
        draw();
      });
    }
    const form = $('#slip-form', root);
    if (form) form.onsubmit = async (ev) => {
      ev.preventDefault();
      const f = $('#slip', root).files[0];
      if (!f) return toast('เลือกรูปสลิปก่อน', 'err');
      await busy($('button', form), async () => {
        const path = await uploadImage('slips', `${r.tournament_id}/${r.id}/${Date.now()}`, f, 1200, 0.75);
        const { error: e2 } = await sb.rpc('submit_slip', { p_reg: r.id, p_token: token, p_path: path });
        if (e2) throw e2;
        toast('ส่งสลิปแล้ว รอผู้จัดตรวจสอบ');
        draw();
      });
    };
    const cv = $('#qr', root);
    if (cv && canPay) {
      try { qrToCanvas(cv, promptPayPayload(r.promptpay_id, r.fee), 260); }
      catch (e) { cv.replaceWith(Object.assign(document.createElement('p'), { textContent: `โอนเข้า PromptPay ${r.promptpay_id} ยอด ${baht(r.fee)}` })); }
    }
  };
  await draw();
}

function payCard(r, canPay) {
  if (!canPay) return html`<div class="card"><h3>ชำระค่าสมัคร ${baht(r.fee)}</h3><p class="muted">ผู้จัดยังไม่ได้ตั้งบัญชีรับเงิน ติดต่อผู้จัดโดยตรง</p></div>`;
  return html`<div class="card stack center"><h3>ชำระค่าสมัคร ${baht(r.fee)}</h3>
    <div><span class="qr"><canvas id="qr" width="260" height="260"></canvas></span></div>
    <p class="muted small">สแกนด้วยแอปธนาคาร ยอดตรงกับค่าสมัครอัตโนมัติ</p>
    ${r.pay_status === 'rejected' ? html`<p class="err">สลิปไม่ผ่านการตรวจ กรุณาส่งใหม่</p>` : ''}
    ${r.pay_status === 'slip_sent' ? html`<p class="ok">ส่งสลิปแล้ว รอผู้จัดตรวจสอบ ส่งใหม่ได้ถ้าส่งผิด</p>` : ''}
    <form id="slip-form" class="stack"><label class="field"><span>แนบรูปสลิป</span><input id="slip" type="file" accept="image/*"></label>
      <button class="btn primary" type="submit">ส่งสลิป</button></form></div>`;
}
