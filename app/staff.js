import { sb, S, curT, loadData, html, raw, mount, $, $$, toast, busy, canManage } from './core.js';

export async function staffPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  const D = await loadData(t.id);
  const mgr = canManage();
  let refs = (await sb.from('referees').select('*').eq('tournament_id', t.id).order('court_no')).data || [];
  let staff = [];
  if (mgr) { const r = await sb.rpc('list_staff', { p_tournament: t.id }); staff = r.data || []; }
  const courts = D.courts.map((c) => c.no);
  const opts = (sel) => `<option value="">-</option>` + courts.map((n) => `<option value="${n}" ${sel === n ? 'selected' : ''}>สนาม ${n}</option>`).join('');

  const draw = () => {
    mount(root, html`
      <h2>กรรมการและสตาฟฟ์ · ${t.name}</h2>
      <div class="card stack"><h3>กรรมการ (${refs.length})</h3>
        <p class="muted small">กรรมการไม่ต้องมีบัญชี ใช้ QR ประจำสนามเปิดหน้ากรรมการ (ปุ่มอยู่ในหน้า Live Score)</p>
        ${refs.length ? html`<div class="tw"><table class="t"><thead><tr><th>ชื่อ</th><th>เบอร์</th><th>สนาม</th>${mgr ? html`<th></th>` : ''}</tr></thead><tbody>
          ${refs.map((r) => html`<tr><td data-l="ชื่อ">${r.name}</td><td data-l="เบอร์">${r.phone || '-'}</td>
            <td data-l="สนาม">${mgr ? html`<select data-rc="${r.id}">${raw(opts(r.court_no))}</select>` : (r.court_no ? 'สนาม ' + r.court_no : '-')}</td>
            ${mgr ? html`<td data-l=""><button class="btn sm danger" data-rd="${r.id}">ลบ</button></td>` : ''}</tr>`)}</tbody></table></div>` : html`<div class="empty">ยังไม่มีกรรมการ</div>`}
        ${mgr ? html`<form id="rf" class="grid g4" novalidate>
          <label class="field"><span>ชื่อกรรมการ</span><input id="rn" maxlength="80"></label>
          <label class="field"><span>เบอร์โทร</span><input id="rp" type="tel" maxlength="20"></label>
          <label class="field"><span>สนาม</span><select id="rc">${raw(opts(null))}</select></label>
          <div style="align-self:end"><button class="btn primary" style="width:100%" type="submit">＋ เพิ่มกรรมการ</button></div></form>` : ''}</div>
      ${mgr ? html`<div class="card stack"><h3>สตาฟฟ์ (${staff.length})</h3>
        <p class="muted small">สตาฟฟ์จัดการรายการนี้ได้ (ผู้สมัคร จับสาย ตาราง สนาม คะแนน) ต้องสมัครสมาชิกด้วยอีเมลก่อน แล้วกรอกอีเมลนั้นเพื่อเพิ่ม</p>
        ${staff.length ? html`<div class="tw"><table class="t"><thead><tr><th>ชื่อ</th><th>อีเมล</th><th></th></tr></thead><tbody>
          ${staff.map((s) => html`<tr><td data-l="ชื่อ">${s.display_name || '-'}</td><td data-l="อีเมล">${s.email}</td><td data-l=""><button class="btn sm danger" data-sd="${s.id}">ลบ</button></td></tr>`)}</tbody></table></div>` : html`<div class="empty">ยังไม่มีสตาฟฟ์</div>`}
        <form id="sf" class="row" novalidate><label class="field" style="flex:1;min-width:200px"><span>อีเมลสตาฟฟ์</span><input id="se" type="email" autocomplete="off"></label>
          <button class="btn primary" type="submit" style="align-self:end">＋ เพิ่มสตาฟฟ์</button></form></div>` : ''}`);
    if (!mgr) return;
    $$('[data-rc]', root).forEach((s) => (s.onchange = async () => {
      const { error } = await sb.from('referees').update({ court_no: Number(s.value) || null }).eq('id', s.dataset.rc);
      toast(error ? error.message : 'มอบหมายสนามแล้ว', error ? 'err' : 'ok');
    }));
    $$('[data-rd]', root).forEach((b) => (b.onclick = () => busy(b, async () => {
      if (!window.confirm('ลบกรรมการคนนี้?')) return;
      const { error } = await sb.from('referees').delete().eq('id', b.dataset.rd); if (error) throw error;
      refs = refs.filter((x) => x.id !== b.dataset.rd); draw();
    })));
    $('#rf', root).onsubmit = async (e) => {
      e.preventDefault();
      const row = { tournament_id: t.id, name: $('#rn', root).value.trim(), phone: $('#rp', root).value.trim() || null, court_no: Number($('#rc', root).value) || null };
      if (!row.name) return toast('กรอกชื่อกรรมการ', 'err');
      const { data, error } = await sb.from('referees').insert(row).select().single();
      if (error) return toast(error.message, 'err');
      refs.push(data); draw(); toast('เพิ่มกรรมการแล้ว');
    };
    $('#sf', root).onsubmit = async (e) => {
      e.preventDefault();
      const em = $('#se', root).value.trim();
      if (!em) return toast('กรอกอีเมล', 'err');
      const { error } = await sb.rpc('add_staff', { p_tournament: t.id, p_email: em });
      if (error) return toast(error.message, 'err');
      staff = (await sb.rpc('list_staff', { p_tournament: t.id })).data || []; draw(); toast('เพิ่มสตาฟฟ์แล้ว');
    };
    $$('[data-sd]', root).forEach((b) => (b.onclick = () => busy(b, async () => {
      if (!window.confirm('ลบสตาฟฟ์คนนี้?')) return;
      const { error } = await sb.rpc('remove_staff', { p_staff: b.dataset.sd }); if (error) throw error;
      staff = staff.filter((x) => x.id !== b.dataset.sd); draw();
    })));
  };
  draw();
}
