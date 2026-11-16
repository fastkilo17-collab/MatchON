import {
  sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, baht, fmtDate, publicUrl, teamName, people,
  REG_STATUS_TH, PAY_TH, KIND_TH, GENDER_TH, tabs, pill, notify, csv, downloadFile,
} from './core.js';

export async function athletesPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน <a href="#/tournaments/new">สร้างรายการ</a></div>`);
  let D = await loadData(t.id);
  const state = { tab: 'regs', cat: '', status: '', pay: '', q: '' };

  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const list = D.regs.filter((r) =>
      (!state.cat || r.category_id === state.cat) && (!state.status || r.status === state.status) && (!state.pay || r.pay_status === state.pay) &&
      (!q || [r.p1_name, r.p1_nick, r.p1_phone, r.p2_name, r.p2_nick, r.p2_phone].some((x) => (x || '').toLowerCase().includes(q))));
    const paidSum = list.filter((r) => r.pay_status === 'paid').reduce((n, r) => n + (D.C[r.category_id] || {}).fee, 0);
    mount(root, html`
      <div class="row between"><h2>จัดการนักกีฬา · ${t.name}</h2>
        <div class="row"><button class="btn sm primary" id="addreg">＋ เพิ่มผู้สมัคร</button><button class="btn sm" id="simreg">🎲 จำลองผู้สมัคร</button><button class="btn sm" id="exp">⬇ CSV</button></div></div>
      <div class="tabs" id="tb">${raw(tabs([['regs', `ผู้สมัคร (${D.regs.length})`], ['players', 'ประวัตินักกีฬา']], state.tab))}</div>
      ${state.tab === 'regs' ? html`
        <div class="card stack">
          <div class="grid g4">
            <label class="field"><span>ค้นหาชื่อ / เบอร์โทร</span><input id="q" value="${state.q}" placeholder="พิมพ์เพื่อค้นหา"></label>
            <label class="field"><span>รุ่น</span><select id="fc"><option value="">ทั้งหมด</option>${D.cats.map((c) => raw(`<option value="${c.id}" ${state.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`))}</select></label>
            <label class="field"><span>สถานะ</span><select id="fs"><option value="">ทั้งหมด</option>${Object.entries(REG_STATUS_TH).map(([k, l]) => raw(`<option value="${k}" ${state.status === k ? 'selected' : ''}>${l}</option>`))}</select></label>
            <label class="field"><span>การชำระเงิน</span><select id="fp"><option value="">ทั้งหมด</option>${Object.entries(PAY_TH).map(([k, l]) => raw(`<option value="${k}" ${state.pay === k ? 'selected' : ''}>${l}</option>`))}</select></label>
          </div>
          <div class="muted small">แสดง ${list.length} ทีม · ยอดชำระแล้วในรายการที่กรอง ${baht(paidSum)}</div>
        </div>
        ${list.length ? html`<div class="tw"><table class="t"><thead><tr><th>ผู้สมัคร</th><th>รุ่น</th><th>เบอร์</th><th>สถานะ</th><th>ชำระ</th><th>มือวาง</th><th></th></tr></thead><tbody>
          ${list.map((r) => html`<tr>
            <td data-l="ผู้สมัคร"><b>${teamName(r)}</b><br><span class="muted small">${r.p1_name}${r.p2_name ? ' / ' + r.p2_name : ''}</span></td>
            <td data-l="รุ่น">${(D.C[r.category_id] || {}).name}</td>
            <td data-l="เบอร์">${r.p1_phone || ''}</td>
            <td data-l="สถานะ">${raw(pill(REG_STATUS_TH[r.status], r.status === 'confirmed' ? 'ok' : r.status === 'cancelled' ? 'err' : 'warn'))}</td>
            <td data-l="ชำระ">${raw(pill(PAY_TH[r.pay_status], r.pay_status === 'paid' ? 'ok' : r.pay_status === 'rejected' ? 'err' : r.pay_status === 'slip_sent' ? 'warn' : 'gray'))}</td>
            <td data-l="มือวาง"><input data-seed="${r.id}" type="number" min="1" value="${r.seed ?? ''}" style="width:72px;min-height:36px"></td>
            <td data-l="" style="white-space:nowrap">
              ${r.slip_path ? html`<button class="btn sm" data-slip="${r.id}">ดูสลิป</button> ` : ''}
              <button class="btn sm" data-act="${r.id}">จัดการ</button></td></tr>`)}
        </tbody></table></div>` : html`<div class="card empty">ไม่พบผู้สมัครตามเงื่อนไข</div>`}`
      : playersView(D)}
      <dialog id="dlg"></dialog>`);
    bind(list);
  };

  const reload = async () => { D = await loadData(t.id); draw(); };

  const setReg = async (r, patch, note) => {
    const { error } = await sb.from('registrations').update(patch).eq('id', r.id);
    if (error) throw error;
    if (note) await notify(t.id, r.id, note[0], note[1], note[2]);
  };

  const bind = (list) => {
    $$('#tb [data-tab]', root).forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; draw(); }));
    const f = (id, k) => { const el = $('#' + id, root); if (el) el.onchange = () => { state[k] = el.value; draw(); }; };
    f('fc', 'cat'); f('fs', 'status'); f('fp', 'pay');
    const q = $('#q', root);
    if (q) q.oninput = () => { state.q = q.value; clearTimeout(bind.t); bind.t = setTimeout(() => { draw(); const n = $('#q', root); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    $('#addreg', root).onclick = () => addDialog();
    $('#simreg', root).onclick = () => simDialog();
    $('#exp', root).onclick = () => {
      const rows = [['รุ่น', 'ชื่อทีม', 'ผู้เล่น 1', 'เบอร์ 1', 'ผู้เล่น 2', 'เบอร์ 2', 'สถานะ', 'ชำระเงิน', 'ค่าสมัคร', 'มือวาง']];
      D.regs.forEach((r) => rows.push([(D.C[r.category_id] || {}).name, teamName(r), r.p1_name, r.p1_phone, r.p2_name, r.p2_phone, REG_STATUS_TH[r.status], PAY_TH[r.pay_status], (D.C[r.category_id] || {}).fee, r.seed]));
      downloadFile(`ผู้สมัคร-${t.slug}.csv`, csv(rows));
    };
    $$('[data-seed]', root).forEach((i) => (i.onchange = async () => {
      const { error } = await sb.from('registrations').update({ seed: i.value ? Number(i.value) : null }).eq('id', i.dataset.seed);
      toast(error ? error.message : 'บันทึกมือวางแล้ว', error ? 'err' : 'ok');
    }));
    $$('[data-slip]', root).forEach((b) => (b.onclick = async () => {
      const r = D.E[b.dataset.slip];
      const { data, error } = await sb.storage.from('slips').createSignedUrl(r.slip_path, 300);
      if (error) return toast(error.message, 'err');
      const dlg = $('#dlg', root);
      mount(dlg, html`<div class="stack"><h3>สลิปของ ${teamName(r)}</h3><img class="slipimg" src="${data.signedUrl}" alt="สลิป">
        <div class="row"><button class="btn primary" id="ok">อนุมัติ ชำระแล้ว</button><button class="btn danger" id="no">สลิปไม่ผ่าน</button><button class="btn" id="cl">ปิด</button></div></div>`);
      dlg.showModal();
      $('#cl', dlg).onclick = () => dlg.close();
      $('#ok', dlg).onclick = () => busy($('#ok', dlg), async () => { await markPaid(r, 'promptpay'); dlg.close(); await reload(); });
      $('#no', dlg).onclick = () => busy($('#no', dlg), async () => {
        await setReg(r, { pay_status: 'rejected' }, ['payment', 'สลิปไม่ผ่านการตรวจสอบ', 'กรุณาส่งสลิปใหม่ที่ชัดเจนในหน้าสถานะการสมัคร']);
        dlg.close(); await reload();
      });
    }));
    $$('[data-act]', root).forEach((b) => (b.onclick = () => manage(D.E[b.dataset.act])));
  };

  const catOpts = (sel) => D.cats.map((c) => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const addDialog = () => {
    const dlg = $('#dlg', root);
    const first = state.cat || (D.cats[0] && D.cats[0].id);
    if (!first) return toast('ยังไม่มีรุ่นแข่งขัน', 'err');
    mount(dlg, html`<form class="stack" id="af" novalidate><h3>เพิ่มผู้สมัครแทนนักกีฬา</h3>
      <label class="field"><span>รุ่น</span><select id="ac">${raw(catOpts(first))}</select></label>
      <div class="grid g2"><label class="field"><span>ชื่อ-สกุล (ผู้เล่น 1)</span><input id="n1"></label><label class="field"><span>ชื่อเล่น</span><input id="k1"></label>
        <label class="field"><span>เบอร์โทร</span><input id="h1" type="tel"></label><label class="field"><span>ปีเกิด (พ.ศ./ค.ศ.)</span><input id="y1" type="number"></label></div>
      <div id="p2box" class="grid g2"><label class="field"><span>ชื่อ-สกุล (คู่)</span><input id="n2"></label><label class="field"><span>ชื่อเล่น (คู่)</span><input id="k2"></label>
        <label class="field"><span>เบอร์โทร (คู่)</span><input id="h2" type="tel"></label><label class="field"><span>ปีเกิด (คู่)</span><input id="y2" type="number"></label></div>
      <label class="check"><input id="ap" type="checkbox"><span>รับค่าสมัครเงินสดแล้ว</span></label>
      <div class="row"><button class="btn primary" type="submit">บันทึก</button><button class="btn" type="button" id="cl">ปิด</button></div></form>`);
    const sync = () => { $('#p2box', dlg).hidden = (D.C[$('#ac', dlg).value] || {}).kind !== 'doubles'; };
    $('#ac', dlg).onchange = sync; sync();
    dlg.showModal(); $('#cl', dlg).onclick = () => dlg.close();
    $('#af', dlg).onsubmit = (e) => {
      e.preventDefault();
      busy($('#af button[type=submit]', dlg), async () => {
        await addReg($('#ac', dlg).value, { name: $('#n1', dlg).value, nick: $('#k1', dlg).value, phone: $('#h1', dlg).value, year: $('#y1', dlg).value },
          { name: $('#n2', dlg).value, nick: $('#k2', dlg).value, phone: $('#h2', dlg).value, year: $('#y2', dlg).value }, $('#ap', dlg).checked);
        dlg.close(); toast('เพิ่มผู้สมัครแล้ว'); await reload();
      });
    };
  };
  const ce = (y) => { const n = Number(y); return n ? (n > 2400 ? n - 543 : n) : null; };
  const addReg = async (cat, a, b, paid) => {
    const mk = (p) => ({ name: (p.name || '').trim(), nick: (p.nick || '').trim(), phone: (p.phone || '').trim(), birth_year: ce(p.year) });
    const { error } = await sb.rpc('admin_add_registration', { p_tournament: t.id, p_category: cat, p_p1: mk(a), p_p2: mk(b), p_status: 'confirmed', p_paid: !!paid });
    if (error) throw error;
  };
  const FIRST = ['สมชาย', 'สมหญิง', 'ธนากร', 'ปิยะ', 'วีรชัย', 'กมล', 'ศิริพร', 'อนุชา', 'พรทิพย์', 'ณัฐวุฒิ', 'กิตติ', 'จิราพร', 'ชัยวัฒน์', 'นภัส', 'รัชพล', 'สุนิสา', 'ภูริภัทร', 'อรอุมา', 'เจษฎา', 'มนัสนันท์'];
  const LAST = ['ใจดี', 'แสงทอง', 'พงษ์ไทย', 'เจริญสุข', 'รักษา', 'วงศ์ใหญ่', 'ศรีสุข', 'บุญมา', 'ทองคำ', 'สุขสวัสดิ์', 'มีชัย', 'อินทร์แก้ว'];
  const NICK = ['บอล', 'ต้น', 'เอ็ม', 'ฟลุ๊ค', 'ปอ', 'มาย', 'นิว', 'กุ้ง', 'โอ๊ต', 'แพร', 'ก้อง', 'ฝน', 'เบสท์', 'อาร์ม', 'ไอซ์'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const fake = () => ({ name: pick(FIRST) + ' ' + pick(LAST), nick: pick(NICK), phone: '08' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'), year: String(1975 + Math.floor(Math.random() * 35) + 543) });
  const simDialog = () => {
    const dlg = $('#dlg', root);
    if (!D.cats.length) return toast('ยังไม่มีรุ่นแข่งขัน', 'err');
    mount(dlg, html`<div class="stack"><h3>🎲 จำลองผู้สมัครอัตโนมัติ</h3><p class="muted small">สร้างผู้สมัครสมมติ (อนุมัติแล้ว) เพื่อทดสอบการจับสายและตาราง ลบได้ภายหลังโดยกด "จัดการ → ยกเลิกใบสมัคร"</p>
      <label class="field"><span>รุ่น</span><select id="sc"><option value="__all">ทุกรุ่น</option>${raw(catOpts(state.cat))}</select></label>
      <label class="field"><span>จำนวนทีมต่อรุ่น</span><input id="sn" type="number" min="1" max="64" value="8"></label>
      <label class="check"><input id="sp" type="checkbox" checked><span>ถือว่าชำระเงินแล้ว</span></label>
      <div class="row"><button class="btn primary" id="go">สร้าง</button><button class="btn" id="cl">ปิด</button></div></div>`);
    dlg.showModal(); $('#cl', dlg).onclick = () => dlg.close();
    $('#go', dlg).onclick = () => busy($('#go', dlg), async () => {
      const n = Math.max(1, Math.min(64, Number($('#sn', dlg).value) || 8));
      const sel = $('#sc', dlg).value, cats = sel === '__all' ? D.cats : [D.C[sel]];
      let ok = 0;
      for (const c of cats) for (let i = 0; i < n; i++) {
        try { await addReg(c.id, fake(), c.kind === 'doubles' ? fake() : {}, $('#sp', dlg).checked); ok++; } catch (e) { /* duplicate phone etc. */ }
      }
      dlg.close(); toast(`สร้างผู้สมัครจำลอง ${ok} ทีม`); await reload();
    });
  };

  const markPaid = async (r, method) => {
    const fee = (D.C[r.category_id] || {}).fee || 0;
    await setReg(r, { pay_status: 'paid', status: r.status === 'waitlist' ? 'waitlist' : 'confirmed' }, ['payment', 'ได้รับค่าสมัครแล้ว', `ยืนยันการชำระเงิน ${baht(fee)} สิทธิ์การแข่งขันของคุณยืนยันเรียบร้อย`]);
    const { error } = await sb.from('payments').insert({ registration_id: r.id, tournament_id: t.id, amount: fee, method });
    if (error) throw error;
  };

  const manage = (r) => {
    const dlg = $('#dlg', root);
    const fee = (D.C[r.category_id] || {}).fee || 0;
    mount(dlg, html`<div class="stack"><h3>${teamName(r)}</h3><div class="muted small">${(D.C[r.category_id] || {}).name} · ${r.p1_phone || ''}</div>
      <div class="grid g2">
        <button class="btn primary" data-a="approve">✔ อนุมัติใบสมัคร</button>
        <button class="btn" data-a="cash" ${fee ? '' : 'disabled'}>💵 รับเงินสด / ชำระแล้ว</button>
        <button class="btn" data-a="wait">⏳ ย้ายไปรายชื่อสำรอง</button>
        <button class="btn danger" data-a="cancel">✖ ยกเลิกใบสมัคร</button>
      </div>
      <label class="field"><span>หมายเหตุ</span><textarea id="note" rows="2">${r.note || ''}</textarea></label>
      <div class="row"><button class="btn" id="savenote">บันทึกหมายเหตุ</button><button class="btn" id="cl">ปิด</button></div></div>`);
    dlg.showModal();
    $('#cl', dlg).onclick = () => dlg.close();
    $('#savenote', dlg).onclick = () => busy($('#savenote', dlg), async () => { await setReg(r, { note: $('#note', dlg).value.trim() || null }); dlg.close(); await reload(); });
    $$('[data-a]', dlg).forEach((b) => (b.onclick = () => busy(b, async () => {
      const a = b.dataset.a;
      if (a === 'approve') await setReg(r, { status: 'confirmed' }, ['approved', 'อนุมัติใบสมัครแล้ว', `ใบสมัครรุ่น ${(D.C[r.category_id] || {}).name} ได้รับการอนุมัติ`]);
      if (a === 'cash') await markPaid(r, 'cash');
      if (a === 'wait') await setReg(r, { status: 'waitlist' }, ['info', 'อยู่ในรายชื่อสำรอง', 'ผู้จัดจะแจ้งเมื่อมีที่ว่าง']);
      if (a === 'cancel') { if (!window.confirm('ยกเลิกใบสมัครนี้?')) return; await setReg(r, { status: 'cancelled' }, ['info', 'ใบสมัครถูกยกเลิก', 'ติดต่อผู้จัดหากมีข้อสงสัย']); }
      dlg.close(); toast('ดำเนินการแล้ว'); await reload();
    })));
  };

  draw();
}

function playersView(D) {
  // one row per person across the tournament, with the history of what they entered
  const map = new Map();
  for (const r of D.regs.filter((x) => x.status !== 'cancelled')) {
    for (const k of ['p1', 'p2']) {
      if (!r[k + '_name']) continue;
      const key = (r[k + '_phone'] || '') + '|' + r[k + '_name'].toLowerCase();
      const e = map.get(key) || { name: r[k + '_name'], nick: r[k + '_nick'], phone: r[k + '_phone'], year: r[k + '_birth_year'], photo: r[k + '_photo'], cats: [] };
      e.cats.push((D.C[r.category_id] || {}).name);
      map.set(key, e);
    }
  }
  const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  return html`<div class="card"><h3>นักกีฬาทั้งหมด (${rows.length} คน)</h3>${rows.length ? html`<div class="tw"><table class="t"><thead><tr><th>ชื่อ</th><th>เบอร์</th><th>ปีเกิด (พ.ศ.)</th><th>รุ่นที่สมัคร</th></tr></thead><tbody>
    ${rows.map((p) => html`<tr><td data-l="ชื่อ"><b>${p.nick || p.name}</b><br><span class="muted small">${p.name}</span></td><td data-l="เบอร์">${p.phone || '-'}</td>
      <td data-l="ปีเกิด">${p.year ? p.year + 543 : '-'}</td><td data-l="รุ่น">${p.cats.join(', ')}</td></tr>`)}</tbody></table></div>` : html`<div class="empty">ยังไม่มีนักกีฬา</div>`}</div>`;
}

