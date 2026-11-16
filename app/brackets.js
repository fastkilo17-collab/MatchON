import {
  sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, name, uuid, FORMAT_TH, KIND_TH, GENDER_TH,
  buildKnockout, buildRoundRobin, standings, roundLabel, tabs, canManage,
} from './core.js';
import { openMatchDialog, matchBox, ruleFor, ruleText } from './matchops.js';

const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const GL = (i) => String.fromCharCode(65 + i);

export async function bracketsPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน <a href="#/tournaments/new">สร้างรายการ</a></div>`);
  let D = await loadData(t.id);
  if (!D.cats.length) return mount(root, html`<div class="card empty">ยังไม่มีรุ่น <a href="#/tournaments/${t.id}">เพิ่มรุ่นการแข่งขัน</a></div>`);
  const st = { cat: D.cats[0].id, pending: false };

  const draw = () => {
    const cat = D.C[st.cat];
    const b = D.brackets.find((x) => x.category_id === cat.id);
    const ms = D.matches.filter((m) => m.category_id === cat.id);
    const okStatus = st.pending ? ['confirmed', 'pending'] : ['confirmed'];
    const teams = D.regs.filter((r) => r.category_id === cat.id && okStatus.includes(r.status));
    const locked = !!(b && b.locked);
    mount(root, html`
      <div class="row between noprint"><h2>จัดสายแข่งขัน</h2>
        <div class="row"><button class="btn sm" id="pr">🖨 พิมพ์ / บันทึก PDF</button></div></div>
      <div class="tabs noprint" id="tb">${raw(tabs(D.cats.map((c) => [c.id, esc(c.name)]), st.cat))}</div>
      <div class="card stack">
        <div class="row between"><div><h3>${cat.name}</h3><div class="muted small">${KIND_TH[cat.kind]} · ${GENDER_TH[cat.gender]} · ${FORMAT_TH[(b && b.format) || cat.format]} · ${ruleLine(cat, b)}</div></div>
          <div class="row">${b ? raw(`<span class="pill ${locked ? 'ok' : 'warn'}">${locked ? '🔒 ล็อกสายแล้ว' : 'ร่างสาย (แก้ไขได้)'}</span>`) : ''}</div></div>
        <div class="muted small">ทีมที่ยืนยันแล้ว ${teams.length} ทีม${st.pending ? ' (รวมที่ยังไม่ยืนยัน)' : ''}</div>
        ${canManage() ? controls(cat, b, ms, teams, locked) : ''}
      </div>
      ${ms.length ? view(cat, b, ms) : html`<div class="card empty">ยังไม่ได้สร้างสายสำหรับรุ่นนี้</div>`}
      <dialog id="mdlg"></dialog>`);
    bind(cat, b, ms, teams, locked);
  };

  const ruleLine = (cat, b) => {
    const f = (b && b.format) || cat.format;
    const g = ruleText(ruleFor(D, { category_id: cat.id, stage: 'group' })), k = ruleText(ruleFor(D, { category_id: cat.id, stage: 'knockout' }));
    return f === 'knockout' ? k : f === 'group_knockout' ? `กลุ่ม: ${g} · ไขว้สาย: ${k}` : g;
  };

  const controls = (cat, b, ms, teams, locked) => {
    const fmt = (b && b.format) || cat.format;
    const groups = (b && b.groups) || Math.max(2, Math.round(teams.length / 4));
    if (ms.length) {
      return html`<div class="row noprint">
        ${locked ? html`<button class="btn" id="unlock">🔓 ปลดล็อกสาย</button>` : html`<button class="btn primary" id="lock">🔒 ล็อกสาย (ประกาศอย่างเป็นทางการ)</button>`}
        ${!locked ? html`<button class="btn danger" id="clear">ล้างสายและสร้างใหม่</button>` : ''}
        ${fmt === 'group_knockout' && !ms.some((m) => m.stage === 'knockout') ? html`<button class="btn cyan" id="mkko">สร้างรอบไขว้สาย (ต้องจบรอบกลุ่มก่อน)</button>` : ''}
        ${fmt === 'swiss' ? html`<button class="btn cyan" id="swissnext">สร้างรอบถัดไป (Swiss)</button>` : ''}
        <span class="muted small">${locked ? 'สายล็อกแล้ว: เปลี่ยนทีมไม่ได้ แต่กรอกผลได้' : 'คลิกแมตช์เพื่อเปลี่ยนทีมหรือกรอกผล'}</span></div>`;
    }
    return html`<div class="grid g4 noprint">
      <label class="field"><span>ระบบการแข่งขัน</span><select id="gf">${Object.entries(FORMAT_TH).map(([k, l]) => raw(`<option value="${k}" ${fmt === k ? 'selected' : ''}>${l}</option>`))}</select></label>
      <label class="field"><span>จำนวนกลุ่ม</span><input id="gg" type="number" min="1" max="16" value="${groups}"></label>
      <label class="field"><span>ผ่านเข้ารอบ/กลุ่ม</span><input id="ga" type="number" min="1" max="8" value="${(b && b.advance) || 2}"></label>
      <label class="field"><span>การจัดมือวาง</span><select id="gs"><option value="random">สุ่มทั้งหมด</option><option value="seed">ตามมือวางที่กำหนดไว้ (ที่เหลือสุ่ม)</option></select></label>
      <label class="check" style="grid-column:1/-1"><input type="checkbox" id="gp" ${st.pending ? 'checked' : ''}><span>รวมผู้สมัครที่ยังไม่ได้ยืนยันด้วย</span></label>
      <div style="grid-column:1/-1"><button class="btn primary" id="gen" ${teams.length < 2 ? 'disabled' : ''}>🎲 จัดสายแข่งขัน</button></div></div>`;
  };

  const view = (cat, b, ms) => {
    const fmt = (b && b.format) || cat.format;
    const grp = ms.filter((m) => m.stage === 'group');
    const ko = ms.filter((m) => m.stage === 'knockout' || (m.stage === 'main' && fmt === 'knockout'));
    const rr = ms.filter((m) => m.stage === 'main' && fmt === 'round_robin');
    const sw = ms.filter((m) => m.stage === 'swiss');
    const out = [];
    if (grp.length) {
      const gs = [...new Set(grp.map((m) => m.group_no))].sort((a, c) => a - c);
      out.push(html`<div class="grid g2">${gs.map((g) => {
        const gm = grp.filter((m) => m.group_no === g);
        const ids = [...new Set(gm.flatMap((m) => [m.reg_a, m.reg_b]))];
        return html`<div class="card"><h3>กลุ่ม ${GL(g)}</h3>${standTable(standings(ids, gm), gm)}
          ${gm.map((m) => raw(matchBox(D, m)))}</div>`;
      })}</div>`);
    }
    if (rr.length) {
      const ids = [...new Set(rr.flatMap((m) => [m.reg_a, m.reg_b]))];
      out.push(html`<div class="card"><h3>ตารางคะแนน</h3>${standTable(standings(ids, rr))}</div>
        <div class="card"><h3>ผลการแข่งขัน</h3><div class="grid g3">${rr.map((m) => raw(matchBox(D, m)))}</div></div>`);
    }
    if (sw.length) {
      const ids = [...new Set(sw.flatMap((m) => [m.reg_a, m.reg_b]))];
      const rounds = [...new Set(sw.map((m) => m.round))].sort((a, c) => a - c);
      out.push(html`<div class="card"><h3>อันดับ Swiss</h3>${standTable(standings(ids, sw))}</div>
        ${rounds.map((r) => html`<div class="card"><h3>รอบที่ ${r}</h3><div class="grid g3">${sw.filter((m) => m.round === r).map((m) => raw(matchBox(D, m)))}</div></div>`)}`);
    }
    if (ko.length) {
      const rounds = [...new Set(ko.map((m) => m.round))].sort((a, c) => a - c);
      out.push(html`<div class="card"><h3>${grp.length ? 'รอบไขว้สาย (Knockout)' : 'สายการแข่งขัน'}</h3><div class="bracket">
        ${rounds.map((r) => { const rm = ko.filter((m) => m.round === r).sort((x, y) => x.slot - y.slot);
          return html`<div class="bcol"><h4>${rm[0].round_label}</h4>${rm.map((m) => raw(matchBox(D, m)))}</div>`; })}
      </div></div>`);
    }
    return out;
  };

  const standTable = (rows) => html`<div class="tw"><table class="t"><thead><tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>ชนะ</th><th>แพ้</th><th>เกม +/-</th><th>แต้ม +/-</th></tr></thead><tbody>
    ${rows.map((r, i) => html`<tr><td data-l="#">${i + 1}</td><td data-l="ทีม"><b>${name(D, r.id)}</b></td><td data-l="แข่ง">${r.played}</td><td data-l="ชนะ">${r.won}</td><td data-l="แพ้">${r.lost}</td>
      <td data-l="เกม">${r.gf - r.ga}</td><td data-l="แต้ม">${r.pf - r.pa}</td></tr>`)}</tbody></table></div>`;

  const reload = async () => { D = await loadData(t.id); draw(); };
  let matchNo = () => Math.max(0, ...D.matches.map((m) => m.match_no || 0)) + 1;

  const insertMatches = async (rows) => {
    let n = matchNo();
    rows.slice().sort((x, y) => (x.round - y.round) || ((x.group_no || 0) - (y.group_no || 0)) || (x.slot - y.slot)).forEach((r) => { r.match_no = n++; });   // number in play order
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from('matches').insert(rows.slice(i, i + 200));
      if (error) throw error;
    }
  };

  const bind = (cat, b, ms, teams, locked) => {
    $$('#tb [data-tab]', root).forEach((x) => (x.onclick = () => { st.cat = x.dataset.tab; draw(); }));
    $('#pr', root).onclick = () => window.print();
    $$('[data-m]', root).forEach((el) => (el.onclick = () => {
      if (!canManage()) return;
      openMatchDialog(root, D, D.matches.find((m) => m.id === el.dataset.m), { locked, onDone: reload });
    }));
    const gp = $('#gp', root);
    if (gp) gp.onchange = () => { st.pending = gp.checked; draw(); };
    const gen = $('#gen', root);
    if (gen) gen.onclick = () => busy(gen, async () => {
      const fmt = $('#gf', root).value, G = Number($('#gg', root).value) || 1, adv = Number($('#ga', root).value) || 2;
      const seeded = $('#gs', root).value === 'seed';
      let order;
      if (seeded) {
        const s = teams.filter((r) => r.seed != null).sort((a, c) => a.seed - c.seed);
        order = [...s, ...shuffle(teams.filter((r) => r.seed == null))];
      } else order = shuffle(teams);
      const ids = order.map((r) => r.id);
      const base = { tournamentId: t.id, categoryId: cat.id, uuid };
      let rows = [];
      if (fmt === 'knockout') rows = buildKnockout(ids, base);
      else if (fmt === 'round_robin') rows = buildRoundRobin(ids, base);
      else if (fmt === 'group_stage' || fmt === 'group_knockout') {
        if (ids.length < G * 2) throw new Error('ทีมน้อยเกินไปสำหรับจำนวนกลุ่มนี้ (อย่างน้อยกลุ่มละ 2 ทีม)');
        const groups = Array.from({ length: G }, () => []);
        ids.forEach((id, i) => { const r = Math.floor(i / G); groups[r % 2 === 0 ? i % G : G - 1 - (i % G)].push(id); });   // snake seeding
        groups.forEach((g, gi) => {
          buildRoundRobin(g, base).forEach((m) => rows.push({ ...m, stage: 'group', group_no: gi, round_label: `กลุ่ม ${GL(gi)} · ${m.round_label}` }));
        });
      } else if (fmt === 'swiss') {
        const half = Math.floor(ids.length / 2);
        for (let i = 0; i < half; i++) rows.push({ id: uuid(), tournament_id: t.id, category_id: cat.id, round: 1, round_label: 'รอบที่ 1', slot: i, reg_a: ids[i], reg_b: ids[i + half], status: 'scheduled', stage: 'swiss' });
      }
      await insertMatches(rows);
      const { error } = await sb.from('brackets').upsert({ tournament_id: t.id, category_id: cat.id, format: fmt, groups: G, advance: adv, seeded, locked: false }, { onConflict: 'category_id' });
      if (error) throw error;
      toast('จัดสายแล้ว'); await reload();
    });
    const setLock = (v) => async () => {
      const { error } = await sb.from('brackets').update({ locked: v }).eq('category_id', cat.id);
      if (error) return toast(error.message, 'err');
      await reload();
    };
    const lk = $('#lock', root); if (lk) lk.onclick = setLock(true);
    const ul = $('#unlock', root); if (ul) ul.onclick = setLock(false);
    const cl = $('#clear', root);
    if (cl) cl.onclick = () => busy(cl, async () => {
      if (!window.confirm('ล้างสายของรุ่นนี้ทั้งหมด รวมผลที่กรอกไว้?')) return;
      let r = await sb.from('matches').delete().eq('category_id', cat.id); if (r.error) throw r.error;
      r = await sb.from('brackets').delete().eq('category_id', cat.id); if (r.error) throw r.error;
      await reload();
    });
    const ko = $('#mkko', root);
    if (ko) ko.onclick = () => busy(ko, async () => {
      const grp = ms.filter((m) => m.stage === 'group');
      if (grp.some((m) => m.status !== 'finished')) throw new Error('ยังแข่งรอบกลุ่มไม่ครบ กรอกผลให้ครบก่อน');
      const gs = [...new Set(grp.map((m) => m.group_no))].sort((a, c) => a - c);
      const tops = gs.map((g) => {
        const gm = grp.filter((m) => m.group_no === g);
        return standings([...new Set(gm.flatMap((m) => [m.reg_a, m.reg_b]))], gm).map((r) => r.id);
      });
      const adv = b.advance || 2, order = [];
      for (let k = 0; k < adv; k++) tops.forEach((g) => { if (g[k]) order.push(g[k]); });   // all 1st places, then all 2nd places in the same group order
      if (order.length < 2) throw new Error('มีผู้เข้ารอบน้อยเกินไป');
      const rows = buildKnockout(order, { tournamentId: t.id, categoryId: cat.id, uuid }).map((m) => ({ ...m, stage: 'knockout' }));
      await insertMatches(rows);
      toast('สร้างรอบไขว้สายแล้ว'); await reload();
    });
    const sn = $('#swissnext', root);
    if (sn) sn.onclick = () => busy(sn, async () => {
      const sw = ms.filter((m) => m.stage === 'swiss');
      const last = Math.max(...sw.map((m) => m.round));
      if (sw.some((m) => m.round === last && m.status !== 'finished')) throw new Error('กรอกผลรอบล่าสุดให้ครบก่อน');
      const ids = [...new Set(sw.flatMap((m) => [m.reg_a, m.reg_b]))];
      if (last >= Math.max(1, Math.ceil(Math.log2(ids.length)))) throw new Error('ครบจำนวนรอบ Swiss แล้ว (' + last + ' รอบ)');
      const rank = standings(ids, sw).map((r) => r.id);
      const met = new Set(sw.flatMap((m) => [m.reg_a + m.reg_b, m.reg_b + m.reg_a]));
      const pool = rank.slice();
      const pairs = [];
      while (pool.length > 1) {
        const a = pool.shift();
        const k = pool.findIndex((x) => !met.has(a + x));
        const [bb] = pool.splice(k >= 0 ? k : 0, 1);
        pairs.push([a, bb]);
      }
      const rows = pairs.map(([a, c], i) => ({ id: uuid(), tournament_id: t.id, category_id: cat.id, round: last + 1, round_label: `รอบที่ ${last + 1}`, slot: i, reg_a: a, reg_b: c, status: 'scheduled', stage: 'swiss' }));
      await insertMatches(rows.slice().reverse());
      toast('สร้างรอบถัดไปแล้ว'); await reload();
    });
  };

  draw();
}
