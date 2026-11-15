import {
  sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, name, fmtDate, fmtTime, tabs, canManage, MATCH_TH, scoreText, notify,
} from './core.js';

const localDT = (iso) => (iso ? new Date(new Date(iso) - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const MIN = 60000;

// Scheduling problems among matches that already have a court and a time.
export function conflicts(D, t, ms = D.matches) {
  const dur = (t.match_minutes || 30) * MIN, rest = (t.rest_minutes || 0) * MIN;
  const sch = ms.filter((m) => m.court && m.scheduled_at && m.status !== 'finished')
    .map((m) => ({ m, s: +new Date(m.scheduled_at) })).sort((a, b) => a.s - b.s);
  const out = [];
  for (let i = 0; i < sch.length; i++) {
    for (let j = i + 1; j < sch.length; j++) {
      const A = sch[i], B = sch[j];
      if (B.s - A.s >= dur + rest) break;
      const label = `#${A.m.match_no ?? '?'} และ #${B.m.match_no ?? '?'}`;
      if (A.m.court === B.m.court && B.s < A.s + dur) out.push(`${label}: สนาม ${A.m.court} เวลาชนกัน`);
      const ta = [A.m.reg_a, A.m.reg_b].filter(Boolean), tb = [B.m.reg_a, B.m.reg_b].filter(Boolean);
      for (const id of ta) {
        if (!tb.includes(id)) continue;
        out.push(B.s < A.s + dur ? `${label}: ${name(D, id)} แข่งสองสนามพร้อมกัน` : `${label}: ${name(D, id)} พักไม่ถึง ${t.rest_minutes} นาที`);
      }
    }
  }
  return out;
}

// Greedy planner: honours free courts, athlete rest time and "winner of the previous round" dependencies.
export function planSchedule(D, t, { start, courts }) {
  const dur = (t.match_minutes || 30) * MIN, rest = (t.rest_minutes || 0) * MIN;
  const courtFree = Object.fromEntries(courts.map((c) => [c, +start]));
  const teamFree = {}, ends = {};
  const done = D.matches.filter((m) => m.court && m.scheduled_at && m.status !== 'finished');
  for (const m of done) {
    const e = +new Date(m.scheduled_at) + dur;
    if (courtFree[m.court] != null) courtFree[m.court] = Math.max(courtFree[m.court], e);
    for (const id of [m.reg_a, m.reg_b]) if (id) teamFree[id] = Math.max(teamFree[id] || 0, e + rest);
    ends[m.id] = e;
  }
  const feeders = {};
  D.matches.forEach((m) => { if (m.next_match) (feeders[m.next_match] = feeders[m.next_match] || []).push(m.id); });
  const todo = D.matches.filter((m) => m.status === 'scheduled' && (!m.court || !m.scheduled_at) && (m.reg_a || m.reg_b || feeders[m.id]))
    .sort((a, b) => (a.round - b.round) || ((a.match_no || 0) - (b.match_no || 0)) || (a.slot - b.slot));
  const plan = [];
  for (const m of todo) {
    let ready = +start;
    for (const id of [m.reg_a, m.reg_b]) if (id) ready = Math.max(ready, teamFree[id] || 0);
    for (const f of feeders[m.id] || []) if (ends[f] != null) ready = Math.max(ready, ends[f] + rest);
    let best = null;
    for (const c of courts) { const s = Math.max(courtFree[c], ready); if (!best || s < best.s) best = { c, s }; }
    if (!best) continue;
    courtFree[best.c] = best.s + dur;
    ends[m.id] = best.s + dur;
    for (const id of [m.reg_a, m.reg_b]) if (id) teamFree[id] = best.s + dur + rest;
    plan.push({ id: m.id, court: best.c, scheduled_at: new Date(best.s).toISOString() });
  }
  return plan;
}

export async function schedulePage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  let D = await loadData(t.id);
  const mgr = canManage();
  const st = { tab: 'court' };
  const matches = () => D.matches.filter((m) => m.reg_a || m.reg_b);

  const row = (m) => html`<div class="bm" data-m="${m.id}" style="cursor:${mgr ? 'pointer' : 'default'}"><div class="s"><span>${name(D, m.reg_a)}</span><span></span></div><div class="s"><span>${name(D, m.reg_b)}</span><span>${m.status === 'finished' ? scoreText(m) : ''}</span></div>
    <div class="meta">${m.match_no ? '#' + m.match_no + ' · ' : ''}${(D.C[m.category_id] || {}).name || ''} · ${m.round_label || ''} · ${MATCH_TH[m.status]}${m.scheduled_at ? ' · ' + fmtTime(m.scheduled_at) : ''}</div></div>`;

  const draw = () => {
    const ms = matches().slice().sort((a, b) => (+new Date(a.scheduled_at || '2999-01-01')) - (+new Date(b.scheduled_at || '2999-01-01')) || (a.match_no || 0) - (b.match_no || 0));
    const warn = conflicts(D, t);
    const unsched = ms.filter((m) => m.status === 'scheduled' && (!m.court || !m.scheduled_at));
    const courtNos = D.courts.length ? D.courts.map((c) => c.no) : Array.from({ length: t.courts }, (_, i) => i + 1);
    let body;
    if (st.tab === 'court') {
      body = html`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${courtNos.map((n) => {
        const list = ms.filter((m) => m.court === n);
        return html`<div class="card stack"><h3>สนาม ${n} <span class="pill gray">${list.length} แมตช์</span></h3>${list.length ? list.map(row) : html`<div class="muted small">ว่าง</div>`}</div>`;
      })}</div>${unsched.length ? html`<div class="card stack"><h3>ยังไม่กำหนดสนาม/เวลา (${unsched.length})</h3><div class="grid g3">${unsched.map(row)}</div></div>` : ''}`;
    } else if (st.tab === 'time') {
      const days = [...new Set(ms.filter((m) => m.scheduled_at).map((m) => m.scheduled_at.slice(0, 10)))];
      body = html`<div class="card"><div class="tw"><table class="t"><thead><tr><th>เวลา</th><th>สนาม</th><th>คู่แข่งขัน</th><th>รุ่น / รอบ</th><th>สถานะ</th></tr></thead><tbody>
        ${ms.map((m) => html`<tr data-m="${m.id}" style="cursor:${mgr ? 'pointer' : 'default'}"><td data-l="เวลา">${m.scheduled_at ? fmtDate(m.scheduled_at) + ' ' + fmtTime(m.scheduled_at) : '-'}</td><td data-l="สนาม">${m.court ?? '-'}</td>
          <td data-l="คู่"><b>${name(D, m.reg_a)}</b> vs <b>${name(D, m.reg_b)}</b></td><td data-l="รุ่น">${(D.C[m.category_id] || {}).name} · ${m.round_label || ''}</td>
          <td data-l="สถานะ">${raw(`<span class="pill ${m.status === 'live' ? 'live' : m.status === 'finished' ? 'ok' : 'gray'}">${MATCH_TH[m.status]}</span>`)}</td></tr>`)}</tbody></table></div>
        ${days.length ? '' : html`<div class="empty">ยังไม่มีตารางเวลา${mgr ? ' กด "จัดตารางอัตโนมัติ"' : ''}</div>`}</div>`;
    } else {
      body = html`<div class="grid g2">${D.cats.map((c) => {
        const cm = D.matches.filter((m) => m.category_id === c.id);
        const fin = cm.filter((m) => m.status === 'finished').length;
        const doneRounds = cm.filter((m) => m.status === 'finished').map((m) => m.round_label);
        const live = cm.filter((m) => m.status === 'live').length;
        const next = cm.filter((m) => m.status === 'scheduled' && m.reg_a && m.reg_b).sort((a, b) => a.round - b.round)[0];
        return html`<div class="card stack"><h3>${c.name}</h3>
          ${cm.length ? html`<div class="bar"><i style="width:${Math.round((fin / cm.length) * 100)}%"></i></div>
            <div class="row between small"><span>แข่งแล้ว ${fin}/${cm.length}</span><span>${live ? 'กำลังแข่ง ' + live + ' แมตช์' : ''}</span></div>
            <div class="small">รอบล่าสุดที่มีผล: <b>${doneRounds.length ? doneRounds[doneRounds.length - 1] : '-'}</b></div>
            <div class="small muted">รอบถัดไป: ${next ? next.round_label : 'ยังไม่มี'}</div>` : html`<div class="muted small">ยังไม่ได้จัดสาย</div>`}</div>`;
      })}</div>`;
    }
    mount(root, html`
      <div class="row between"><h2>ตารางการแข่งขัน</h2>
        ${mgr ? html`<button class="btn primary" id="auto">⚡ จัดตารางอัตโนมัติ</button>` : ''}</div>
      <div class="tabs" id="tb">${raw(tabs([['court', 'ตามสนาม'], ['time', 'ตามเวลา'], ['cat', 'ตามรุ่น']], st.tab))}</div>
      ${warn.length ? html`<div class="card" style="border-color:var(--warn)"><h3 class="err">⚠ ตารางชนกัน (${warn.length})</h3>${warn.slice(0, 8).map((w) => html`<div class="small">${w}</div>`)}</div>` : ''}
      ${body}<dialog id="sd"></dialog>`);
    bind();
  };

  const reload = async () => { D = await loadData(t.id); draw(); };

  const bind = () => {
    $$('#tb [data-tab]', root).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; draw(); }));
    if (!mgr) return;
    $$('[data-m]', root).forEach((el) => (el.onclick = () => editMatch(D.matches.find((m) => m.id === el.dataset.m))));
    const au = $('#auto', root);
    if (au) au.onclick = () => autoDialog();
  };

  const editMatch = (m) => {
    const dlg = $('#sd', root);
    const courtNos = D.courts.length ? D.courts.filter((c) => c.status === 'available').map((c) => c.no) : Array.from({ length: t.courts }, (_, i) => i + 1);
    mount(dlg, html`<div class="stack"><h3>${name(D, m.reg_a)} vs ${name(D, m.reg_b)}</h3><div class="muted small">${(D.C[m.category_id] || {}).name} · ${m.round_label}</div>
      <label class="field"><span>สนาม</span><select id="ec"><option value="">— ยังไม่กำหนด —</option>${courtNos.map((n) => raw(`<option value="${n}" ${m.court === n ? 'selected' : ''}>สนาม ${n}</option>`))}</select></label>
      <label class="field"><span>เวลา</span><input id="et" type="datetime-local" value="${localDT(m.scheduled_at)}"></label>
      <div class="row"><button class="btn primary" id="es">บันทึก</button><button class="btn" id="ex">ปิด</button></div></div>`);
    dlg.showModal();
    $('#ex', dlg).onclick = () => dlg.close();
    $('#es', dlg).onclick = () => busy($('#es', dlg), async () => {
      const court = Number($('#ec', dlg).value) || null;
      const at = $('#et', dlg).value ? new Date($('#et', dlg).value).toISOString() : null;
      const test = D.matches.map((x) => (x.id === m.id ? { ...x, court, scheduled_at: at } : x));
      const bad = conflicts(D, t, test).filter((w) => w.includes('#' + (m.match_no ?? '?')));
      if (bad.length && !window.confirm('ตารางชนกัน:\n' + bad.join('\n') + '\n\nบันทึกต่อหรือไม่?')) return;
      const { error } = await sb.from('matches').update({ court, scheduled_at: at }).eq('id', m.id);
      if (error) throw error;
      if (court && at) for (const id of [m.reg_a, m.reg_b].filter(Boolean)) await notify(t.id, id, 'schedule', 'อัปเดตตารางแข่ง', `${m.round_label || 'แมตช์'} สนาม ${court} เวลา ${fmtDate(at)} ${fmtTime(at)}`).catch(() => {});
      dlg.close(); toast('บันทึกตารางแล้ว'); await reload();
    });
  };

  const autoDialog = () => {
    const dlg = $('#sd', root);
    const courtNos = D.courts.length ? D.courts.filter((c) => c.status === 'available').map((c) => c.no) : Array.from({ length: t.courts }, (_, i) => i + 1);
    const def = localDT(new Date(new Date(t.start_date || Date.now()).setHours(9, 0, 0, 0)).toISOString());
    mount(dlg, html`<div class="stack"><h3>จัดตารางอัตโนมัติ</h3>
      <p class="muted small">จัดเฉพาะแมตช์ที่ยังไม่มีสนาม/เวลา โดยเว้นเวลาพัก ${t.rest_minutes} นาที ไม่ให้นักกีฬาแข่งซ้อน และให้รอบถัดไปเริ่มหลังรอบก่อนจบ (แมตช์ละ ${t.match_minutes} นาที)</p>
      <label class="field"><span>เวลาเริ่มแข่ง</span><input id="as" type="datetime-local" value="${def}"></label>
      <div class="field"><span>สนามที่ใช้</span><div class="row">${courtNos.map((n) => raw(`<label class="check"><input type="checkbox" class="cc" value="${n}" checked>${n}</label>`))}</div></div>
      <div class="row"><button class="btn primary" id="ar">จัดตารางและแจ้งนักกีฬา</button><button class="btn" id="ax">ปิด</button></div></div>`);
    dlg.showModal();
    $('#ax', dlg).onclick = () => dlg.close();
    $('#ar', dlg).onclick = () => busy($('#ar', dlg), async () => {
      const courts = $$('.cc:checked', dlg).map((x) => Number(x.value));
      const start = new Date($('#as', dlg).value);
      if (!courts.length || isNaN(start)) throw new Error('เลือกเวลาเริ่มและสนามอย่างน้อย 1 สนาม');
      const plan = planSchedule(D, t, { start, courts });
      if (!plan.length) throw new Error('ไม่มีแมตช์ที่ต้องจัดตาราง (สร้างสายก่อน หรือจัดครบแล้ว)');
      for (const p of plan) {
        const { error } = await sb.from('matches').update({ court: p.court, scheduled_at: p.scheduled_at }).eq('id', p.id);
        if (error) throw error;
      }
      const notes = [];
      for (const p of plan) {
        const m = D.matches.find((x) => x.id === p.id);
        for (const id of [m.reg_a, m.reg_b].filter(Boolean)) notes.push({ tournament_id: t.id, registration_id: id, kind: 'schedule', title: 'ตารางแข่งของคุณ', body: `${m.round_label || 'แมตช์'} สนาม ${p.court} เวลา ${fmtDate(p.scheduled_at)} ${fmtTime(p.scheduled_at)}` });
      }
      if (notes.length) await sb.from('notifications').insert(notes);
      dlg.close(); toast(`จัดตารางแล้ว ${plan.length} แมตช์`); await reload();
    });
  };

  draw();
}
