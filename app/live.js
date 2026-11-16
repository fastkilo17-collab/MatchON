import { sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, name, fmtTime, canManage, publicUrl, KIND_TH, MATCH_TH, notify } from './core.js';
import { setWinner, matchWinner, saveResult, ruleFor, ruleText } from './matchops.js';
import { qrToCanvas } from '../js/qr.js';

const CODE = (m) => m.id.slice(0, 8);
const nick = (r, k) => (r && (r[k + '_nick'] || r[k + '_name'])) || '';
const realN = (r, k) => (r && r[k + '_name']) || '';
const photo = (r, k) => (r && r[k + '_photo'] ? publicUrl('photos', r[k + '_photo']) : '');
const MN = (m) => (m && m.match_no ? '#' + m.match_no : '');
const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

export async function livePage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  const mgr = canManage();
  let D = await loadData(t.id);
  let FB = null, fb = {}, cfg = null, bridgeOn = false;
  const unsubs = [];
  const lastPushed = {};

  mount(root, html`<div class="row between"><h2>Live Score · ${t.name}</h2><span class="muted small" id="stamp"></span></div>
    <div id="lv" class="stack"></div><dialog id="ld"></dialog>`);
  const lv = $('#lv', root), dlg = $('#ld', root);

  // ---------- view model of one court ----------
  const view = (c) => {
    const live = D.matches.filter((m) => m.court === c.no && m.status === 'live' && m.reg_a && m.reg_b)[0];
    const wait = !live && D.matches.filter((m) => m.court === c.no && m.status === 'scheduled' && m.reg_a && m.reg_b)
      .sort((a, b) => (+new Date(a.scheduled_at || 0)) - (+new Date(b.scheduled_at || 0)))[0];
    const m = live || wait || null;
    const cat = m ? D.C[m.category_id] || {} : {};
    const rule = m ? ruleFor(D, m) : { best_of: 3 };
    let sets = m ? (m.sets || []) : [], cur = m ? [m.cur_a || 0, m.cur_b || 0] : [0, 0];
    const f = fb[c.no];
    if (live && f && f.status === 'LIVE' && f.matchCode === CODE(live)) {
      const act = f.activeSet >= 0 ? f.activeSet : 0;
      sets = f.scores.slice(0, act).filter((s) => s[0] || s[1]);
      cur = f.scores[act] || [0, 0];
    }
    const won = [0, 0];
    sets.forEach(([x, y]) => { const w = setWinner(x, y, rule); if (w === 'a') won[0]++; else if (w === 'b') won[1]++; else if (x !== y) won[x > y ? 0 : 1]++; });
    const kind = c.status === 'maintenance' ? 'off' : live ? 'live' : wait ? 'wait' : 'free';
    return { c, m, cat, rule, sets, cur, won, kind, setNo: sets.length + 1 };
  };

  const avatar = (r, k) => {
    const u = photo(r, k), n = realN(r, k) || nick(r, k) || '?';
    return u ? `<img class="av" src="${esc(u)}" alt="${esc(n)}" loading="lazy">` : `<span class="av ph">${esc([...n][0] || '?')}</span>`;
  };
  const teamRow = (r, i, v) => {
    const ks = ['p1', 'p2'].filter((k) => r && r[k + '_name']);
    return `<div class="lt"><div class="avs">${ks.map((k) => avatar(r, k)).join('')}</div>
      <div class="ln"><b>${esc(ks.map((k) => nick(r, k)).join(' / ') || 'รอผลการแข่ง')}</b><small>${esc(ks.map((k) => realN(r, k)).join(' / '))}${r && r.club ? ' · ' + esc(r.club) : ''}</small></div>
      <div class="lw" title="เซตที่ชนะ">${v.won[i]}</div><div class="lp">${v.cur[i]}</div></div>`;
  };
  const card = (v) => {
    const { c, m, cat, kind, rule } = v;
    const label = { off: 'งดใช้งาน', live: 'กำลังแข่ง', wait: 'รอแข่ง', free: 'ว่าง' }[kind];
    const ra = m && D.E[m.reg_a], rb = m && D.E[m.reg_b];
    return `<div class="lc ${kind}"><div class="lh"><b>สนาม ${c.no}</b><span class="st ${kind}">${kind === 'live' ? '<i></i>' : ''}${label}</span></div>
      ${m ? `<div class="chips">${m.match_no ? `<span class="mn">แมตช์ #${m.match_no}</span>` : ''}<span>${esc(KIND_TH[cat.kind] || '')}</span><span>${esc(cat.name || '')}</span><span>${esc(m.round_label || '')}</span>${cat.level ? `<span>มือ ${esc(cat.level)}</span>` : ''}</div>
        <div class="lcols"><span></span><span>เซต</span><span>คะแนน</span></div>${teamRow(ra, 0, v)}${teamRow(rb, 1, v)}
        <div class="lf"><span>${kind === 'live' ? `เซตที่ ${Math.min(v.setNo, rule.best_of)}/${rule.best_of}` : (m.scheduled_at ? 'เวลา ' + fmtTime(m.scheduled_at) : 'รอเริ่ม')}</span>
          <span>${v.sets.map(([x, y]) => `${x}-${y}`).join(' · ')}</span></div>`
        : `<div class="empty small">${kind === 'off' ? 'ปิดปรับปรุง' : 'พร้อมเรียกแมตช์ลงสนาม'}</div>`}
      ${mgr ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-qr="${c.no}">📱 QR กรรมการ</button>
        ${kind === 'free' || kind === 'wait' ? `<button class="btn sm ${kind === 'free' ? 'primary' : ''}" data-call="${c.no}">📣 ${kind === 'wait' ? 'เปลี่ยนคู่' : 'เรียกคู่ลงสนาม'}</button>` : ''}
        ${kind === 'wait' ? `<button class="btn sm primary" data-start="${m.id}">▶ เริ่มแข่ง</button>` : ''}
        ${m ? `<button class="btn sm" data-score="${m.id}">✍ ลงคะแนน</button>` : ''}</div>` : ''}</div>`;
  };

  const draw = () => {
    if (dlg.open) return;
    const vs = D.courts.map(view);
    const nlive = vs.filter((v) => v.kind === 'live').length;
    lv.innerHTML = `<div class="kpis"><div class="kpi"><small>สนามทั้งหมด</small><b>${vs.length}</b></div><div class="kpi"><small>กำลังแข่ง</small><b>${nlive}</b></div>
      <div class="kpi"><small>ว่าง</small><b>${vs.filter((v) => v.kind === 'free').length}</b></div><div class="kpi"><small>รอแข่ง</small><b>${vs.filter((v) => v.kind === 'wait').length}</b></div></div>
      ${vs.length ? `<div class="lgrid">${vs.map(card).join('')}</div>` : '<div class="card empty">ยังไม่มีสนาม ไปที่ "จัดการสนาม" เพื่อเพิ่ม</div>'}
      <p class="muted small">อัปเดตอัตโนมัติ${bridgeOn ? ' · เชื่อมหน้ากรรมการแล้ว (เปิดหน้านี้ค้างไว้เพื่อรับคะแนนจากกรรมการ)' : ''}</p>`;
    const st = $('#stamp', root); if (st) st.textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH');
    if (!mgr) return;
    $$('[data-qr]', lv).forEach((b) => (b.onclick = () => qrDialog(Number(b.dataset.qr))));
    $$('[data-start]', lv).forEach((b) => (b.onclick = () => busy(b, async () => startMatch(D.matches.find((m) => m.id === b.dataset.start)))));
    $$('[data-call]', lv).forEach((b) => (b.onclick = () => callDialog(Number(b.dataset.call))));
    $$('[data-score]', lv).forEach((b) => (b.onclick = () => scoreDialog(D.matches.find((m) => m.id === b.dataset.score))));
  };
  const reload = async () => { D = await loadData(t.id); draw(); };

  // ---------- Firebase court payload ----------
  const courtPayload = (no, m) => {
    if (!m) return { courtNo: no, status: 'READY', round: 'คอร์ทว่าง (พร้อมเรียกคู่ถัดไป)', teamA: 'รอเรียกคู่แข่งขัน', clubA: '-', teamB: 'รอเรียกคู่แข่งขัน', clubB: '-', scores: [[0, 0], [0, 0], [0, 0]], tournament: t.name };
    const a = D.E[m.reg_a], b = D.E[m.reg_b], ks = (r) => ['p1', 'p2'].filter((k) => r && r[k + '_name']);
    const side = (r) => ({ team: ks(r).map((k) => nick(r, k)).join(' / '), real: ks(r).map((k) => realN(r, k)), ph: ks(r).map((k) => photo(r, k)) });
    const A = side(a), B = side(b);
    return { courtNo: no, status: 'LIVE', matchCode: CODE(m), round: `${MN(m)} ${(D.C[m.category_id] || {}).name || ''} ${m.round_label || ''}`.trim(), tournament: t.name,
      teamA: A.team, clubA: (a && a.club) || '', teamB: B.team, clubB: (b && b.club) || '', realA: A.real, realB: B.real, photoA: A.ph, photoB: B.ph, scores: [[0, 0], [0, 0], [0, 0]], shuttleUsed: 1, activeSet: -1 };
  };
  const pushCourt = async (no, m) => { if (bridgeOn) { try { await FB.writeCourts(cfg.live_id, [courtPayload(no, m)]); } catch (e) { toast('ส่งไปหน้ากรรมการไม่สำเร็จ: ' + (e.code || e.message), 'err'); } } };

  // ---------- manager bridge Supabase <-> Firebase ----------
  const syncCourt = async (c) => {
    const m = D.matches.find((x) => c.matchCode && x.id.startsWith(c.matchCode));
    if (!m || m.status === 'finished' || c.status !== 'LIVE') return;
    if (!(c.startedAt || c.scores.some((s) => s[0] || s[1]))) return;
    const act = c.activeSet >= 0 ? c.activeSet : 0;
    const sets = c.scores.slice(0, act).filter((s) => s[0] || s[1]), cur = c.scores[act] || [0, 0];
    const sig = JSON.stringify([sets, cur]);
    if (lastPushed[m.id] === sig) return;
    lastPushed[m.id] = sig;
    const patch = { status: 'live', sets, cur_a: cur[0], cur_b: cur[1] };
    const { error } = await sb.from('matches').update(patch).eq('id', m.id);
    if (!error) Object.assign(m, patch);
  };
  const doneSeen = new Set();
  const handleCompleted = async (list) => {
    for (const it of list) {
      if (doneSeen.has(it.fbId)) continue;
      doneSeen.add(it.fbId);
      const m = D.matches.find((x) => it.code && x.id.startsWith(it.code));
      if (!m || m.status === 'finished') continue;
      const sets = String(it.scoreText || '').split(',').map((s) => s.trim().split('-').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
      try { await saveResult(D, m, sets); toast(`บันทึกผลจากกรรมการ: ${name(D, m.reg_a)} vs ${name(D, m.reg_b)}`); await reload(); }
      catch (e) { toast('ผลจากกรรมการไม่ผ่านกติกา: ' + e.message + ' (ใช้ปุ่ม ลงคะแนน เพื่อแก้)', 'err'); }
    }
  };
  const ensureCourt = async (no) => {
    if (fb[no] || !bridgeOn) return;
    const m = D.matches.find((x) => x.court === no && x.status !== 'finished' && x.reg_a && x.reg_b && (x.status === 'live' || x.status === 'scheduled'));
    try { await FB.writeCourts(cfg.live_id, [courtPayload(no, m || null)]); } catch (e) { toast('เตรียมสนามให้กรรมการไม่สำเร็จ: ' + (e.code || e.message), 'err'); }
  };
  const startBridge = async () => {
    try {
      FB = await import('../js/live.js');
      const r = await sb.rpc('ensure_live', { p_tournament: t.id });
      if (r.error) throw r.error;
      cfg = r.data;
      const keys = { ...(cfg.keys || {}) };
      let changed = false;
      for (const c of D.courts) if (!keys['c' + c.no]) { keys['c' + c.no] = rand(24); changed = true; }
      const cn = await FB.connect(cfg.live_id, { master: cfg.master });
      if (!cn.canWrite) throw new Error('เชื่อม Firebase ไม่สำเร็จ (' + (cn.error || '') + (cn.detail ? ' ' + cn.detail : '') + ')');
      if (changed) { await sb.rpc('save_live_keys', { p_tournament: t.id, p_keys: keys }); cfg.keys = keys; }
      await FB.publishCourtKeys(cfg.live_id, keys);
      t.live_id = cfg.live_id;
      bridgeOn = true;
      unsubs.push(FB.watchCompleted(cfg.live_id, handleCompleted));
      for (const c of D.courts) await ensureCourt(c.no);
    } catch (e) { toast('เชื่อมหน้ากรรมการไม่สำเร็จ: ' + (e.message || e), 'err'); }
  };
  const watchPublic = async () => {
    if (!t.live_id) return;
    try {
      FB = FB || (await import('../js/live.js'));
      if (!bridgeOn) { await FB.connect(t.live_id, null); }
      unsubs.push(FB.watchCourts(t.live_id, (list) => {
        fb = Object.fromEntries((list || []).map((c) => [c.courtNo, c]));
        if (bridgeOn) (list || []).forEach(syncCourt);
        draw();
      }));
    } catch (e) { /* offline or Firebase blocked: Supabase data alone still works */ }
  };

  const startMatch = async (m) => {
    if (!m) return;
    const patch = { status: 'live' };
    const { error } = await sb.from('matches').update(patch).eq('id', m.id);
    if (error) throw error;
    Object.assign(m, patch);
    if (bridgeOn && m.court) {
      try { await FB.updateCourt(cfg.live_id, m.court, (x) => { if (!x.startedAt) { x.startedAt = Date.now(); x.paused = false; x.shuttleUsed = x.shuttleUsed || 1; x.status = 'LIVE'; } }); } catch { /* referee page not open yet */ }
    }
    toast('เริ่มแข่งแล้ว'); await reload();
  };

  // ---------- dialogs ----------
  const qrDialog = async (no) => {
    if (!bridgeOn) await startBridge();
    if (!bridgeOn) return;
    if (!cfg.keys['c' + no]) {
      cfg.keys['c' + no] = rand(24);
      await sb.rpc('save_live_keys', { p_tournament: t.id, p_keys: cfg.keys });
      await FB.publishCourtKeys(cfg.live_id, cfg.keys);
    }
    await ensureCourt(no);
    const url = new URL('referee.html?court=' + no + '&live=' + cfg.live_id, location.href).href + '#k=' + cfg.keys['c' + no];
    mount(dlg, html`<div class="stack center"><h3>QR กรรมการ · สนาม ${no}</h3><canvas id="qc" style="margin:0 auto;max-width:100%"></canvas>
      <p class="muted small">ให้กรรมการสแกนเพื่อเปิดหน้าให้คะแนนของสนามนี้ (อย่าแชร์ให้ผู้ชม)</p>
      <div class="row" style="justify-content:center"><button class="btn" id="cp">คัดลอกลิงก์</button><a class="btn" href="${url}" target="_blank" rel="noopener">เปิดหน้ากรรมการ</a><button class="btn" id="cl">ปิด</button></div></div>`);
    dlg.showModal();
    try { qrToCanvas($('#qc', dlg), url, 260); } catch (e) { toast('สร้าง QR ไม่สำเร็จ', 'err'); }
    $('#cl', dlg).onclick = () => { dlg.close(); draw(); };
    $('#cp', dlg).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('คัดลอกแล้ว'); } catch { toast('คัดลอกไม่ได้', 'err'); } };
  };

  const callDialog = (no) => {
    const playing = new Set(D.matches.filter((m) => m.status === 'live').flatMap((m) => [m.reg_a, m.reg_b]));
    const q = D.matches.filter((m) => m.status === 'scheduled' && m.reg_a && m.reg_b && !playing.has(m.reg_a) && !playing.has(m.reg_b))
      .sort((a, b) => (+new Date(a.scheduled_at || '2999-01-01')) - (+new Date(b.scheduled_at || '2999-01-01')) || a.round - b.round || (a.match_no || 0) - (b.match_no || 0));
    mount(dlg, html`<div class="stack"><h3>เรียกคู่ลงสนาม ${no}</h3><p class="muted small">เลือกแมตช์ใดก็ได้ (ข้ามลำดับได้) แสดงเฉพาะคู่ที่ทีมครบและไม่ติดแข่งอยู่</p>
      ${q.length ? q.slice(0, 30).map((m, i) => html`<button class="btn" data-pick="${m.id}" style="justify-content:space-between;text-align:left;height:auto;padding:8px 12px"><span>${m.match_no ? html`<b class="mn">#${m.match_no}</b> ` : ''}<b>${name(D, m.reg_a)}</b> vs <b>${name(D, m.reg_b)}</b><br><small class="muted">${(D.C[m.category_id] || {}).name} · ${m.round_label || ''}</small></span><span class="small">${i === 0 ? 'ถัดไป' : ''}${m.scheduled_at ? ' ' + fmtTime(m.scheduled_at) : ''}${m.court ? ' · สนาม ' + m.court : ''}</span></button>`)
        : html`<div class="empty">ไม่มีแมตช์ที่พร้อมเรียก</div>`}
      <button class="btn" id="cl">ปิด</button></div>`);
    dlg.showModal();
    $('#cl', dlg).onclick = () => { dlg.close(); draw(); };
    $$('[data-pick]', dlg).forEach((b) => (b.onclick = () => busy(b, async () => {
      const m = D.matches.find((x) => x.id === b.dataset.pick);
      const patch = { court: no, status: 'scheduled', scheduled_at: new Date().toISOString(), sets: [], cur_a: 0, cur_b: 0 };
      for (const o of D.matches.filter((x) => x.court === no && x.status === 'scheduled' && x.id !== m.id)) { await sb.from('matches').update({ court: null }).eq('id', o.id); o.court = null; }
      const { error } = await sb.from('matches').update(patch).eq('id', m.id);
      if (error) throw error;
      Object.assign(m, patch);
      for (const id of [m.reg_a, m.reg_b]) await notify(t.id, id, 'schedule', 'เรียกลงสนาม', `${m.round_label || 'แมตช์'} กรุณามาที่สนาม ${no}`).catch(() => {});
      await pushCourt(no, m);
      dlg.close(); toast(`เรียก ${MN(m)} ลงสนาม ${no} แล้ว กด ▶ เริ่มแข่ง หรือให้กรรมการกดเริ่มในหน้ากรรมการ`); await reload();
    })));
  };

  const scoreDialog = (m) => {
    const c = ruleFor(D, m);
    const n = c.best_of || 3;
    const init = (m.sets || []).map((s) => [String(s[0]), String(s[1])]);
    if (m.cur_a || m.cur_b) init.push([String(m.cur_a), String(m.cur_b)]);
    const rows = Array.from({ length: n }, (_, i) => init[i] || ['', '']);
    mount(dlg, html`<div class="stack"><h3>ลงบันทึกคะแนน ${MN(m)} · สนาม ${m.court || '-'}</h3>
      <div class="muted small">${name(D, m.reg_a)} vs ${name(D, m.reg_b)}<br>กติกา: ${ruleText(c)} · ระบบคำนวณเซตให้อัตโนมัติ</div>
      ${rows.map((r, i) => html`<div class="row" data-row="${i}"><span style="width:52px">เซต ${i + 1}</span>
        <input data-v="${i}.0" type="number" inputmode="numeric" min="0" max="${c.cap || 30}" value="${r[0]}" style="width:84px"><span>-</span>
        <input data-v="${i}.1" type="number" inputmode="numeric" min="0" max="${c.cap || 30}" value="${r[1]}" style="width:84px"><span class="small" data-r="${i}"></span></div>`)}
      <div class="card" id="sum" style="padding:10px"></div>
      <div class="row"><button class="btn primary" id="sv">บันทึก</button><button class="btn" id="cl">ปิด</button></div></div>`);
    const val = (i, j) => $(`[data-v="${i}.${j}"]`, dlg).value;
    const calc = () => {
      const done = []; let open = null, decided = false, wA = 0, wB = 0;
      for (let i = 0; i < n && !decided; i++) {
        const rr = $(`[data-r="${i}"]`, dlg);
        const x = val(i, 0), y = val(i, 1);
        if (x === '' && y === '') { rr.textContent = ''; if (!open) open = null; break; }
        const w = setWinner(Number(x), Number(y), c);
        if (w) { done.push([Number(x), Number(y)]); w === 'a' ? wA++ : wB++; rr.textContent = '✔ จบเซต ' + (w === 'a' ? 'ทีม A' : 'ทีม B') + ' ชนะ'; }
        else { open = [Number(x) || 0, Number(y) || 0]; rr.textContent = 'กำลังเล่น'; break; }
        if (matchWinner(done, c)) decided = true;
      }
      const upto = decided ? done.length - 1 : done.length;
      for (let i = 0; i < n; i++) $(`[data-row="${i}"]`, dlg).hidden = i > upto;
      const mw = matchWinner(done, c);
      $('#sum', dlg).innerHTML = `<b>เซตที่ชนะ ${wA} - ${wB}</b> · ${mw ? `ผู้ชนะ: <b>${esc(name(D, mw === 'a' ? m.reg_a : m.reg_b))}</b> (จบแมตช์)` : 'ยังไม่จบแมตช์'}`;
      return { done, open, mw };
    };
    dlg.querySelectorAll('[data-v]').forEach((i) => (i.oninput = calc));
    calc();
    dlg.showModal();
    $('#cl', dlg).onclick = () => { dlg.close(); draw(); };
    $('#sv', dlg).onclick = () => busy($('#sv', dlg), async () => {
      const { done, open, mw } = calc();
      // an unfinished set with scores the rules do not allow (e.g. 25-2) is simply "in play"; a set past cap is rejected by setWinner
      if (mw) {
        await saveResult(D, m, done);
        if (m.court) await pushCourt(m.court, null);
        toast('จบแมตช์และบันทึกผลแล้ว');
      } else {
        const cur = open || [0, 0];
        const patch = { status: 'live', sets: done, cur_a: cur[0], cur_b: cur[1] };
        const { error } = await sb.from('matches').update(patch).eq('id', m.id);
        if (error) throw error;
        if (bridgeOn && m.court) {
          try { await FB.updateCourt(cfg.live_id, m.court, (x) => { const sc = [[0, 0], [0, 0], [0, 0]]; done.forEach((s, i) => { sc[i] = s; }); sc[done.length] = cur; x.scores = sc; x.activeSet = done.length; x.status = 'LIVE'; }); } catch { /* referee page not started */ }
        }
        toast('บันทึกคะแนนแล้ว');
      }
      dlg.close(); await reload();
    });
  };

  dlg.addEventListener('close', () => draw());
  draw();
  if (mgr) await startBridge();
  await watchPublic();
  const timer = setInterval(async () => { if (!dlg.open) { try { D = await loadData(t.id); draw(); } catch { /* keep last view */ } } }, 8000);
  return () => { clearInterval(timer); unsubs.forEach((u) => { try { u(); } catch { /* */ } }); };
}
