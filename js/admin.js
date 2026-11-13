import {
  sb, html, mount, raw, $, $$, toast, errMsg, busy, baht, fmtDate, fmtRange, fmtTime, uuid, go, uploadImage, publicUrl,
  teamName, STATUS_TH, REG_STATUS_TH, PAY_TH,
} from './lib.js';
import { buildKnockout, buildRoundRobin, autoSchedule } from './bracket.js';

// ------------------------------------------------------------------ auth
export async function currentUser() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

async function ensureOrganizer(user) {
  const { data } = await sb.from('organizers').select('id').eq('id', user.id).maybeSingle();
  if (data) return;
  const name = (user.user_metadata && user.user_metadata.name) || (user.email || '').split('@')[0];
  const { error } = await sb.from('organizers').insert({ id: user.id, name });
  if (error) throw error;
}

async function requireUser(root, retry) {
  const u = await currentUser();
  if (u) {
    await ensureOrganizer(u);
    return u;
  }
  loginView(root, retry);
  return null;
}

function loginView(root, after) {
  mount(
    root,
    html`<section class="wrap narrow">
      <h1>ผู้จัดเข้าสู่ระบบ</h1>
      <form id="auth" class="card stack" novalidate>
        <label class="field"><span>อีเมล</span><input id="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>รหัสผ่าน (อย่างน้อย 8 ตัว)</span><input id="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <label class="field" id="name-field" hidden><span>ชื่อก๊วนหรือผู้จัด</span><input id="oname" maxlength="60"></label>
        <button class="btn primary" type="submit" id="login-btn">เข้าสู่ระบบ</button>
        <button class="btn" type="button" id="toggle">สมัครเป็นผู้จัดใหม่</button>
      </form>
    </section>`
  );
  let signup = false;
  $('#toggle', root).addEventListener('click', () => {
    signup = !signup;
    $('#name-field', root).hidden = !signup;
    $('#login-btn', root).textContent = signup ? 'สมัครเป็นผู้จัด' : 'เข้าสู่ระบบ';
    $('#toggle', root).textContent = signup ? 'มีบัญชีแล้ว เข้าสู่ระบบ' : 'สมัครเป็นผู้จัดใหม่';
  });
  $('#auth', root).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('#email', root).value.trim();
    const password = $('#password', root).value;
    if (!email || password.length < 8) return toast('กรอกอีเมลและรหัสผ่านอย่างน้อย 8 ตัว', 'err');
    await busy($('#login-btn', root), async () => {
      if (signup) {
        const name = $('#oname', root).value.trim() || email.split('@')[0];
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
        if (error) throw error;
        if (!data.session) return toast('ส่งอีเมลยืนยันแล้ว กดลิงก์ในอีเมลแล้วกลับมาเข้าสู่ระบบ');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      document.dispatchEvent(new Event('courtday:auth'));
      after();
    });
  });
}

// ------------------------------------------------------------------ organizer home
export async function adminHome(root) {
  const user = await requireUser(root, () => adminHome(root));
  if (!user) return;
  mount(root, html`<section class="wrap"><div class="skeleton">กำลังโหลด…</div></section>`);
  const { data, error } = await sb
    .from('tournaments')
    .select('id,name,status,start_date,end_date,venue,slug')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return mount(root, html`<section class="wrap"><p class="err">${errMsg(error)}</p></section>`);
  mount(
    root,
    html`<section class="wrap">
      <h1>รายการแข่งของฉัน</h1>
      <div class="grid">
        ${data.map((t) => html`<a class="card tcard" href="#/admin/t/${t.id}">
          <span class="pill st-${t.status}">${STATUS_TH[t.status]}</span>
          <h2>${t.name}</h2>
          <span class="muted">${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''}</span>
        </a>`)}
      </div>
      <form id="new-t" class="card stack">
        <h2>สร้างรายการใหม่</h2>
        <label class="field"><span>ชื่อรายการ</span><input id="n-name" required minlength="3" maxlength="120" placeholder="ศึกก๊วนเช้าวันเสาร์ Open 2569"></label>
        <label class="field"><span>สถานที่</span><input id="n-venue" maxlength="120"></label>
        <div class="row2">
          <label class="field"><span>วันเริ่มแข่ง</span><input id="n-start" type="date"></label>
          <label class="field"><span>วันสุดท้าย</span><input id="n-end" type="date"></label>
        </div>
        <button class="btn primary" type="submit">สร้างรายการ</button>
      </form>
    </section>`
  );
  $('#new-t', root).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await busy($('button', ev.target), async () => {
      const row = {
        organizer_id: user.id,
        name: $('#n-name', root).value.trim(),
        venue: $('#n-venue', root).value.trim() || null,
        start_date: $('#n-start', root).value || null,
        end_date: $('#n-end', root).value || null,
      };
      const { data: t, error: e } = await sb.from('tournaments').insert(row).select('id').single();
      if (e) throw e;
      go(`#/admin/t/${t.id}`);
    });
  });
}

// ------------------------------------------------------------------ tournament management
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const TYPES = [
  ['ชายเดี่ยว', 'singles'], ['หญิงเดี่ยว', 'singles'], ['ชายคู่', 'doubles'], ['หญิงคู่', 'doubles'], ['คู่ผสม', 'doubles'],
];

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export async function adminTournament(root, id) {
  const user = await requireUser(root, () => adminTournament(root, id));
  if (!user) return;
  root.innerHTML = '';
  const view = document.createElement('div');
  root.appendChild(view);
  mount(view, html`<section class="wrap"><div class="skeleton">กำลังโหลด…</div></section>`);

  const S = { tab: 'overview', t: null, cats: [], regs: [], matches: [], posters: [], fCat: '', fStatus: '' };
  const load = async () => {
    const [t, c, r, m, p] = await Promise.all([
      sb.from('tournaments').select('*').eq('id', id).maybeSingle(),
      sb.from('categories').select('*').eq('tournament_id', id).order('sort').order('name'),
      sb.from('registrations').select('*').eq('tournament_id', id).order('created_at'),
      sb.from('matches').select('*').eq('tournament_id', id).order('round').order('slot'),
      sb.from('tournament_posters').select('*').eq('tournament_id', id).order('sort').order('created_at'),
    ]);
    const bad = [t, c, r, m, p].find((x) => x.error);
    if (bad) throw bad.error;
    S.t = t.data; S.cats = c.data; S.regs = r.data; S.matches = m.data; S.posters = p.data;
  };
  try {
    await load();
  } catch (e) {
    return mount(view, html`<section class="wrap"><p class="err">${errMsg(e)}</p></section>`);
  }
  if (!S.t || S.t.organizer_id !== user.id) {
    return mount(view, html`<section class="wrap"><p class="err">ไม่พบรายการ</p><a href="#/admin">กลับ</a></section>`);
  }

  const catName = (cid) => S.cats.find((c) => c.id === cid)?.name || '';
  const nameOf = (rid) => (rid ? teamName(S.regs.find((r) => r.id === rid)) : 'รอผลการแข่ง');
  const render = () => {
    const tabs = [['overview', 'ภาพรวม'], ['settings', 'ตั้งค่า'], ['cats', 'ประเภท'], ['regs', `ผู้สมัคร (${S.regs.filter((r) => r.status !== 'cancelled').length})`], ['draw', 'สายและตาราง'], ['posters', 'โปสเตอร์']];
    const body = { overview: tabOverview, settings: tabSettings, cats: tabCats, regs: tabRegs, draw: tabDraw, posters: tabPosters }[S.tab](S, { catName, nameOf });
    mount(
      view,
      html`<section class="wrap">
        <a class="back" href="#/admin">← รายการทั้งหมด</a>
        <div class="titlebar">
          <h1>${S.t.name}</h1>
          <span class="pill st-${S.t.status}">${STATUS_TH[S.t.status]}</span>
          ${S.t.status !== 'draft' ? html`<a class="btn" href="#/t/${S.t.slug}" target="_blank" rel="noopener">เปิดหน้าสาธารณะ</a>` : ''}
        </div>
        <nav class="tabs" role="tablist">${tabs.map(([k, l]) => html`<button type="button" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${l}</button>`)}</nav>
        <div class="tabbody">${body}</div>
      </section>`
    );
  };
  const reload = async () => {
    await load();
    render();
  };
  render();

  // ---- clicks
  view.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-tab],[data-act]');
    if (!el) return;
    if (el.dataset.tab) {
      S.tab = el.dataset.tab;
      if (el.dataset.f !== undefined) S.fStatus = el.dataset.f;
      return render();
    }
    const act = el.dataset.act;
    const run = (fn) => busy(el, async () => { await fn(); await reload(); });
    const rid = el.dataset.id;

    if (act === 'del-cat') {
      if (!confirm('ลบประเภทนี้?')) return;
      return run(async () => {
        const { error } = await sb.from('categories').delete().eq('id', rid);
        if (error) throw new Error('ลบไม่ได้ ประเภทนี้มีผู้สมัครแล้ว ย้ายหรือยกเลิกผู้สมัครก่อน');
      });
    }
    if (act === 'save-cat') {
      const row = el.closest('[data-cat-row]');
      return run(async () => {
        const { error } = await sb.from('categories').update({
          name: $('[name=name]', row).value.trim(),
          kind: $('[name=kind]', row).value,
          level: $('[name=level]', row).value.trim() || null,
          max_teams: Number($('[name=max]', row).value),
          fee: Number($('[name=fee]', row).value),
          format: $('[name=format]', row).value,
        }).eq('id', rid);
        if (error) throw error;
        toast('บันทึกแล้ว');
      });
    }
    if (act === 'approve' || act === 'reject' || act === 'cancel' || act === 'promote' || act === 'confirm') {
      const patch = {
        approve: { pay_status: 'paid', status: 'confirmed' },
        confirm: { status: 'confirmed' },
        reject: { pay_status: 'rejected' },
        cancel: { status: 'cancelled' },
        promote: { status: 'pending' },
      }[act];
      if (act === 'cancel' && !confirm('ยกเลิกการสมัครนี้?')) return;
      return run(async () => {
        const { error } = await sb.from('registrations').update(patch).eq('id', rid);
        if (error) throw error;
      });
    }
    if (act === 'slip') {
      const reg = S.regs.find((r) => r.id === rid);
      const { data, error } = await sb.storage.from('slips').createSignedUrl(reg.slip_path, 300);
      if (error) return toast(errMsg(error), 'err');
      return window.open(data.signedUrl, '_blank', 'noopener');
    }
    if (act === 'csv') return exportCsv(S, catName);
    if (act === 'gen') {
      const cat = S.cats.find((c) => c.id === rid);
      const existing = S.matches.filter((m) => m.category_id === rid);
      if (existing.some((m) => m.status !== 'scheduled' && !(m.round === 1 && m.status === 'finished' && !(m.reg_a && m.reg_b)))) {
        return toast('ประเภทนี้เริ่มแข่งแล้ว สร้างสายใหม่ไม่ได้', 'err');
      }
      const teams = S.regs.filter((r) => r.category_id === rid && r.status === 'confirmed');
      if (teams.length < 2) return toast('ต้องมีทีมที่ยืนยันแล้วอย่างน้อย 2 ทีม', 'err');
      if (existing.length && !confirm('สร้างสายใหม่จะลบสายเดิมของประเภทนี้ ดำเนินการต่อ?')) return;
      const seeded = teams.filter((r) => r.seed != null).sort((a, b) => a.seed - b.seed);
      const rest = shuffle(teams.filter((r) => r.seed == null));
      const ids = [...seeded, ...rest].map((r) => r.id);
      const opts = { tournamentId: id, categoryId: rid, uuid };
      const rows = cat.format === 'round_robin' ? buildRoundRobin(ids, opts) : buildKnockout(ids, opts);
      return run(async () => {
        if (existing.length) {
          const { error: de } = await sb.from('matches').delete().eq('category_id', rid);
          if (de) throw de;
        }
        const { error } = await sb.from('matches').insert(rows);
        if (error) throw error;
        toast(`สร้างสายแล้ว ${rows.length} แมตช์`);
      });
    }
    if (act === 'schedule') {
      const start = $('#sch-start', view).value;
      const mins = Number($('#sch-mins', view).value);
      if (!start || !(mins > 0)) return toast('ใส่เวลาเริ่มและนาทีต่อแมตช์', 'err');
      const items = autoSchedule(S.matches, { courts: S.t.courts, start: new Date(start), minutesPerMatch: mins });
      if (!items.length) return toast('ไม่มีแมตช์ให้จัดตาราง', 'err');
      return run(async () => {
        const { error } = await sb.rpc('schedule_matches', { p_tournament: id, p_items: items });
        if (error) throw error;
        toast(`จัดตารางแล้ว ${items.length} แมตช์`);
      });
    }
    if (act === 'del-poster') {
      const p = S.posters.find((x) => x.id === rid);
      return run(async () => {
        await sb.storage.from('posters').remove([p.path]);
        const { error } = await sb.from('tournament_posters').delete().eq('id', rid);
        if (error) throw error;
      });
    }
  });

  // ---- inline changes (move category, court, seed)
  view.addEventListener('change', async (ev) => {
    const el = ev.target;
    const act = el.dataset.change;
    if (!act) {
      if (el.id === 'f-cat') { S.fCat = el.value; return render(); }
      if (el.id === 'f-status') { S.fStatus = el.value; return render(); }
      return;
    }
    let q;
    if (act === 'move') q = sb.from('registrations').update({ category_id: el.value }).eq('id', el.dataset.id);
    if (act === 'seed') q = sb.from('registrations').update({ seed: el.value === '' ? null : Number(el.value) }).eq('id', el.dataset.id);
    if (act === 'court') q = sb.from('matches').update({ court: el.value === '' ? null : Number(el.value) }).eq('id', el.dataset.id);
    const { error } = await q;
    if (error) toast(errMsg(error), 'err');
    else toast('บันทึกแล้ว');
    await reload();
  });

  // ---- forms
  view.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const btn = $('button[type=submit]', form);
    const done = async () => { await reload(); };
    if (form.id === 'f-settings') {
      return busy(btn, async () => {
        const v = (n) => form.elements[n].value.trim();
        const row = {
          name: v('name'), venue: v('venue') || null, description: v('description') || null,
          start_date: v('start_date') || null, end_date: v('end_date') || null,
          reg_deadline: v('reg_deadline') ? new Date(v('reg_deadline')).toISOString() : null,
          courts: Number(v('courts')), status: v('status'),
          promptpay_id: v('promptpay_id').replace(/\D/g, '') || null,
          rules: { points: Number(v('points')), best_of: Number(v('best_of')), cap: Number(v('cap')) },
        };
        const { error } = await sb.from('tournaments').update(row).eq('id', id);
        if (error) throw error.code === '23514' ? new Error('เลข PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตร/ภาษี 13 หลัก') : error;
        toast('บันทึกแล้ว');
        await done();
      });
    }
    if (form.id === 'f-newcat') {
      return busy(btn, async () => {
        const v = (n) => form.elements[n].value.trim();
        const { error } = await sb.from('categories').insert({
          tournament_id: id, name: v('name'), kind: v('kind'), level: v('level') || null,
          max_teams: Number(v('max')), fee: Number(v('fee')), format: v('format'), sort: S.cats.length,
        });
        if (error) throw error;
        form.reset();
        await done();
      });
    }
    if (form.id === 'f-preset') {
      return busy(btn, async () => {
        const types = $$('[name=type]:checked', form).map((x) => TYPES[Number(x.value)]);
        const levels = $$('[name=lv]:checked', form).map((x) => x.value);
        if (!types.length || !levels.length) throw new Error('เลือกประเภทและระดับอย่างน้อยอย่างละหนึ่ง');
        const feeS = Number(form.elements.feeS.value);
        const feeD = Number(form.elements.feeD.value);
        const rows = types.flatMap(([name, kind]) => levels.map((lv, i) => ({
          tournament_id: id, name: `${name} ${lv}`, kind, level: lv,
          max_teams: kind === 'singles' ? 32 : 32, fee: kind === 'singles' ? feeS : feeD,
          format: 'knockout', sort: S.cats.length + i,
        })));
        const { error } = await sb.from('categories').insert(rows);
        if (error) throw error;
        toast(`เพิ่ม ${rows.length} ประเภทแล้ว`);
        await done();
      });
    }
    if (form.id === 'f-poster') {
      const files = [...form.elements.files.files];
      if (!files.length) return toast('เลือกรูปก่อน', 'err');
      if (S.posters.length + files.length > 10) return toast('โปสเตอร์ได้ไม่เกิน 10 รูป', 'err');
      return busy(btn, async () => {
        for (const f of files) {
          const path = await uploadImage('posters', `${id}/${uuid()}`, f, 1600, 0.82);
          const { error } = await sb.from('tournament_posters').insert({ tournament_id: id, path, sort: S.posters.length });
          if (error) throw error;
        }
        form.reset();
        await done();
      });
    }
  });
}

// ---- overview (steps, numbers, to-do, recent applicants)
function tabOverview(S, { catName }) {
  const live = S.regs.filter((r) => r.status !== 'cancelled' && r.status !== 'waitlist');
  const fee = (r) => S.cats.find((c) => c.id === r.category_id)?.fee || 0;
  const seats = S.cats.reduce((n, c) => n + (c.max_teams || 0), 0);
  const paidRegs = S.regs.filter((r) => r.pay_status === 'paid');
  const paidSum = paidRegs.reduce((n, r) => n + fee(r), 0);
  const slips = S.regs.filter((r) => r.pay_status === 'slip_sent');
  const waiting = S.regs.filter((r) => r.status === 'waitlist');
  const t = S.t;
  const hasDraw = S.matches.length > 0;
  const idx = t.status === 'draft' ? 0 : t.status === 'open' ? 1 : hasDraw ? 4 : 3;
  const steps = [
    ['สร้างรายการ', 'ตั้งค่าเสร็จแล้ว'],
    ['รับสมัคร', t.reg_deadline ? 'ปิดรับ ' + fmtDate(t.reg_deadline) : 'ปิดรับด้วยมือ'],
    ['ชำระเงิน', slips.length ? `รอตรวจสลิป ${slips.length} รายการ` : 'ไม่มีสลิปค้าง'],
    ['จัดสายและตาราง', hasDraw ? `${S.matches.length} แมตช์` : 'ยังไม่ได้สร้างสาย'],
    ['วันแข่ง', t.start_date ? fmtDate(t.start_date) : '–'],
  ];
  const pct = (n, d) => (d ? Math.min(100, Math.round((n / d) * 100)) : 0);
  const todo = [];
  if (slips.length) todo.push(['ตรวจสลิปโอนเงิน', `${slips.length} รายการ`, 'ตรวจสลิป', 'regs', 'slip_sent']);
  if (waiting.length) todo.push(['มีทีมสำรองรออยู่', `${waiting.length} ทีม`, 'ดูรายชื่อสำรอง', 'regs', 'waitlist']);
  if (!hasDraw && live.length > 1) todo.push(['ยังไม่ได้สร้างสาย', 'พร้อมเมื่อปิดรับสมัคร', 'ไปสร้างสาย', 'draw', '']);
  if (!todo.length) todo.push(['ไม่มีงานค้าง', 'ทุกอย่างเรียบร้อย', 'ดูผู้สมัคร', 'regs', '']);
  const recent = [...S.regs].filter((r) => r.status !== 'cancelled').reverse().slice(0, 6);
  return html`
    <section class="card steps" aria-label="ขั้นตอนของรายการ">
      ${steps.map(([l, sub], i) => html`<div class="step ${i < idx ? 'done' : i === idx ? 'now' : ''}">
        <div class="step-top"><span class="dot">${i < idx ? '✓' : i + 1}</span><span class="line"></span></div>
        <b>${l}</b><span class="muted small">${sub}</span></div>`)}
    </section>
    <section class="kpis" aria-label="สรุปตัวเลข">
      <div class="card kpi"><span class="muted small">ทีมที่สมัคร</span>
        <p><b>${live.length}</b> <span class="muted">${seats ? `จาก ${seats} ที่นั่ง` : 'ทีม'}</span></p>
        <div class="bar"><i style="width:${pct(live.length, seats)}%"></i></div></div>
      <div class="card kpi"><span class="muted small">ชำระเงินแล้ว</span>
        <p><b>${paidRegs.length}</b> <span class="muted">รายการ · ${baht(paidSum)}</span></p></div>
      <div class="card kpi ${slips.length ? 'warn' : ''}"><span class="muted small">รอตรวจสลิป</span>
        <p><b>${slips.length}</b> <span class="muted">รายการ</span></p></div>
      <div class="card kpi"><span class="muted small">รายชื่อสำรอง</span>
        <p><b>${waiting.length}</b> <span class="muted">ทีม</span></p></div>
    </section>
    <div class="ov-cols">
      <section class="card flush">
        <div class="card-head"><h2>ผู้สมัครล่าสุด</h2><button class="linkbtn" type="button" data-tab="regs" data-f="">ดูทั้งหมด ${S.regs.length} รายการ</button></div>
        ${recent.length ? html`<div class="tablewrap"><table><thead><tr><th>ผู้สมัคร</th><th>ประเภท</th><th>ชำระเงิน</th></tr></thead>
          <tbody>${recent.map((r) => html`<tr><td><b>${r.p1_name}${r.p2_name ? ' / ' + r.p2_name : ''}</b><br><span class="muted small">${fmtDate(r.created_at)}</span></td>
            <td>${catName(r.category_id)}</td><td><span class="pill pay-${r.pay_status}">${PAY_TH[r.pay_status]}</span></td></tr>`)}</tbody></table></div>`
          : html`<p class="muted pad">ยังไม่มีผู้สมัคร ส่งลิงก์หน้าสมัครให้นักกีฬาได้เลย</p>`}
      </section>
      <aside class="ov-side">
        <section class="card"><h2>ต้องทำวันนี้</h2>
          ${todo.map(([a, b, cta, tab, f]) => html`<div class="todo"><div><b>${a}</b><br><span class="muted small">${b}</span></div>
            <button class="btn dark" type="button" data-tab="${tab}" data-f="${f}">${cta}</button></div>`)}
        </section>
        <section class="card"><h2>สมัครแต่ละประเภท</h2>
          ${S.cats.length ? S.cats.map((c) => {
            const n = live.filter((r) => r.category_id === c.id).length;
            return html`<div class="catbar"><div><span>${c.name}</span><span class="muted">${n} / ${c.max_teams}</span></div>
              <div class="bar ${n >= c.max_teams ? 'full' : ''}"><i style="width:${pct(n, c.max_teams)}%"></i></div></div>`;
          }) : html`<p class="muted">ยังไม่มีประเภท เพิ่มที่แท็บ “ประเภท”</p>`}
        </section>
      </aside>
    </div>`;
}

// ---- tab renderers
function tabSettings(S) {
  const t = S.t;
  const r = t.rules || {};
  return html`<form id="f-settings" class="card stack">
    <label class="field"><span>ชื่อรายการ</span><input name="name" value="${t.name}" required maxlength="120"></label>
    <label class="field"><span>สถานที่</span><input name="venue" value="${t.venue || ''}" maxlength="120"></label>
    <label class="field"><span>รายละเอียด</span><textarea name="description" rows="4">${t.description || ''}</textarea></label>
    <div class="row2">
      <label class="field"><span>วันเริ่มแข่ง</span><input name="start_date" type="date" value="${t.start_date || ''}"></label>
      <label class="field"><span>วันสุดท้าย</span><input name="end_date" type="date" value="${t.end_date || ''}"></label>
    </div>
    <div class="row2">
      <label class="field"><span>ปิดรับสมัคร (ไม่ใส่ = ปิดด้วยมือ)</span><input name="reg_deadline" type="datetime-local" value="${toLocalInput(t.reg_deadline)}"></label>
      <label class="field"><span>จำนวนคอร์ต</span><input name="courts" type="number" min="1" max="40" value="${t.courts}"></label>
    </div>
    <label class="field"><span>PromptPay รับเงิน (เบอร์มือถือ 10 หลัก หรือเลข 13 หลัก)</span><input name="promptpay_id" inputmode="numeric" value="${t.promptpay_id || ''}" maxlength="15"></label>
    <div class="row3">
      <label class="field"><span>แต้มต่อเกม</span><input name="points" type="number" min="5" max="30" value="${r.points || 21}"></label>
      <label class="field"><span>แข่งกี่เกม (ชนะเกินครึ่ง)</span><select name="best_of"><option value="1" ${(r.best_of || 3) === 1 ? raw('selected') : ''}>1 เกม</option><option value="3" ${(r.best_of || 3) === 3 ? raw('selected') : ''}>ชนะ 2 ใน 3</option></select></label>
      <label class="field"><span>แต้มสูงสุด</span><input name="cap" type="number" min="5" max="40" value="${r.cap || 30}"></label>
    </div>
    <label class="field"><span>สถานะรายการ</span>
      <select name="status">${Object.entries(STATUS_TH).map(([k, l]) => html`<option value="${k}" ${t.status === k ? raw('selected') : ''}>${l}</option>`)}</select>
      <small class="muted">ร่าง = มองไม่เห็นในหน้าสาธารณะ · รับสมัคร = เปิดฟอร์ม · กำลังแข่ง = เปิดจอคอร์ต</small></label>
    <button class="btn primary" type="submit">บันทึก</button>
  </form>`;
}

function tabCats(S) {
  return html`
    <form id="f-preset" class="card stack">
      <h2>เพิ่มชุดประเภทมาตรฐาน</h2>
      <div class="chips">${TYPES.map(([n], i) => html`<label class="chip"><input type="checkbox" name="type" value="${i}"> ${n}</label>`)}</div>
      <div class="chips">${['BG', 'N', 'S', 'P'].map((l) => html`<label class="chip"><input type="checkbox" name="lv" value="${l}"> ${l}</label>`)}</div>
      <div class="row2">
        <label class="field"><span>ค่าสมัครประเภทเดี่ยว (฿)</span><input name="feeS" type="number" min="0" value="600"></label>
        <label class="field"><span>ค่าสมัครประเภทคู่ (฿ ต่อทีม)</span><input name="feeD" type="number" min="0" value="800"></label>
      </div>
      <button class="btn" type="submit">เพิ่มประเภททั้งหมดที่เลือก</button>
    </form>
    <div class="card">
      <h2>ประเภททั้งหมด</h2>
      ${S.cats.length ? '' : html`<p class="muted">ยังไม่มีประเภท</p>`}
      ${S.cats.map((c) => html`<div class="catrow" data-cat-row>
        <input name="name" value="${c.name}" aria-label="ชื่อประเภท" maxlength="80">
        <select name="kind" aria-label="เดี่ยวหรือคู่"><option value="singles" ${c.kind === 'singles' ? raw('selected') : ''}>เดี่ยว</option><option value="doubles" ${c.kind === 'doubles' ? raw('selected') : ''}>คู่</option></select>
        <input name="level" value="${c.level || ''}" aria-label="ระดับ" placeholder="ระดับ" maxlength="20">
        <input name="max" type="number" min="2" value="${c.max_teams}" aria-label="จำนวนทีมสูงสุด">
        <input name="fee" type="number" min="0" value="${c.fee}" aria-label="ค่าสมัคร">
        <select name="format" aria-label="รูปแบบ"><option value="knockout" ${c.format === 'knockout' ? raw('selected') : ''}>แพ้คัดออก</option><option value="round_robin" ${c.format === 'round_robin' ? raw('selected') : ''}>พบกันหมด</option></select>
        <span class="actions"><button class="btn sm" type="button" data-act="save-cat" data-id="${c.id}">บันทึก</button><button class="btn sm danger" type="button" data-act="del-cat" data-id="${c.id}">ลบ</button></span>
      </div>`)}
      <form id="f-newcat" class="catrow add">
        <input name="name" placeholder="ชื่อประเภทใหม่" required maxlength="80">
        <select name="kind"><option value="singles">เดี่ยว</option><option value="doubles">คู่</option></select>
        <input name="level" placeholder="ระดับ" maxlength="20">
        <input name="max" type="number" min="2" value="32">
        <input name="fee" type="number" min="0" value="600">
        <select name="format"><option value="knockout">แพ้คัดออก</option><option value="round_robin">พบกันหมด</option></select>
        <span class="actions"><button class="btn sm primary" type="submit">เพิ่ม</button></span>
      </form>
      <p class="muted small">คอลัมน์: ชื่อ · เดี่ยว/คู่ · ระดับ · จำนวนทีมสูงสุด · ค่าสมัคร (฿) · รูปแบบ</p>
    </div>`;
}

function tabRegs(S, { catName }) {
  const list = S.regs.filter((r) => (!S.fCat || r.category_id === S.fCat) && (!S.fStatus || r.status === S.fStatus || r.pay_status === S.fStatus));
  const fee = (r) => S.cats.find((c) => c.id === r.category_id)?.fee || 0;
  const paid = S.regs.filter((r) => r.pay_status === 'paid').reduce((s, r) => s + fee(r), 0);
  const slips = S.regs.filter((r) => r.pay_status === 'slip_sent').length;
  return html`
    <div class="stats">
      <div class="stat"><b>${S.regs.filter((r) => r.status !== 'cancelled').length}</b><span>ทีมที่สมัคร</span></div>
      <div class="stat"><b>${S.regs.filter((r) => r.status === 'confirmed').length}</b><span>ยืนยันแล้ว</span></div>
      <div class="stat ${slips ? 'warn' : ''}"><b>${slips}</b><span>รอตรวจสลิป</span></div>
      <div class="stat"><b>${baht(paid)}</b><span>รับเงินแล้ว</span></div>
    </div>
    <div class="toolbar">
      <label class="field inline"><span>ประเภท</span><select id="f-cat"><option value="">ทั้งหมด</option>${S.cats.map((c) => html`<option value="${c.id}" ${S.fCat === c.id ? raw('selected') : ''}>${c.name}</option>`)}</select></label>
      <label class="field inline"><span>สถานะ</span><select id="f-status"><option value="">ทั้งหมด</option>
        ${Object.entries(REG_STATUS_TH).map(([k, l]) => html`<option value="${k}" ${S.fStatus === k ? raw('selected') : ''}>${l}</option>`)}
        ${Object.entries(PAY_TH).map(([k, l]) => html`<option value="${k}" ${S.fStatus === k ? raw('selected') : ''}>${l}</option>`)}</select></label>
      <button class="btn" type="button" data-act="csv">ดาวน์โหลด CSV</button>
    </div>
    <div class="card tablewrap"><table class="regs">
      <thead><tr><th>ทีม</th><th>เบอร์</th><th>ประเภท</th><th>วิดีโอ</th><th>ชำระเงิน</th><th>มือวาง</th><th></th></tr></thead>
      <tbody>${list.map((r) => html`<tr class="${r.status === 'cancelled' ? 'dim' : ''}">
        <td><b>${r.p1_name}</b>${r.p2_name ? html`<br><b>${r.p2_name}</b>` : ''}<br><span class="pill rs-${r.status}">${REG_STATUS_TH[r.status]}</span></td>
        <td>${r.p1_phone}${r.p2_phone ? html`<br>${r.p2_phone}` : ''}</td>
        <td><select data-change="move" data-id="${r.id}" aria-label="ย้ายประเภท">${S.cats.map((c) => html`<option value="${c.id}" ${c.id === r.category_id ? raw('selected') : ''}>${c.name}</option>`)}</select></td>
        <td>${r.video_url ? html`<a href="${r.video_url}" target="_blank" rel="noopener noreferrer">ดูวิดีโอ</a>` : html`<span class="muted">–</span>`}</td>
        <td><span class="pill pay-${r.pay_status}">${PAY_TH[r.pay_status]}</span><br><span class="muted small">${fee(r) ? baht(fee(r)) : 'ฟรี'}</span></td>
        <td><input class="seed" type="number" min="1" value="${r.seed ?? ''}" data-change="seed" data-id="${r.id}" aria-label="มือวาง"></td>
        <td class="actions">${regActions(r, fee(r))}</td>
      </tr>`)}</tbody></table>
      ${list.length ? '' : html`<p class="muted pad">ไม่มีรายการ</p>`}
    </div>`;
}

function regActions(r, fee) {
  const b = (act, label, cls = '') => html`<button class="btn sm ${cls}" type="button" data-act="${act}" data-id="${r.id}">${label}</button>`;
  if (r.status === 'cancelled') return '';
  if (r.status === 'waitlist') return html`${b('promote', 'ย้ายเข้ารายชื่อ', 'primary')}${b('cancel', 'ยกเลิก', 'danger')}`;
  return html`
    ${r.slip_path ? b('slip', 'ดูสลิป') : ''}
    ${r.pay_status === 'slip_sent' ? [b('approve', 'อนุมัติ', 'primary'), b('reject', 'ไม่ผ่าน', 'danger')] : ''}
    ${r.pay_status !== 'paid' && r.pay_status !== 'slip_sent' && fee > 0 ? b('approve', 'รับเงินสด', '') : ''}
    ${fee === 0 && r.status === 'pending' ? b('confirm', 'ยืนยัน', 'primary') : ''}
    ${b('cancel', 'ยกเลิก', 'danger')}`;
}

function exportCsv(S, catName) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['ประเภท', 'สถานะ', 'ชำระเงิน', 'ชื่อ 1', 'ชื่อเล่น 1', 'เบอร์ 1', 'ปีเกิด 1', 'ชื่อ 2', 'ชื่อเล่น 2', 'เบอร์ 2', 'ปีเกิด 2', 'วิดีโอ', 'มือวาง'];
  const rows = S.regs.map((r) => [catName(r.category_id), REG_STATUS_TH[r.status], PAY_TH[r.pay_status], r.p1_name, r.p1_nick, r.p1_phone, r.p1_birth_year, r.p2_name, r.p2_nick, r.p2_phone, r.p2_birth_year, r.video_url, r.seed]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${S.t.slug}-registrations.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function tabDraw(S, { catName, nameOf }) {
  const startDefault = toLocalInput(S.t.start_date ? S.t.start_date + 'T09:00' : new Date().toISOString());
  return html`
    <div class="card stack">
      <h2>จัดตารางคอร์ตอัตโนมัติ</h2>
      <p class="muted">จัดแมตช์ที่ยังไม่จบ ตามรอบ วนไปตามคอร์ต 1–${S.t.courts} ปรับคอร์ตรายแมตช์ภายหลังได้</p>
      <div class="row3">
        <label class="field"><span>เวลาเริ่ม</span><input id="sch-start" type="datetime-local" value="${startDefault}"></label>
        <label class="field"><span>นาทีต่อแมตช์</span><input id="sch-mins" type="number" min="10" max="120" value="30"></label>
        <div class="field"><span>&nbsp;</span><button class="btn primary" type="button" data-act="schedule">จัดตาราง</button></div>
      </div>
    </div>
    ${S.cats.map((c) => {
      const ms = S.matches.filter((m) => m.category_id === c.id);
      const confirmed = S.regs.filter((r) => r.category_id === c.id && r.status === 'confirmed').length;
      return html`<div class="card">
        <div class="titlebar"><h2>${c.name}</h2><span class="muted">ยืนยันแล้ว ${confirmed} ทีม · ${ms.length} แมตช์</span>
          <button class="btn sm ${ms.length ? '' : 'primary'}" type="button" data-act="gen" data-id="${c.id}">${ms.length ? 'สร้างสายใหม่' : 'สร้างสาย'}</button></div>
        ${ms.length ? html`<div class="tablewrap"><table>
          <thead><tr><th>รอบ</th><th>คู่แข่ง</th><th>เวลา</th><th>คอร์ต</th><th>ผล</th><th></th></tr></thead>
          <tbody>${ms.map((m) => html`<tr>
            <td>${m.round_label}</td>
            <td>${nameOf(m.reg_a)} <span class="muted">พบ</span> ${nameOf(m.reg_b)}</td>
            <td>${m.scheduled_at ? fmtTime(m.scheduled_at) : '–'}</td>
            <td><select data-change="court" data-id="${m.id}" aria-label="คอร์ต"><option value="">–</option>${Array.from({ length: S.t.courts }, (_, i) => html`<option value="${i + 1}" ${m.court === i + 1 ? raw('selected') : ''}>${i + 1}</option>`)}</select></td>
            <td>${m.status === 'finished' ? 'จบ ' + (m.sets || []).map((s) => s.join('-')).join(' ') : m.status === 'live' ? html`<span class="pill live">สด ${m.cur_a}-${m.cur_b}</span>` : 'รอแข่ง'}</td>
            <td>${m.reg_a && m.reg_b && m.status !== 'finished' ? html`<a class="btn sm primary" href="#/score/${m.id}">ให้คะแนน</a>` : ''}</td>
          </tr>`)}</tbody></table></div>` : html`<p class="muted">ยังไม่ได้สร้างสาย</p>`}
      </div>`;
    })}`;
}

function tabPosters(S) {
  return html`<div class="card stack">
      <h2>โปสเตอร์รายการ (${S.posters.length}/10)</h2>
      <p class="muted">รูปแรกใช้เป็นภาพหลักของรายการ ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด</p>
      <form id="f-poster" class="stack">
        <input name="files" type="file" accept="image/*" multiple aria-label="เลือกรูปโปสเตอร์">
        <button class="btn primary" type="submit">อัปโหลด</button>
      </form>
      <div class="posters">${S.posters.map((p) => html`<figure><img src="${publicUrl('posters', p.path)}" alt="โปสเตอร์" loading="lazy">
        <button class="btn sm danger" type="button" data-act="del-poster" data-id="${p.id}">ลบ</button></figure>`)}</div>
    </div>`;
}
