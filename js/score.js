import { sb, html, mount, $, toast, errMsg, teamName } from './lib.js';
import { currentUser } from './admin.js';

// Referee scoring screen. Signed-in organizers only; every tap calls the score_point RPC,
// which applies the BWF rules on the server so the score cannot drift between devices.
export async function scorePage(root, matchId) {
  const user = await currentUser();
  if (!user) {
    return mount(root, html`<section class="wrap narrow"><h1>หน้ากรรมการ</h1>
      <p>เข้าสู่ระบบผู้จัดก่อนจึงจะให้คะแนนได้</p><a class="btn primary" href="#/admin">เข้าสู่ระบบ</a></section>`);
  }
  const { data: m0, error } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
  if (error || !m0) return mount(root, html`<section class="wrap narrow"><p class="err">ไม่พบแมตช์</p></section>`);
  const [{ data: t }, { data: regs }, { data: cat }] = await Promise.all([
    sb.from('tournaments').select('id,name,rules').eq('id', m0.tournament_id).single(),
    sb.from('registrations').select('id,p1_name,p1_nick,p2_name,p2_nick').eq('tournament_id', m0.tournament_id),
    sb.from('categories').select('name').eq('id', m0.category_id).single(),
  ]);
  const nameOf = (id) => teamName((regs || []).find((r) => r.id === id));
  const rules = t.rules || {};
  let m = m0;
  let pending = false;

  const draw = () => {
    const finished = m.status === 'finished';
    const setNo = (m.sets || []).length + 1;
    const hi = Math.max(m.cur_a, m.cur_b);
    const bo = rules.best_of || 3;
    const pts = rules.points || 21;
    const hints = [];
    if (!finished && hi === 11 && setNo === bo) hints.push('ถึง 11 แต้มในเกมตัดสิน เปลี่ยนข้าง');
    if (!finished && m.cur_a === pts - 1 && m.cur_b === pts - 1) hints.push(`${pts - 1} เท่า ต้องนำ 2 แต้ม สูงสุด ${rules.cap || 30}`);
    const side = (k, reg, cur) => html`<div class="sidecard ${finished && m.winner === reg ? 'winner' : ''}">
      <div class="sidename">${nameOf(reg)}</div>
      <div class="sidescore" aria-live="polite">${cur}</div>
      <button class="btn plus" type="button" data-side="${k}" ${finished || pending ? html`disabled` : ''} aria-label="เพิ่มแต้ม ${nameOf(reg)}">+1</button>
    </div>`;
    mount(
      root,
      html`<section class="ref">
        <div class="refhead">
          <a class="back" href="#/admin/t/${m.tournament_id}">← ${t.name}</a>
          <span class="muted">${cat ? cat.name : ''} · ${m.round_label || ''}${m.court ? ' · คอร์ต ' + m.court : ''}</span>
          <span class="pill ${m.status === 'live' ? 'live' : 'st-closed'}">${m.status === 'live' ? 'กำลังแข่ง' : finished ? 'จบแมตช์' : 'รอเริ่ม'}</span>
        </div>
        <div class="setchips">${(m.sets || []).map((s, i) => html`<span class="chip static">เกม ${i + 1}  ${s[0]}–${s[1]}</span>`)}
          ${finished ? '' : html`<span class="chip static now">เกม ${setNo} กำลังเล่น</span>`}</div>
        ${side('a', m.reg_a, m.cur_a)}${side('b', m.reg_b, m.cur_b)}
        ${hints.map((h) => html`<div class="hint">${h}</div>`)}
        ${finished ? html`<div class="hint ok">ผู้ชนะ ${nameOf(m.winner)}</div>` : ''}
        <div class="refactions">
          <button class="btn big" type="button" id="undo" ${pending || (!m.sets.length && !m.cur_a && !m.cur_b) ? html`disabled` : ''}>ย้อนแต้มล่าสุด</button>
        </div>
      </section>`
    );
  };

  const call = async (fn, args) => {
    if (pending) return;
    pending = true;
    draw();
    const { data, error: e } = await sb.rpc(fn, args);
    pending = false;
    if (e) toast(errMsg(e), 'err');
    else m = data;
    draw();
  };

  draw();
  root.addEventListener('click', (ev) => {
    const plus = ev.target.closest('[data-side]');
    if (plus) return call('score_point', { p_match: matchId, p_side: plus.dataset.side });
    if (ev.target.closest('#undo')) return call('undo_point', { p_match: matchId });
  });

  // keep two referee devices in sync
  const ch = sb
    .channel(`score-${matchId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (p) => {
      m = p.new;
      draw();
    })
    .subscribe();
  return () => sb.removeChannel(ch);
}
