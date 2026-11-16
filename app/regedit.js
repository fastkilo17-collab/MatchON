import { sb, html, raw, mount, $, $$, toast, busy, esc, publicUrl, uploadImage, uuid } from './core.js';

const ce = (y) => { const n = Number(y); return n ? (n > 2400 ? n - 543 : n) : null; };
const be = (y) => (y ? y + 543 : '');

// Edit dialog for one registration. mode 'admin' writes straight to the table (organizer/staff),
// mode 'player' goes through the token RPC (only while registration is open).
// r: { id, club, kind, tournament_id, p1_*, p2_* }
export function openRegEdit(dlg, r, { mode, token, onSaved }) {
  const dbl = r.kind === 'doubles';
  const files = {};
  const person = (n) => html`<div class="card stack"><h3>${n === 1 ? 'ผู้สมัคร' : 'คู่'}</h3>
    <label class="field"><span>ชื่อ-นามสกุล</span><input id="n${n}" value="${r['p' + n + '_name'] || ''}" maxlength="80"></label>
    <label class="field"><span>ชื่อเล่น (แสดงบนจอ)</span><input id="k${n}" value="${r['p' + n + '_nick'] || ''}" maxlength="40"></label>
    <label class="field"><span>เบอร์โทร</span><input id="h${n}" type="tel" value="${r['p' + n + '_phone'] || ''}" maxlength="20"></label>
    <label class="field"><span>ปีเกิด พ.ศ.</span><input id="y${n}" inputmode="numeric" maxlength="4" value="${be(r['p' + n + '_birth_year'])}"></label>
    <div class="row">${r['p' + n + '_photo'] ? raw(`<img id="pv${n}" class="av" style="width:56px;height:56px;margin:0" src="${esc(publicUrl('photos', r['p' + n + '_photo']))}" alt="">`) : raw(`<span id="pv${n}" class="muted small">ยังไม่มีรูป</span>`)}
      <label class="field" style="flex:1"><span>รูปนักกีฬา (บังคับ)</span><input data-file="${n}" type="file" accept="image/*"></label></div></div>`;
  mount(dlg, html`<form class="stack" id="ef" novalidate><h3>แก้ไขข้อมูลผู้สมัคร</h3>
    <label class="field"><span>ชื่อทีม / ก๊วน / สโมสร</span><input id="club" value="${r.club || ''}" maxlength="60"></label>
    ${person(1)}${dbl ? person(2) : ''}
    <div class="row"><button class="btn primary" type="submit" style="flex:1">บันทึก</button></div></form>`);
  $$('[data-file]', dlg).forEach((i) => (i.onchange = () => { files[i.dataset.file] = i.files[0] || null; }));
  dlg.showModal();
  $('#ef', dlg).onsubmit = (e) => {
    e.preventDefault();
    busy($('#ef button[type=submit]', dlg), async () => {
      const val = (id) => $('#' + id, dlg).value.trim();
      if (!val('n1') || !val('h1')) throw new Error('กรอกชื่อและเบอร์โทรของผู้สมัคร');
      if (dbl && !val('n2')) throw new Error('กรอกชื่อคู่');
      if (!files[1] && !r.p1_photo) throw new Error('ต้องใส่รูปนักกีฬา');
      if (dbl && !files[2] && !r.p2_photo) throw new Error('ต้องใส่รูปของคู่ด้วย');
      const up = async (n) => (files[n] ? uploadImage('photos', `${r.tournament_id}/${uuid()}`, files[n], 800, 0.8) : null);
      const ph1 = await up(1), ph2 = dbl ? await up(2) : null;
      const P = (n, ph) => ({ name: val('n' + n), nick: val('k' + n), phone: val('h' + n), birth_year: ce(val('y' + n)), photo: ph });
      if (mode === 'player') {
        const { error } = await sb.rpc('update_registration', { p_reg: r.id, p_token: token, p_club: val('club'), p_p1: P(1, ph1), p_p2: dbl ? P(2, ph2) : {} });
        if (error) throw error;
      } else {
        const row = { club: val('club') || null, p1_name: val('n1'), p1_nick: val('k1') || null, p1_phone: val('h1') || null, p1_birth_year: ce(val('y1')) };
        if (ph1) row.p1_photo = ph1;
        if (dbl) { Object.assign(row, { p2_name: val('n2'), p2_nick: val('k2') || null, p2_phone: val('h2') || null, p2_birth_year: ce(val('y2')) }); if (ph2) row.p2_photo = ph2; }
        const { error } = await sb.from('registrations').update(row).eq('id', r.id);
        if (error) throw error;
      }
      dlg.close(); toast('บันทึกการแก้ไขแล้ว'); if (onSaved) await onSaved();
    });
  };
}
