import { sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, name, fmtTime, canManage, notify } from './core.js';
import { openMatchDialog } from './matchops.js';

export async function courtsPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  let D = await loadData(t.id);
  let refs = (await sb.from('referees').select('*').eq('tournament_id', t.id)).data || [];

  const draw = () => {
    const live = D.matches.filter((m) => m.status === 'live');
    const playing = new Set(live.flatMap((m) => [m.reg_a, m.reg_b]));
    const queue = D.matches.filter((m) => m.status === 'scheduled' && m.reg_a && m.reg_b && !playing.has(m.reg_a) && !playing.has(m.reg_b))
      .sort((a, b) => (+new Date(a.scheduled_at || '2999-01-01')) - (+new Date(b.scheduled_at || '2999-01-01')) || a.round - b.round || (a.match_no || 0) - (b.match_no || 0));
    const cards = D.courts.map((c) => {
      const lm = live.find((m) => m.court === c.no);
      const wm = !lm && D.matches.filter((m) => m.court === c.no && m.status === 'scheduled' && m.reg_a && m.reg_b)
        .sort((a, b) => (+new Date(a.scheduled_at || 0)) - (+new Date(b.scheduled_at || 0)))[0];
      const kind = c.status === 'maintenance' ? 'off' : lm ? 'live' : wm ? 'wait' : 'free';
      const label = { off: 'งดใช้งาน', live: 'กำลังแข่ง', wait: 'รอแข่ง', free: 'ว่าง' }[kind];
      const m = lm || wm;
      const rf = refs.filter((r) => r.court_no === c.no).map((r) => r.name).join(', ');
      return html`<div class="court ${kind}"><h3>สนาม ${c.no} ${raw(`<span class="pill ${kind === 'live' ? 'live' : kind === 'free' ? 'ok' : kind === 'wait' ? 'warn' : 'gray'}">${label}</span>`)}</h3>
        ${m ? html`<div><b>${name(D, m.reg_a)}</b><br><span class="muted small">vs</span><br><b>${name(D, m.reg_b)}</b></div>
          <div class="muted small">${(D.C[m.category_id] || {}).name} · ${m.round_label || ''}${m.scheduled_at ? ' · ' + fmtTime(m.scheduled_at) : ''}</div>` : html`<div class="muted small">${kind === 'off' ? 'ปิดปรับปรุง' : 'พร้อมเรียกแมตช์ลงสนาม'}</div>`}
        ${rf ? html`<div class="small">กรรมการ: ${rf}</div>` : ''}
        ${canManage() ? html`<div class="row">
          ${kind === 'wait' ? html`<button class="btn sm primary" data-start="${m.id}">▶ เริ่มแข่ง</button>` : ''}
          ${kind === 'live' ? html`<button class="btn sm primary" data-res="${m.id}">กรอกผล</button><button class="btn sm" data-back="${m.id}">ส่งกลับ</button>` : ''}
          ${kind === 'free' || kind === 'wait' ? html`<button class="btn sm" data-call="${c.no}">📣 เรียกแมตช์</button>` : ''}
          <button class="btn sm" data-toggle="${c.id}">${c.status === 'maintenance' ? 'เปิดสนาม' : 'งดใช้'}</button></div>` : ''}</div>`;
    });
    mount(root, html`
      <div class="row between"><h2>จัดการสนาม</h2><div class="row"><a class="btn sm" href="courts.html">🔴 คอร์ตสด / QR กรรมการ</a>
        ${canManage() ? html`<button class="btn sm" id="addc">＋ เพิ่มสนาม</button>` : ''}</div></div>
      <div class="kpis"><div class="kpi"><small>สนามทั้งหมด</small><b>${D.courts.length}</b></div><div class="kpi"><small>กำลังแข่ง</small><b>${live.length}</b></div>
        <div class="kpi"><small>ว่าง</small><b>${D.courts.filter((c) => c.status === 'available' && !live.some((m) => m.court === c.no)).length}</b></div>
        <div class="kpi"><small>แมตช์รอเรียก</small><b>${queue.length}</b></div></div>
      ${D.courts.length ? html`<div class="courts">${cards}</div>` : html`<div class="card empty">ยังไม่มีสนาม กดเพิ่มสนาม หรือตั้งจำนวนสนามในหน้ารายการแข่งขัน</div>`}
      <dialog id="cd"></dialog>`);
    bind(queue);
  };

  const reload = async () => { D = await loadData(t.id); draw(); };
  const upd = async (id, patch) => { const { error } = await sb.from('matches').update(patch).eq('id', id); if (error) throw error; };

  const bind = (queue) => {
    if (!canManage()) return;
    $$('[data-start]', root).forEach((b) => (b.onclick = () => busy(b, async () => { await upd(b.dataset.start, { status: 'live' }); await reload(); })));
    $$('[data-back]', root).forEach((b) => (b.onclick = () => busy(b, async () => { await upd(b.dataset.back, { status: 'scheduled' }); await reload(); })));
    $$('[data-res]', root).forEach((b) => (b.onclick = () => openMatchDialog(root, D, D.matches.find((m) => m.id === b.dataset.res), { locked: true, onDone: reload })));
    $$('[data-toggle]', root).forEach((b) => (b.onclick = () => busy(b, async () => {
      const c = D.courts.find((x) => x.id === b.dataset.toggle);
      const { error } = await sb.from('courts').update({ status: c.status === 'maintenance' ? 'available' : 'maintenance' }).eq('id', c.id);
      if (error) throw error; await reload();
    })));
    const ad = $('#addc', root);
    if (ad) ad.onclick = () => busy(ad, async () => {
      const no = Math.max(0, ...D.courts.map((c) => c.no)) + 1;
      if (no > 40) throw new Error('สูงสุด 40 สนาม');
      const { error } = await sb.from('courts').insert({ tournament_id: t.id, no, name: 'สนาม ' + no });
      if (error) throw error; await reload();
    });
    $$('[data-call]', root).forEach((b) => (b.onclick = () => {
      const no = Number(b.dataset.call), dlg = $('#cd', root);
      mount(dlg, html`<div class="stack"><h3>เรียกแมตช์ลงสนาม ${no}</h3>
        ${queue.length ? queue.slice(0, 12).map((m) => html`<button class="btn" data-pick="${m.id}" style="justify-content:space-between;text-align:left"><span>${name(D, m.reg_a)} vs ${name(D, m.reg_b)}<br><small class="muted">${(D.C[m.category_id] || {}).name} · ${m.round_label}</small></span><span>${m.court ? 'สนาม ' + m.court : ''}</span></button>`)
          : html`<div class="empty">ไม่มีแมตช์ที่พร้อม (ทีมครบและไม่ติดแข่งอยู่)</div>`}
        <button class="btn" id="cx">ปิด</button></div>`);
      dlg.showModal();
      $('#cx', dlg).onclick = () => dlg.close();
      $$('[data-pick]', dlg).forEach((p) => (p.onclick = () => busy(p, async () => {
        const m = D.matches.find((x) => x.id === p.dataset.pick);
        const now = new Date().toISOString();
        await upd(m.id, { court: no, scheduled_at: now });
        for (const id of [m.reg_a, m.reg_b]) await notify(t.id, id, 'schedule', 'เรียกลงสนาม', `${m.round_label || 'แมตช์'} กรุณามาที่สนาม ${no}`).catch(() => {});
        dlg.close(); toast(`เรียกลงสนาม ${no} แล้ว`); await reload();
      })));
    }));
  };
  draw();
}
