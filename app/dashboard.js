import { sb, S, html, raw, mount, STATUS_TH, teamName, scoreText, fmtTime, fmtRange, people } from './core.js';

export async function dashboard(root) {
  const ids = S.tournaments.map((t) => t.id);
  let regs = [], matches = [];
  if (ids.length) {
    const [r, m] = await Promise.all([
      sb.from('registrations').select('id,tournament_id,status,pay_status,p1_name,p1_nick,p2_name,p2_nick').in('tournament_id', ids),
      sb.from('matches').select('*').in('tournament_id', ids),
    ]);
    if (r.error) throw r.error;
    if (m.error) throw m.error;
    regs = r.data || [];
    matches = m.data || [];
  }
  const E = Object.fromEntries(regs.map((r) => [r.id, r]));
  const active = regs.filter((r) => r.status !== 'cancelled');
  const athletes = active.reduce((n, r) => n + people(r), 0);
  const live = matches.filter((m) => m.status === 'live');
  const courtsUsed = new Set(live.map((m) => `${m.tournament_id}:${m.court}`)).size;
  const waiting = matches.filter((m) => m.status === 'scheduled' && m.reg_a && m.reg_b);
  const recent = matches.filter((m) => m.status === 'finished' && m.reg_a && m.reg_b).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 6);
  const slips = regs.filter((r) => r.pay_status === 'slip_sent');
  const pending = regs.filter((r) => r.status === 'pending');
  const wait = regs.filter((r) => r.status === 'waitlist');
  const unsched = waiting.filter((m) => !m.court || !m.scheduled_at);
  const tName = (id) => (S.tournaments.find((t) => t.id === id) || {}).name || '';
  const todo = [
    [slips.length, 'ตรวจสอบการชำระเงิน (สลิปรอตรวจ)', '#/athletes', 'warn'],
    [pending.length, 'อนุมัติใบสมัครที่รอยืนยัน', '#/athletes', 'warn'],
    [wait.length, 'ผู้สมัครรายชื่อสำรอง', '#/athletes', ''],
    [unsched.length, 'แมตช์ที่ยังไม่กำหนดสนามหรือเวลา', '#/schedule', 'warn'],
  ].filter(([n]) => n > 0);

  mount(root, html`
    <div class="shortcuts">
      <a class="btn primary" href="#/tournaments/new">＋ สร้างรายการแข่งขัน</a>
      <a class="btn" href="#/brackets">🧩 จัดสายการแข่งขัน</a>
      <a class="btn" href="#/schedule">🗓 จัดตารางการแข่งขัน</a>
      <a class="btn" href="#/courts">🏟 จัดการสนาม</a>
    </div>
    <div class="kpis">
      <div class="kpi"><small>รายการแข่งขันทั้งหมด</small><b>${S.tournaments.length}</b></div>
      <div class="kpi"><small>กำลังเปิดรับสมัคร</small><b>${S.tournaments.filter((t) => t.status === 'open').length}</b></div>
      <div class="kpi"><small>นักกีฬาที่สมัคร</small><b>${athletes}</b></div>
      <div class="kpi"><small>แมตช์กำลังแข่งขัน</small><b>${live.length}</b></div>
      <div class="kpi"><small>สนามที่ใช้งาน</small><b>${courtsUsed}</b></div>
      <div class="kpi"><small>แมตช์รอแข่งขัน</small><b>${waiting.length}</b></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>รายการที่ต้องดำเนินการ</h2>
        ${todo.length ? todo.map(([n, l, href, k]) => html`<a class="row between" href="${href}" style="padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink)">
          <span>${l}</span><span class="pill ${k}">${n}</span></a>`) : html`<div class="empty">ไม่มีรายการค้าง 🎉</div>`}
      </div>
      <div class="card"><h2>ผลการแข่งขันล่าสุด</h2>
        ${recent.length ? recent.map((m) => html`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
            <div class="row between"><b>${teamName(E[m.winner] || E[m.reg_a])}</b><span class="pill ok">${scoreText(m) || 'ชนะ'}</span></div>
            <div class="muted small">ชนะ ${teamName(E[m.winner === m.reg_a ? m.reg_b : m.reg_a])} · ${m.round_label || ''} · ${tName(m.tournament_id)}</div></div>`)
          : html`<div class="empty">ยังไม่มีผลการแข่งขัน</div>`}
      </div>
    </div>
    <div class="card"><h2>แมตช์ที่กำลังแข่งและรอแข่ง</h2>
      ${[...live, ...waiting.slice(0, 8)].length ? html`<div class="tw"><table class="t"><thead><tr><th>สนาม</th><th>เวลา</th><th>คู่แข่งขัน</th><th>สถานะ</th></tr></thead><tbody>
        ${[...live, ...waiting.slice(0, 8)].map((m) => html`<tr>
          <td data-l="สนาม">${m.court ? 'สนาม ' + m.court : '-'}</td><td data-l="เวลา">${fmtTime(m.scheduled_at) || '-'}</td>
          <td data-l="คู่แข่งขัน">${teamName(E[m.reg_a])} <span class="muted">vs</span> ${teamName(E[m.reg_b])}</td>
          <td data-l="สถานะ">${raw(m.status === 'live' ? '<span class="pill live">กำลังแข่ง</span>' : '<span class="pill gray">รอแข่ง</span>')}</td></tr>`)}
      </tbody></table></div>` : html`<div class="empty">ยังไม่มีแมตช์ ไปที่ "จัดสายแข่งขัน" เพื่อสร้างสาย</div>`}
    </div>
    <div class="card"><h2>รายการของฉัน</h2>
      ${S.tournaments.length ? S.tournaments.map((t) => html`<a class="row between" href="#/tournaments/${t.id}" style="padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink)">
        <span><b>${t.name}</b><br><span class="muted small">${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''}</span></span>
        <span class="pill ${t.status === 'open' ? 'ok' : t.status === 'live' ? 'live' : 'gray'}">${STATUS_TH[t.status]}</span></a>`)
        : html`<div class="empty">ยังไม่มีรายการแข่งขัน กด "＋ สร้างรายการแข่งขัน" เพื่อเริ่ม</div>`}
    </div>`);
}
