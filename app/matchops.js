// Match helpers shared by the bracket, schedule and results pages.
import { sb, html, raw, mount, $, $$, toast, busy, esc, name, MATCH_TH, notify } from './core.js';

// A set is valid when the winner reached `points` with a 2-point lead, or hit the cap.
export function setWinner(a, b, c) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  const pts = (c && c.points) || 21, deuce = !c || c.deuce !== false;
  const cap = deuce ? (c && c.cap) || 30 : pts;
  if (a === b || hi < pts) return null;
  if (hi >= cap) return a > b ? 'a' : 'b';
  return hi - lo >= 2 ? (a > b ? 'a' : 'b') : null;
}

// Rule set that applies to one match: the category's group-stage or knockout rule, else the category defaults.
export function ruleFor(D, m) {
  const cat = D.C[m.category_id] || {};
  const b = (D.brackets || []).find((x) => x.category_id === cat.id);
  const fmt = (b && b.format) || cat.format;
  const ko = m.stage === 'knockout' || (m.stage === 'main' && fmt === 'knockout');
  const r = (ko ? cat.rule_ko : cat.rule_group) && D.R && D.R[ko ? cat.rule_ko : cat.rule_group];
  if (r) return { best_of: r.best_of, points: r.points, deuce: r.deuce, cap: r.deuce ? r.cap : r.points, name: r.name };
  return { best_of: cat.best_of || 3, points: cat.points || 21, deuce: true, cap: cat.cap || 30, name: '' };
}
export const ruleText = (r) => `${r.best_of === 1 ? '1 เซต' : `ชนะ ${Math.floor(r.best_of / 2) + 1} ใน ${r.best_of} เซต`} · ${r.points} แต้ม · ${r.deuce ? `ดิวได้ สูงสุด ${r.cap}` : 'ไม่ดิว'}`;
export function matchWinner(sets, c) {
  const need = Math.floor(((c && c.best_of) || 3) / 2) + 1;
  let a = 0, b = 0;
  for (const [x, y] of sets) { const w = setWinner(x, y, c); if (w === 'a') a++; else if (w === 'b') b++; }
  return a >= need ? 'a' : b >= need ? 'b' : null;
}

async function setSlot(matchId, slot, regId) {
  const col = slot === 'a' ? 'reg_a' : 'reg_b';
  const { error } = await sb.from('matches').update({ [col]: regId }).eq('id', matchId);
  if (error) throw error;
}

// Save (or clear) a finished result and move the winner to the next round.
export async function saveResult(D, m, sets) {
  const c = ruleFor(D, m);
  const w = sets.length ? matchWinner(sets, c) : null;
  if (sets.length && !w) throw new Error('ผลยังไม่สมบูรณ์ ต้องมีผู้ชนะตามกติกา (เช่น 21 แต้มและห่าง 2)');
  for (const [x, y] of sets) if (!setWinner(x, y, c)) throw new Error(`เซต ${x}-${y} ไม่ถูกต้องตามกติกา (${ruleText(c)})`);
  const winner = w ? (w === 'a' ? m.reg_a : m.reg_b) : null;
  const { error } = await sb.from('matches').update({
    sets, status: w ? 'finished' : 'scheduled', winner, cur_a: 0, cur_b: 0, updated_at: new Date().toISOString(),
  }).eq('id', m.id);
  if (error) throw error;
  if (m.next_match) await setSlot(m.next_match, m.next_slot, winner);
  if (winner) {
    const loser = winner === m.reg_a ? m.reg_b : m.reg_a;
    const line = sets.map(([x, y]) => `${x}-${y}`).join(', ');
    await notify(D.tid, m.reg_a, 'result', 'ผลการแข่งขัน', `${name(D, winner)} ชนะ ${name(D, loser)} (${line})`).catch(() => {});
    await notify(D.tid, m.reg_b, 'result', 'ผลการแข่งขัน', `${name(D, winner)} ชนะ ${name(D, loser)} (${line})`).catch(() => {});
  }
}

// Dialog: change teams (before the bracket is locked) and enter the score of one match.
export function openMatchDialog(root, D, m, { locked = false, onDone } = {}) {
  let dlg = $('#mdlg', root);
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'mdlg'; root.appendChild(dlg); }
  const c = ruleFor(D, m);
  const sets = m.sets || [];
  const slots = Array.from({ length: c.best_of }, (_, i) => sets[i] || ['', '']);
  const teams = D.regs.filter((r) => r.category_id === m.category_id && r.status !== 'cancelled');
  const canSwap = !locked && m.stage !== 'swiss' && (m.round === 1 || m.stage === 'group') && m.status !== 'finished';
  const sel = (id, cur) => raw(`<select id="${id}"><option value="">— ว่าง/รอผล —</option>${teams.map((r) => `<option value="${r.id}" ${cur === r.id ? 'selected' : ''}>${esc(name(D, r.id))}</option>`).join('')}</select>`);
  mount(dlg, html`<div class="stack"><h3>${m.round_label || 'แมตช์'} ${m.match_no ? '· #' + m.match_no : ''}</h3>
    ${canSwap ? html`<div class="grid g2"><label class="field"><span>ทีม A</span>${sel('ta', m.reg_a)}</label><label class="field"><span>ทีม B</span>${sel('tb', m.reg_b)}</label></div>
      <button class="btn sm" id="swapt">บันทึกการเปลี่ยนทีม</button>`
      : html`<div class="row between"><b>${name(D, m.reg_a)}</b><span class="muted">vs</span><b>${name(D, m.reg_b)}</b></div>`}
    ${m.reg_a && m.reg_b ? html`<div class="stack"><b>ผลคะแนนรายเกม <span class="muted small">(${ruleText(c)})</span></b>
      ${slots.map((s, i) => html`<div class="row"><span style="width:56px">เกม ${i + 1}</span>
        <input data-s="${i}.0" type="number" min="0" max="${c.cap}" value="${s[0]}" style="width:90px"> <span>-</span>
        <input data-s="${i}.1" type="number" min="0" max="${c.cap}" value="${s[1]}" style="width:90px"></div>`)}
      <div class="row"><button class="btn primary" id="sv">บันทึกผล</button>
        ${m.status === 'finished' ? html`<button class="btn danger" id="clr">ล้างผล</button>` : ''}<button class="btn" id="cl">ปิด</button></div></div>`
      : html`<p class="muted">ต้องมีทีมครบทั้งสองฝั่งก่อนจึงกรอกผลได้</p><button class="btn" id="cl">ปิด</button>`}</div>`);
  dlg.showModal();
  $('#cl', dlg).onclick = () => dlg.close();
  const done = async () => { dlg.close(); if (onDone) await onDone(); };
  const sw = $('#swapt', dlg);
  if (sw) sw.onclick = () => busy(sw, async () => {
    const a = $('#ta', dlg).value || null, b = $('#tb', dlg).value || null;
    if (a && a === b) throw new Error('เลือกทีมซ้ำกัน');
    const { error } = await sb.from('matches').update({ reg_a: a, reg_b: b }).eq('id', m.id);
    if (error) throw error;
    toast('เปลี่ยนทีมแล้ว'); await done();
  });
  const sv = $('#sv', dlg);
  if (sv) sv.onclick = () => busy(sv, async () => {
    const out = [];
    for (let i = 0; i < c.best_of; i++) {
      const x = $(`[data-s="${i}.0"]`, dlg).value, y = $(`[data-s="${i}.1"]`, dlg).value;
      if (x === '' && y === '') continue;
      out.push([Number(x), Number(y)]);
    }
    if (!out.length) throw new Error('กรอกคะแนนอย่างน้อย 1 เกม');
    await saveResult(D, m, out);
    toast('บันทึกผลแล้ว'); await done();
  });
  const cr = $('#clr', dlg);
  if (cr) cr.onclick = () => busy(cr, async () => {
    if (!window.confirm('ล้างผลแมตช์นี้? ผู้ชนะที่เลื่อนเข้ารอบถัดไปจะถูกถอนออก')) return;
    await saveResult(D, m, []); toast('ล้างผลแล้ว'); await done();
  });
}

// Small bracket card used by several pages.
export const matchBox = (D, m) => {
  const w = m.winner;
  const row = (id, i) => `<div class="s ${w && w === id ? 'w' : ''}"><span>${esc(name(D, id))}</span><span>${(m.sets || []).map((s) => s[i]).join(' ')}</span></div>`;
  return `<div class="bm" data-m="${m.id}" style="cursor:pointer">${row(m.reg_a, 0)}${row(m.reg_b, 1)}
    <div class="meta">${m.match_no ? '#' + m.match_no + ' · ' : ''}${m.court ? 'สนาม ' + m.court : ''}${m.status === 'live' ? ' · กำลังแข่ง' : m.status === 'finished' ? '' : ''}</div></div>`;
};
