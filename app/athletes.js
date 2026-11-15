import {
  sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, baht, fmtDate, publicUrl, teamName, people,
  REG_STATUS_TH, PAY_TH, KIND_TH, GENDER_TH, tabs, pill, notify, csv, downloadFile,
} from './core.js';

export async function athletesPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน <a href="#/tournaments/new">สร้างรายการ</a></div>`);
  let D = await loadData(t.id);
  const refs = (await sb.from('referees').select('*').eq('tournament_id', t.id).order('court_no')).data || [];
  const state = { tab: 'regs', cat: '', status: '', pay: '', q: '', refs };

  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const list = D.regs.filter((r) =>
      (!state.cat || r.category_id === state.cat) && (!state.status || r.status === state.status) && (!state.pay || r.pay_status === state.pay) &&
      (!q || [r.p1_name, r.p1_nick, r.p1_phone, r.p2_name, r.p2_nick, r.p2_phone].some((x) => (x || '').toLowerCase().includes(q))));
    const paidSum = list.filter((r) => r.pay_status === 'paid').reduce((n, r) => n + (D.C[r.category_id] || {}).fee, 0);
    mount(root, html`
      <div class="row between"><h2>จัดการนักกีฬา · ${t.name}</h2>
        <button class="btn sm" id="exp">⬇ ดาวน์โหลดรายชื่อ (CSV)</button></div>
      <div class="tabs" id="tb">${raw(tabs([['regs', `ผู้สมัคร (${D.regs.length})`], ['players', 'ประวัตินักกีฬา'], ['refs', `กรรมการ (${refs.length})`]], state.tab))}</div>
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
      : state.tab === 'players' ? playersView(D) : refsView(state.refs, D)}
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
    $$('[data-ref-del]', root).forEach((b) => (b.onclick = () => busy(b, async () => {
      const { error } = await sb.from('referees').delete().eq('id', b.dataset.refDel); if (error) throw error;
      state.refs = state.refs.filter((x) => x.id !== b.dataset.refDel); draw();
    })));
    const rf = $('#ref-form', root);
    if (rf) rf.onsubmit = async (e) => {
      e.preventDefault();
      const row = { tournament_id: t.id, name: $('#rn', root).value.trim(), phone: $('#rp', root).value.trim() || null, court_no: Number($('#rc', root).value) || null };
      if (!row.name) return toast('กรอกชื่อกรรมการ', 'err');
      const { data, error } = await sb.from('referees').insert(row).select().single();
      if (error) return toast(error.message, 'err');
      state.refs.push(data); draw();
    };
    $$('[data-ref-court]', root).forEach((s) => (s.onchange = async () => {
      const { error } = await sb.from('referees').update({ court_no: Number(s.value) || null }).eq('id', s.dataset.refCourt);
      toast(error ? error.message : 'มอบหมายสนามแล้ว', error ? 'err' : 'ok');
    }));
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

function refsView(refs, D) {
  const courts = D.courts.length ? D.courts.map((c) => c.no) : [];
  return html`<div class="card stack"><h3>กรรมการ</h3>
    ${refs.length ? html`<div class="tw"><table class="t"><thead><tr><th>ชื่อ</th><th>เบอร์</th><th>สนามที่รับผิดชอบ</th><th></th></tr></thead><tbody>
      ${refs.map((r) => html`<tr><td data-l="ชื่อ">${r.name}</td><td data-l="เบอร์">${r.phone || '-'}</td>
        <td data-l="สนาม"><select data-ref-court="${r.id}"><option value="">-</option>${courts.map((n) => raw(`<option value="${n}" ${r.court_no === n ? 'selected' : ''}>สนาม ${n}</option>`))}</select></td>
        <td data-l=""><button class="btn sm danger" data-ref-del="${r.id}">ลบ</button></td></tr>`)}</tbody></table></div>` : html`<div class="empty">ยังไม่มีกรรมการ</div>`}
    <form id="ref-form" class="grid g4" novalidate>
      <label class="field"><span>ชื่อกรรมการ</span><input id="rn" maxlength="80"></label>
      <label class="field"><span>เบอร์โทร</span><input id="rp" type="tel" maxlength="20"></label>
      <label class="field"><span>สนาม</span><select id="rc"><option value="">-</option>${courts.map((n) => raw(`<option value="${n}">สนาม ${n}</option>`))}</select></label>
      <div style="align-self:end"><button class="btn primary" type="submit" style="width:100%">เพิ่มกรรมการ</button></div></form>
    <p class="muted small">กรรมการใช้หน้ากรรมการเดิมผ่านลิงก์/QR ของแต่ละสนามในหน้า Live Score</p></div>`;
}
