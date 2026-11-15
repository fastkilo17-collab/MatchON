import { sb, esc, curT, loadData, html, raw, mount, $, $$, name, fmtDate, fmtTime, tabs, canManage, scoreText, MATCH_TH, standings, KIND_TH, GENDER_TH } from './core.js';
import { openMatchDialog } from './matchops.js';

// champion / runner-up of one category, or null if it is not decided yet
export function podium(D, cat) {
  const ms = D.matches.filter((m) => m.category_id === cat.id);
  if (!ms.length) return null;
  const b = D.brackets.find((x) => x.category_id === cat.id);
  const fmt = (b && b.format) || cat.format;
  const koms = ms.filter((m) => m.stage === 'knockout' || (m.stage === 'main' && fmt === 'knockout'));
  if (koms.length) {
    const top = Math.max(...koms.map((m) => m.round));
    const fin = koms.find((m) => m.round === top && m.status === 'finished');
    if (!fin) return null;
    return { first: fin.winner, second: fin.winner === fin.reg_a ? fin.reg_b : fin.reg_a };
  }
  if (ms.some((m) => m.status !== 'finished') || fmt === 'group_stage' || fmt === 'group_knockout') return null;
  const ids = [...new Set(ms.flatMap((m) => [m.reg_a, m.reg_b]))];
  const s = standings(ids, ms);
  return { first: s[0] && s[0].id, second: s[1] && s[1].id };
}

export async function resultsPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  let D = await loadData(t.id);
  const st = { tab: 'results', cat: '' };
  const mgr = canManage();

  const draw = () => {
    const fin = D.matches.filter((m) => m.status === 'finished' && m.reg_a && m.reg_b && (!st.cat || m.category_id === st.cat))
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    const live = D.matches.filter((m) => m.status === 'live');
    let body;
    if (st.tab === 'results') {
      body = html`<div class="card"><div class="row"><label class="field" style="max-width:300px"><span>รุ่น</span><select id="fc"><option value="">ทุกรุ่น</option>${D.cats.map((c) => raw(`<option value="${c.id}" ${st.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`))}</select></label></div>
        ${fin.length ? html`<div class="tw"><table class="t"><thead><tr><th>รุ่น / รอบ</th><th>ผู้ชนะ</th><th>ผู้แพ้</th><th>คะแนน</th></tr></thead><tbody>
          ${fin.map((m) => html`<tr data-m="${m.id}" style="cursor:${mgr ? 'pointer' : 'default'}"><td data-l="รุ่น">${(D.C[m.category_id] || {}).name}<br><span class="muted small">${m.round_label || ''}</span></td>
            <td data-l="ผู้ชนะ"><b class="ok">${name(D, m.winner)}</b></td><td data-l="ผู้แพ้">${name(D, m.winner === m.reg_a ? m.reg_b : m.reg_a)}</td><td data-l="คะแนน">${scoreText(m)}</td></tr>`)}</tbody></table></div>`
          : html`<div class="empty">ยังไม่มีผลการแข่งขัน</div>`}</div>`;
    } else if (st.tab === 'live') {
      body = live.length ? html`<div class="grid g2">${live.map((m) => html`<div class="card stack"><div class="row between"><span class="pill live">กำลังแข่ง</span><span class="muted small">${m.court ? 'สนาม ' + m.court : ''}</span></div>
        <div class="row between"><b>${name(D, m.reg_a)}</b><b style="font:800 1.8rem 'Prompt'">${m.cur_a}</b></div>
        <div class="row between"><b>${name(D, m.reg_b)}</b><b style="font:800 1.8rem 'Prompt'">${m.cur_b}</b></div>
        <div class="muted small">${(D.C[m.category_id] || {}).name} · ${m.round_label || ''}${(m.sets || []).length ? ' · เกมที่จบ ' + scoreText({ ...m, status: 'x' }) : ''}</div></div>`)}</div>
        <p class="muted small">คะแนนสดรายสนามแบบเรียลไทม์ดูได้ที่หน้า <a href="courts.html">Live Score</a></p>`
        : html`<div class="card empty">ตอนนี้ไม่มีแมตช์ที่กำลังแข่ง</div>`;
    } else {
      body = html`<div class="grid g2">${D.cats.map((c) => {
        const p = podium(D, c);
        return html`<div class="card stack"><h3>${c.name}</h3><div class="muted small">${KIND_TH[c.kind]} · ${GENDER_TH[c.gender]}</div>
          ${p ? html`<div class="row"><span style="font-size:1.6rem">🥇</span><b>${name(D, p.first)}</b></div><div class="row"><span style="font-size:1.6rem">🥈</span><span>${name(D, p.second)}</span></div>`
            : html`<div class="muted">ยังแข่งไม่จบ</div>`}</div>`;
      })}</div>`;
    }
    mount(root, html`<h2>ผลการแข่งขัน</h2><div class="tabs" id="tb">${raw(tabs([['results', 'ผลทุกคู่'], ['live', `กำลังแข่ง (${live.length})`], ['podium', 'แชมป์แต่ละรุ่น']], st.tab))}</div>${body}<dialog id="mdlg"></dialog>`);
    $$('#tb [data-tab]', root).forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; draw(); }));
    const fc = $('#fc', root); if (fc) fc.onchange = () => { st.cat = fc.value; draw(); };
    if (mgr) $$('[data-m]', root).forEach((el) => (el.onclick = () => openMatchDialog(root, D, D.matches.find((m) => m.id === el.dataset.m), { locked: true, onDone: async () => { D = await loadData(t.id); draw(); } })));
  };
  draw();
  const timer = setInterval(async () => { if (st.tab === 'live') { D = await loadData(t.id); draw(); } }, 10000);
  return () => clearInterval(timer);
}
