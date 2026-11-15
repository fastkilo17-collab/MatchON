import {
  sb, S, canManage, html, raw, mount, $, $$, toast, busy, esc, baht, fmtRange, STATUS_TH, KIND_TH, GENDER_TH, FORMAT_TH,
  loadTournaments, setTid, loadData, go,
} from './core.js';

const PRESETS = [
  ['ชายเดี่ยว มือ S', { kind: 'singles', gender: 'male', level: 'S' }],
  ['ชายเดี่ยว มือ P', { kind: 'singles', gender: 'male', level: 'P' }],
  ['ชายคู่ มือ P', { kind: 'doubles', gender: 'male', level: 'P' }],
  ['ชายคู่ มือ N', { kind: 'doubles', gender: 'male', level: 'N' }],
  ['หญิงเดี่ยว', { kind: 'singles', gender: 'female' }],
  ['หญิงคู่', { kind: 'doubles', gender: 'female' }],
  ['คู่ผสม', { kind: 'doubles', gender: 'mixed' }],
  ['รุ่นอายุ 40+', { kind: 'singles', gender: 'open', age_min: 40 }],
  ['รุ่นอายุ 50+', { kind: 'singles', gender: 'open', age_min: 50 }],
];
const localDT = (iso) => (iso ? new Date(new Date(iso) - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

// ---------------------------------------------------------------- list
export async function tournamentsPage(root) {
  const mgr = canManage();
  mount(root, html`
    ${mgr ? html`<div class="row between"><h2>รายการแข่งขัน</h2><a class="btn primary" href="#/tournaments/new">＋ สร้างรายการแข่งขัน</a></div>` : html`<h2>รายการแข่งขัน</h2>`}
    <div class="grid g2">
      ${S.tournaments.length ? S.tournaments.map((t) => html`<div class="card stack">
        <div class="row between"><h3>${t.name}</h3><span class="pill ${t.status === 'open' ? 'ok' : t.status === 'live' ? 'live' : 'gray'}">${STATUS_TH[t.status]}</span></div>
        <div class="muted small">${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''} · ${t.courts} สนาม</div>
        ${t.description ? html`<p class="small">${t.description}</p>` : ''}
        <div class="row">
          ${t.status === 'open' ? html`<a class="btn primary sm" href="#/register/${t.slug}">สมัครแข่งขัน</a>` : ''}
          <a class="btn sm" href="#/schedule" data-tid="${t.id}">ตารางแข่ง</a>
          <a class="btn sm" href="#/results" data-tid="${t.id}">ผลการแข่งขัน</a>
          ${mgr ? html`<a class="btn sm" href="#/tournaments/${t.id}">จัดการ</a>` : ''}
        </div></div>`)
        : html`<div class="card empty" style="grid-column:1/-1">ยังไม่มีรายการแข่งขันที่เปิดให้ดู</div>`}
    </div>`);
  $$('a[data-tid]', root).forEach((a) => a.addEventListener('click', () => setTid(a.dataset.tid)));
}

// ---------------------------------------------------------------- create / edit
export async function tournamentEdit(root, [id]) {
  if (!canManage()) return mount(root, html`<div class="card"><p class="err">เฉพาะผู้จัดการแข่งขันเท่านั้น</p></div>`);
  const isNew = id === 'new';
  const t = isNew ? { name: '', venue: '', description: '', courts: 4, status: 'draft', match_minutes: 30, rest_minutes: 15 } : S.tournaments.find((x) => x.id === id);
  if (!t) return mount(root, html`<div class="card"><p class="err">ไม่พบรายการนี้</p></div>`);
  if (!isNew) setTid(t.id);

  const draw = async () => {
    let cats = [], tpls = [], D = null;
    if (!isNew) {
      D = await loadData(t.id);
      cats = D.cats;
      const r = await sb.from('category_templates').select('*').order('name');
      tpls = r.data || [];
    }
    mount(root, html`
      <div class="row between"><h2>${isNew ? 'สร้างรายการแข่งขัน' : t.name}</h2><a class="btn sm" href="#/tournaments">← กลับ</a></div>
      <form id="tf" class="card stack" novalidate>
        <div class="grid g2">
          <label class="field"><span>ชื่อรายการ</span><input id="name" value="${t.name}" maxlength="120" placeholder="Badminton Open 2026" required></label>
          <label class="field"><span>สถานที่</span><input id="venue" value="${t.venue || ''}" placeholder="สนามแบดมินตัน"></label>
          <label class="field"><span>วันที่เริ่มแข่งขัน</span><input id="start" type="date" value="${t.start_date || ''}"></label>
          <label class="field"><span>วันสิ้นสุด</span><input id="end" type="date" value="${t.end_date || ''}"></label>
          <label class="field"><span>ปิดรับสมัคร (ไม่บังคับ)</span><input id="deadline" type="datetime-local" value="${localDT(t.reg_deadline)}"></label>
          <label class="field"><span>จำนวนสนาม</span><input id="courts" type="number" min="1" max="40" value="${t.courts}"></label>
          <label class="field"><span>เวลาต่อแมตช์ (นาที)</span><input id="mm" type="number" min="5" max="180" value="${t.match_minutes}"></label>
          <label class="field"><span>เวลาพักนักกีฬาก่อนแมตช์ถัดไป (นาที)</span><input id="rest" type="number" min="0" max="120" value="${t.rest_minutes}"></label>
          <label class="field"><span>PromptPay รับค่าสมัคร (เบอร์โทร 10 หลัก / เลขบัตร 13 หลัก)</span><input id="pp" inputmode="numeric" value="${t.promptpay_id || ''}"></label>
          <label class="field"><span>สถานะ</span><select id="status">${Object.entries(STATUS_TH).map(([k, l]) => raw(`<option value="${k}" ${t.status === k ? 'selected' : ''}>${l}</option>`))}</select></label>
        </div>
        <label class="field"><span>รายละเอียด / กติกา</span><textarea id="desc" rows="3" maxlength="2000">${t.description || ''}</textarea></label>
        <div class="row"><button class="btn primary" type="submit" id="save">${isNew ? 'สร้างรายการ' : 'บันทึก'}</button>
          ${!isNew ? html`<button class="btn" type="button" id="toggleReg">${t.status === 'open' ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}</button>
          <button class="btn danger" type="button" id="del">ลบรายการ</button>` : ''}</div>
      </form>
      ${isNew ? html`<p class="muted small">สร้างรายการก่อน แล้วจึงเพิ่มรุ่นการแข่งขัน (ชายเดี่ยว หญิงคู่ คู่ผสม รุ่นอายุ ฯลฯ) ได้ไม่จำกัด</p>` : catSection(cats, tpls, D)}
    `);
    bind();
  };

  const bind = () => {
    $('#tf', root).onsubmit = async (e) => {
      e.preventDefault();
      const v = (k) => $('#' + k, root).value.trim();
      if (v('name').length < 3) return toast('ชื่อรายการอย่างน้อย 3 ตัวอักษร', 'err');
      const pp = v('pp');
      if (pp && !/^(\d{10}|\d{13}|\d{15})$/.test(pp)) return toast('PromptPay ต้องเป็นเลข 10, 13 หรือ 15 หลัก', 'err');
      const row = {
        name: v('name'), venue: v('venue') || null, description: $('#desc', root).value.trim() || null,
        start_date: v('start') || null, end_date: v('end') || null,
        reg_deadline: v('deadline') ? new Date(v('deadline')).toISOString() : null,
        courts: Number(v('courts')) || 4, status: v('status'), promptpay_id: pp || null,
        match_minutes: Number(v('mm')) || 30, rest_minutes: Number(v('rest')) || 0,
      };
      if (row.start_date && row.end_date && row.end_date < row.start_date) return toast('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม', 'err');
      await busy($('#save', root), async () => {
        let tid = t.id;
        if (isNew) {
          const o = await sb.rpc('become_organizer', { p_name: S.name });
          if (o.error) throw o.error;
          const { data, error } = await sb.from('tournaments').insert({ ...row, organizer_id: S.user.id }).select().single();
          if (error) throw error;
          tid = data.id;
        } else {
          const { error } = await sb.from('tournaments').update(row).eq('id', t.id);
          if (error) throw error;
        }
        await syncCourts(tid, row.courts);
        await loadTournaments();
        setTid(tid);
        toast('บันทึกแล้ว');
        if (isNew) go('#/tournaments/' + tid); else draw();
      });
    };
    if (isNew) return;
    $('#toggleReg', root).onclick = () => busy($('#toggleReg', root), async () => {
      const { error } = await sb.from('tournaments').update({ status: t.status === 'open' ? 'closed' : 'open' }).eq('id', t.id);
      if (error) throw error;
      await loadTournaments(); go('#/tournaments'); setTimeout(() => go('#/tournaments/' + t.id), 0);
    });
    $('#del', root).onclick = () => busy($('#del', root), async () => {
      if (!window.confirm('ลบรายการนี้และข้อมูลทั้งหมดในรายการ? ย้อนกลับไม่ได้')) return;
      const { error } = await sb.from('tournaments').delete().eq('id', t.id);
      if (error) throw error;
      await loadTournaments(); go('#/tournaments');
    });
    bindCats();
  };

  const bindCats = () => {
    const f = $('#cf', root);
    const set = (o) => {
      const keys = { name: 'c-name', kind: 'c-kind', gender: 'c-gender', level: 'c-level', age_min: 'c-amin', age_max: 'c-amax', max_teams: 'c-max', fee: 'c-fee', format: 'c-format', best_of: 'c-best', points: 'c-pts', cap: 'c-cap' };
      const def = { kind: 'singles', gender: 'open', level: '', age_min: '', age_max: '', max_teams: 32, fee: 0, format: 'knockout', best_of: 3, points: 21, cap: 30 };
      for (const [k, id] of Object.entries(keys)) $('#' + id, root).value = o[k] ?? (k === 'name' ? '' : def[k]);
    };
    const read = () => {
      const n = (id) => ($('#' + id, root).value === '' ? null : Number($('#' + id, root).value));
      return {
        name: $('#c-name', root).value.trim(), kind: $('#c-kind', root).value, gender: $('#c-gender', root).value,
        level: $('#c-level', root).value.trim() || null, age_min: n('c-amin'), age_max: n('c-amax'),
        max_teams: n('c-max') || 32, fee: n('c-fee') || 0, format: $('#c-format', root).value,
        best_of: n('c-best') || 3, points: n('c-pts') || 21, cap: n('c-cap') || 30,
      };
    };
    let editing = null;
    $$('[data-preset]', root).forEach((b) => (b.onclick = () => { const [nm, o] = PRESETS[b.dataset.preset]; set({ name: nm, ...o }); }));
    const tsel = $('#tpl', root);
    if (tsel) tsel.onchange = () => {
      const tp = tsel.selectedOptions[0] && tsel.selectedOptions[0].dataset.json;
      if (tp) set(JSON.parse(tp));
    };
    $('#tpl-save', root).onclick = () => busy($('#tpl-save', root), async () => {
      const c = read();
      if (!c.name) throw new Error('ตั้งชื่อรุ่นก่อนบันทึกเป็นแม่แบบ');
      const { error } = await sb.from('category_templates').insert({ ...c, organizer_id: S.user.id });
      if (error) throw error;
      toast('บันทึกแม่แบบแล้ว ใช้ซ้ำได้ในรายการอื่น');
      draw();
    });
    const tdel = $('#tpl-del', root);
    if (tdel) tdel.onclick = () => busy(tdel, async () => {
      const opt = tsel.selectedOptions[0];
      if (!opt || !opt.value) throw new Error('เลือกแม่แบบก่อน');
      const { error } = await sb.from('category_templates').delete().eq('id', opt.value);
      if (error) throw error;
      draw();
    });
    $$('[data-edit]', root).forEach((b) => (b.onclick = async () => {
      const { data } = await sb.from('categories').select('*').eq('id', b.dataset.edit).single();
      editing = data; set(data); $('#c-save', root).textContent = 'บันทึกการแก้ไขรุ่น'; $('#cf', root).scrollIntoView({ behavior: 'smooth' });
    }));
    $$('[data-del]', root).forEach((b) => (b.onclick = () => busy(b, async () => {
      if (!window.confirm('ลบรุ่นนี้? ใบสมัครและแมตช์ของรุ่นนี้จะถูกลบด้วย')) return;
      const { error } = await sb.from('categories').delete().eq('id', b.dataset.del);
      if (error) throw error;
      draw();
    })));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const c = read();
      if (!c.name) return toast('ตั้งชื่อรุ่น', 'err');
      if (c.age_min != null && c.age_max != null && c.age_min > c.age_max) return toast('อายุต่ำสุดต้องไม่เกินอายุสูงสุด', 'err');
      await busy($('#c-save', root), async () => {
        const q = editing ? sb.from('categories').update(c).eq('id', editing.id) : sb.from('categories').insert({ ...c, tournament_id: t.id, sort: 0 });
        const { error } = await q;
        if (error) throw error;
        toast(editing ? 'แก้ไขรุ่นแล้ว' : 'เพิ่มรุ่นแล้ว');
        draw();
      });
    };
  };

  await draw();
}

function catSection(cats, tpls, D) {
  const count = (id) => D.regs.filter((r) => r.category_id === id && r.status !== 'cancelled').length;
  const opt = (k, l, cur) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${l}</option>`;
  return html`
    <div class="card"><h2>รุ่นการแข่งขัน (${cats.length})</h2>
      ${cats.length ? html`<div class="tw"><table class="t"><thead><tr><th>รุ่น</th><th>ประเภท</th><th>ระบบ</th><th>ค่าสมัคร</th><th>สมัคร/รับ</th><th></th></tr></thead><tbody>
        ${cats.map((c) => html`<tr><td data-l="รุ่น"><b>${c.name}</b>${c.level ? html` <span class="pill">มือ ${c.level}</span>` : ''}
          ${c.age_min != null || c.age_max != null ? html` <span class="pill gray">อายุ ${c.age_min ?? ''}–${c.age_max ?? ''}</span>` : ''}</td>
          <td data-l="ประเภท">${KIND_TH[c.kind]} · ${GENDER_TH[c.gender]}</td>
          <td data-l="ระบบ">${FORMAT_TH[c.format]} · ${c.best_of === 1 ? '1 เกม' : `1 ใน ${c.best_of}`} · ${c.points} แต้ม</td>
          <td data-l="ค่าสมัคร">${c.fee ? baht(c.fee) : 'ฟรี'}</td><td data-l="สมัคร/รับ">${count(c.id)}/${c.max_teams}</td>
          <td data-l=""><button class="btn sm" data-edit="${c.id}">แก้ไข</button> <button class="btn sm danger" data-del="${c.id}">ลบ</button></td></tr>`)}
      </tbody></table></div>` : html`<div class="empty">ยังไม่มีรุ่น เลือกจากตัวช่วยด้านล่างเพื่อเพิ่มเร็ว ๆ</div>`}
    </div>
    <form id="cf" class="card stack" novalidate>
      <h2>เพิ่ม / แก้ไขรุ่น</h2>
      <div class="row">${PRESETS.map(([l], i) => raw(`<button type="button" class="pill" data-preset="${i}" style="border:0;cursor:pointer">${esc(l)}</button>`))}</div>
      ${tpls ? html`<div class="row"><select id="tpl" style="max-width:320px"><option value="">— ใช้แม่แบบที่บันทึกไว้ —</option>
        ${tpls.map((x) => raw(`<option value="${x.id}" data-json="${esc(JSON.stringify(x))}">${esc(x.name)}</option>`))}</select>
        <button type="button" class="btn sm danger" id="tpl-del">ลบแม่แบบ</button></div>` : ''}
      <div class="grid g3">
        <label class="field"><span>ชื่อรุ่น</span><input id="c-name" maxlength="80"></label>
        <label class="field"><span>ประเภท</span><select id="c-kind"><option value="singles">เดี่ยว</option><option value="doubles">คู่</option></select></label>
        <label class="field"><span>เพศ</span><select id="c-gender"><option value="open">ทั่วไป</option><option value="male">ชาย</option><option value="female">หญิง</option><option value="mixed">ผสม</option></select></label>
        <label class="field"><span>ระดับมือ (S / P / N …)</span><input id="c-level" maxlength="20"></label>
        <label class="field"><span>อายุต่ำสุด (ปี)</span><input id="c-amin" type="number" min="5" max="100"></label>
        <label class="field"><span>อายุสูงสุด (ปี)</span><input id="c-amax" type="number" min="5" max="100"></label>
        <label class="field"><span>รับสูงสุด (ทีม)</span><input id="c-max" type="number" min="2" max="512" value="32"></label>
        <label class="field"><span>ค่าสมัคร (บาท)</span><input id="c-fee" type="number" min="0" value="0"></label>
        <label class="field"><span>ระบบการแข่งขัน</span><select id="c-format">${Object.entries(FORMAT_TH).map(([k, l]) => raw(`<option value="${k}">${l}</option>`))}</select></label>
        <label class="field"><span>จำนวนเกม</span><select id="c-best"><option value="1">1 เกม</option><option value="3" selected>1 ใน 3 เกม</option><option value="5">1 ใน 5 เกม</option></select></label>
        <label class="field"><span>คะแนนต่อเกม</span><input id="c-pts" type="number" min="11" max="30" value="21"></label>
        <label class="field"><span>เพดานคะแนน</span><input id="c-cap" type="number" min="11" max="40" value="30"></label>
      </div>
      <div class="row"><button class="btn primary" type="submit" id="c-save">เพิ่มรุ่น</button>
        <button class="btn" type="button" id="tpl-save">บันทึกเป็นแม่แบบ (ใช้ซ้ำทุกรายการ)</button></div>
    </form>`;
}

async function syncCourts(tid, n) {
  const { data } = await sb.from('courts').select('no').eq('tournament_id', tid);
  const have = new Set((data || []).map((c) => c.no));
  const add = [];
  for (let i = 1; i <= n; i++) if (!have.has(i)) add.push({ tournament_id: tid, no: i, name: 'สนาม ' + i });
  if (add.length) { const { error } = await sb.from('courts').insert(add); if (error) throw error; }
  if ((data || []).some((c) => c.no > n)) await sb.from('courts').delete().eq('tournament_id', tid).gt('no', n);
}
