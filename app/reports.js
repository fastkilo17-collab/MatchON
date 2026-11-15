import {
  sb, S, curT, loadData, html, raw, mount, $, $$, esc, baht, name, fmtDate, tabs, scoreText, teamName, people,
  REG_STATUS_TH, PAY_TH, csv, downloadFile, KIND_TH,
} from './core.js';
import { podium } from './results.js';

export async function reportsPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  const D = await loadData(t.id);
  const pays = (await sb.from('payments').select('*').eq('tournament_id', t.id)).data || [];
  const st = { tab: 'overview', q: '', hist: null };
  const fee = (r) => (D.C[r.category_id] || {}).fee || 0;
  const active = D.regs.filter((r) => r.status !== 'cancelled');
  const paid = active.filter((r) => r.pay_status === 'paid');
  const owed = active.filter((r) => r.pay_status !== 'paid' && fee(r) > 0 && r.status !== 'waitlist');
  const revenue = pays.filter((p) => p.status === 'paid').reduce((n, p) => n + p.amount, 0) || paid.reduce((n, r) => n + fee(r), 0);
  const fin = D.matches.filter((m) => m.status === 'finished' && m.reg_a && m.reg_b);
  const real = D.matches.filter((m) => m.reg_a && m.reg_b);
  const left = real.filter((m) => m.status !== 'finished');

  const draw = () => {
    let body;
    if (st.tab === 'overview') {
      const max = Math.max(1, ...D.cats.map((c) => active.filter((r) => r.category_id === c.id).length));
      body = html`<div class="kpis">
        <div class="kpi"><small>ผู้สมัคร (ทีม)</small><b>${active.length}</b></div><div class="kpi"><small>นักกีฬา (คน)</small><b>${active.reduce((n, r) => n + people(r), 0)}</b></div>
        <div class="kpi"><small>รายรับค่าสมัคร</small><b>${baht(revenue)}</b></div><div class="kpi warn"><small>ค้างชำระ</small><b>${baht(owed.reduce((n, r) => n + fee(r), 0))}</b></div>
        <div class="kpi"><small>แมตช์แข่งแล้ว</small><b>${fin.length}</b></div><div class="kpi"><small>แมตช์ที่เหลือ</small><b>${left.length}</b></div></div>
        <div class="card stack"><h3>จำนวนผู้สมัครแต่ละรุ่น</h3>${D.cats.map((c) => {
          const n = active.filter((r) => r.category_id === c.id).length;
          return html`<div><div class="row between small"><span>${c.name}</span><b>${n}/${c.max_teams}</b></div><div class="bar"><i style="width:${Math.round((n / max) * 100)}%"></i></div></div>`;
        })}</div>
        <div class="card stack"><h3>ผู้ชนะและรองชนะเลิศ</h3>${D.cats.map((c) => { const p = podium(D, c);
          return html`<div class="row between" style="border-bottom:1px solid var(--line);padding:6px 0"><b>${c.name}</b><span>${p ? html`🥇 ${name(D, p.first)} · 🥈 ${name(D, p.second)}` : html`<span class="muted">ยังไม่จบ</span>`}</span></div>`; })}</div>`;
    } else if (st.tab === 'money') {
      body = html`<div class="kpis"><div class="kpi"><small>รายรับ</small><b>${baht(revenue)}</b></div><div class="kpi"><small>ชำระแล้ว (ทีม)</small><b>${paid.length}</b></div><div class="kpi warn"><small>ค้างชำระ (ทีม)</small><b>${owed.length}</b></div></div>
        <div class="card"><h3>แยกตามรุ่น</h3><div class="tw"><table class="t"><thead><tr><th>รุ่น</th><th>ค่าสมัคร</th><th>ชำระแล้ว</th><th>ค้าง</th><th>รายรับ</th></tr></thead><tbody>
        ${D.cats.map((c) => { const pr = paid.filter((r) => r.category_id === c.id).length, ow = owed.filter((r) => r.category_id === c.id).length;
          return html`<tr><td data-l="รุ่น">${c.name}</td><td data-l="ค่าสมัคร">${baht(c.fee)}</td><td data-l="ชำระแล้ว">${pr}</td><td data-l="ค้าง">${ow}</td><td data-l="รายรับ"><b>${baht(pr * c.fee)}</b></td></tr>`; })}</tbody></table></div></div>
        <div class="card"><h3>รายการค้างชำระ</h3>${owed.length ? html`<div class="tw"><table class="t"><thead><tr><th>ทีม</th><th>รุ่น</th><th>เบอร์</th><th>ยอด</th><th>สถานะ</th></tr></thead><tbody>
          ${owed.map((r) => html`<tr><td data-l="ทีม">${teamName(r)}</td><td data-l="รุ่น">${(D.C[r.category_id] || {}).name}</td><td data-l="เบอร์">${r.p1_phone || ''}</td><td data-l="ยอด">${baht(fee(r))}</td><td data-l="สถานะ">${PAY_TH[r.pay_status]}</td></tr>`)}</tbody></table></div>` : html`<div class="empty">ไม่มีรายการค้าง</div>`}</div>`;
    } else if (st.tab === 'results') {
      body = html`<div class="card"><h3>ผลการแข่งขันทุกคู่ (${fin.length})</h3>${fin.length ? html`<div class="tw"><table class="t"><thead><tr><th>#</th><th>รุ่น / รอบ</th><th>ผู้ชนะ</th><th>ผู้แพ้</th><th>คะแนน</th></tr></thead><tbody>
        ${fin.map((m) => html`<tr><td data-l="#">${m.match_no ?? ''}</td><td data-l="รุ่น">${(D.C[m.category_id] || {}).name} · ${m.round_label || ''}</td><td data-l="ผู้ชนะ"><b>${name(D, m.winner)}</b></td>
          <td data-l="ผู้แพ้">${name(D, m.winner === m.reg_a ? m.reg_b : m.reg_a)}</td><td data-l="คะแนน">${scoreText(m)}</td></tr>`)}</tbody></table></div>` : html`<div class="empty">ยังไม่มีผล</div>`}</div>`;
    } else {
      body = html`<div class="card stack"><h3>ประวัติการแข่งขันของนักกีฬา</h3>
        <label class="field"><span>ค้นหาชื่อหรือเบอร์โทร</span><input id="hq" value="${st.q}" placeholder="พิมพ์ชื่อ / เบอร์"></label><div id="hres"></div></div>`;
    }
    mount(root, html`
      <div class="row between noprint"><h2>รายงานและสถิติ · ${t.name}</h2>
        <div class="row"><button class="btn sm" id="xr">⬇ ผู้สมัคร (Excel)</button><button class="btn sm" id="xp">⬇ การเงิน (Excel)</button><button class="btn sm" id="xm">⬇ ผลแข่ง (Excel)</button><button class="btn sm" id="pdf">🖨 PDF</button></div></div>
      <div class="tabs noprint" id="tb">${raw(tabs([['overview', 'ภาพรวม'], ['money', 'การเงิน'], ['results', 'ผลการแข่งขัน'], ['hist', 'ประวัตินักกีฬา']], st.tab))}</div>${body}`);
    bind();
  };

  const bind = () => {
    $$('#tb [data-tab]', root).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; draw(); }));
    $('#pdf', root).onclick = () => window.print();
    $('#xr', root).onclick = () => downloadFile(`ผู้สมัคร-${t.slug}.csv`, csv([['รุ่น', 'ผู้เล่น 1', 'เบอร์ 1', 'ผู้เล่น 2', 'เบอร์ 2', 'สถานะ', 'ชำระ', 'ค่าสมัคร'],
      ...D.regs.map((r) => [(D.C[r.category_id] || {}).name, r.p1_name, r.p1_phone, r.p2_name, r.p2_phone, REG_STATUS_TH[r.status], PAY_TH[r.pay_status], fee(r)])]));
    $('#xp', root).onclick = () => downloadFile(`การเงิน-${t.slug}.csv`, csv([['ทีม', 'รุ่น', 'ค่าสมัคร', 'สถานะการชำระ'], ...active.map((r) => [teamName(r), (D.C[r.category_id] || {}).name, fee(r), PAY_TH[r.pay_status]])]));
    $('#xm', root).onclick = () => downloadFile(`ผลแข่ง-${t.slug}.csv`, csv([['#', 'รุ่น', 'รอบ', 'ผู้ชนะ', 'ผู้แพ้', 'คะแนน'], ...fin.map((m) => [m.match_no, (D.C[m.category_id] || {}).name, m.round_label, name(D, m.winner), name(D, m.winner === m.reg_a ? m.reg_b : m.reg_a), scoreText(m)])]));
    const hq = $('#hq', root);
    if (hq) {
      const run = () => {
        const q = hq.value.trim().toLowerCase();
        st.q = hq.value;
        const out = $('#hres', root);
        if (q.length < 2) { out.innerHTML = '<p class="muted small">พิมพ์อย่างน้อย 2 ตัวอักษร</p>'; return; }
        const rs = D.regs.filter((r) => [r.p1_name, r.p1_nick, r.p1_phone, r.p2_name, r.p2_nick, r.p2_phone].some((x) => (x || '').toLowerCase().includes(q)));
        out.innerHTML = rs.length ? rs.map((r) => {
          const ms = D.matches.filter((m) => (m.reg_a === r.id || m.reg_b === r.id) && m.status === 'finished');
          const w = ms.filter((m) => m.winner === r.id).length;
          return `<div class="card" style="margin-top:8px"><b>${esc(teamName(r))}</b> <span class="pill">${esc((D.C[r.category_id] || {}).name || '')}</span>
            <div class="muted small">${esc(r.p1_phone || '')} · แข่ง ${ms.length} · ชนะ ${w} · แพ้ ${ms.length - w}</div>
            ${ms.map((m) => `<div class="small">${esc(m.round_label || '')}: ${m.winner === r.id ? '✅ ชนะ' : '❌ แพ้'} ${esc(name(D, m.winner === r.id ? (m.winner === m.reg_a ? m.reg_b : m.reg_a) : m.winner))} (${esc(scoreText(m))})</div>`).join('')}</div>`;
        }).join('') : '<p class="muted">ไม่พบนักกีฬา</p>';
      };
      hq.oninput = run; run();
    }
  };
  draw();
}
