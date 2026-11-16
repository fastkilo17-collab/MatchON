import { sb, curT, loadData, html, raw, mount, $, $$, toast, busy, esc, FORMAT_TH, canManage } from './core.js';
import { ruleText } from './matchops.js';

const PRESETS = [
  { name: 'แพ้คัดออก มาตรฐาน', best_of: 3, points: 21, deuce: true, cap: 30 },
  { name: 'รอบแบ่งกลุ่ม 1 เซต 30 แต้ม ไม่ดิว', best_of: 1, points: 30, deuce: false, cap: 30 },
  { name: '1 เซต 21 แต้ม', best_of: 1, points: 21, deuce: true, cap: 30 },
  { name: '2 ใน 3 เซต 15 แต้ม', best_of: 3, points: 15, deuce: true, cap: 21 },
];
const hasKO = (f) => f === 'knockout' || f === 'group_knockout';
const hasGroup = (f) => f !== 'knockout';

export async function rulesPage(root) {
  const t = curT();
  if (!t) return mount(root, html`<div class="card empty">ยังไม่มีรายการแข่งขัน</div>`);
  if (!canManage()) return mount(root, html`<div class="card empty">เฉพาะผู้จัดและสตาฟฟ์</div>`);
  let D = await loadData(t.id);
  const reload = async () => { D = await loadData(t.id); draw(); };
  const opt = (sel, c) => `<option value="">ค่าเริ่มต้นของรุ่น (${esc(ruleText({ best_of: c.best_of || 3, points: c.points || 21, deuce: true, cap: c.cap || 30 }))})</option>`
    + D.rules.map((r) => `<option value="${r.id}" ${sel === r.id ? 'selected' : ''}>${esc(r.name)} — ${esc(ruleText(r))}</option>`).join('');

  const draw = () => {
    mount(root, html`
      <div class="row between"><h2>กติกาการแข่งขัน · ${t.name}</h2>
        <div class="row"><button class="btn sm" id="pre">ใส่กติกามาตรฐาน</button><button class="btn sm primary" id="add">＋ เพิ่มกติกา</button></div></div>
      <div class="card"><h3>ชุดกติกา (${D.rules.length})</h3>
        ${D.rules.length ? D.rules.map((r) => html`<div class="li"><b class="grow">${r.name}</b><span class="muted">${ruleText(r)}</span>
          <button class="btn sm" data-e="${r.id}">แก้ไข</button><button class="btn sm danger" data-d="${r.id}">ลบ</button></div>`)
          : html`<div class="empty small">ยังไม่มีชุดกติกา กด "ใส่กติกามาตรฐาน" หรือ "เพิ่มกติกา"</div>`}</div>
      <div class="card"><h3>กำหนดกติกาแต่ละรุ่น</h3>
        <p class="muted small">รอบแบ่งกลุ่ม / พบกันหมด / Swiss ใช้ "กติการอบกลุ่ม" · รอบแพ้คัดออกและรอบไขว้สายใช้ "กติกาน็อกเอาท์" ระบบใช้กติกานี้ตรวจและคำนวณเซตเมื่อกรอกคะแนนอัตโนมัติ</p>
        <div class="li head"><span class="grow">รุ่น</span><span class="w2">กติการอบกลุ่ม</span><span class="w2">กติกาน็อกเอาท์</span></div>
        ${D.cats.map((c) => { const b = D.brackets.find((x) => x.category_id === c.id); const f = (b && b.format) || c.format;
          return html`<div class="li"><span class="grow"><b>${c.name}</b> <span class="pill gray">${FORMAT_TH[f]}</span></span>
            <select class="w2" data-g="${c.id}" ${hasGroup(f) ? '' : raw('disabled')}>${raw(opt(c.rule_group, c))}</select>
            <select class="w2" data-k="${c.id}" ${hasKO(f) ? '' : raw('disabled')}>${raw(opt(c.rule_ko, c))}</select></div>`; })}
        <div class="li"><b class="grow">ใช้กับทุกรุ่น</b>
          <select class="w2" id="allg"><option value="">- เลือกกติการอบกลุ่ม -</option>${D.rules.map((r) => raw(`<option value="${r.id}">${esc(r.name)}</option>`))}</select>
          <select class="w2" id="allk"><option value="">- เลือกกติกาน็อกเอาท์ -</option>${D.rules.map((r) => raw(`<option value="${r.id}">${esc(r.name)}</option>`))}</select>
          <button class="btn sm" id="applyall">ใช้ทุกรุ่น</button></div></div>
      <dialog id="rd"></dialog>`);
    bind();
  };

  const edit = (r) => {
    const dlg = $('#rd', root), v = r || { name: '', best_of: 3, points: 21, deuce: true, cap: 30 };
    mount(dlg, html`<form class="stack" id="rf" novalidate><h3>${r ? 'แก้ไขกติกา' : 'เพิ่มกติกา'}</h3>
      <label class="field"><span>ชื่อกติกา</span><input id="rn" maxlength="60" value="${v.name}" placeholder="เช่น แพ้คัดออก 2 ใน 3 เซต"></label>
      <div class="grid g2"><label class="field"><span>จำนวนเซต</span><select id="rb">${[1, 3, 5].map((n) => raw(`<option value="${n}" ${v.best_of === n ? 'selected' : ''}>${n === 1 ? '1 เซต' : `ชนะ ${(n + 1) / 2} ใน ${n} เซต`}</option>`))}</select></label>
        <label class="field"><span>แต้มต่อเซต</span><input id="rp" type="number" min="5" max="50" value="${v.points}"></label></div>
      <label class="check"><input id="rdz" type="checkbox" ${v.deuce ? 'checked' : ''}><span>มีดิว (ต้องชนะห่าง 2 แต้ม)</span></label>
      <label class="field" id="rcw"><span>แต้มสูงสุดเมื่อดิว (เพดาน)</span><input id="rc" type="number" min="6" max="99" value="${v.cap}"></label>
      <button class="btn primary" type="submit">บันทึก</button></form>`);
    const sync = () => { $('#rcw', dlg).hidden = !$('#rdz', dlg).checked; };
    $('#rdz', dlg).onchange = sync; sync();
    dlg.showModal();
    $('#rf', dlg).onsubmit = (e) => {
      e.preventDefault();
      busy($('#rf button[type=submit]', dlg), async () => {
        const row = { tournament_id: t.id, name: $('#rn', dlg).value.trim(), best_of: Number($('#rb', dlg).value), points: Number($('#rp', dlg).value), deuce: $('#rdz', dlg).checked, cap: Number($('#rc', dlg).value) };
        if (!row.name) throw new Error('ตั้งชื่อกติกา');
        if (!(row.points >= 5)) throw new Error('แต้มต่อเซตไม่ถูกต้อง');
        if (row.deuce && row.cap <= row.points) throw new Error('เพดานต้องมากกว่าแต้มต่อเซต');
        if (!row.deuce) row.cap = row.points;
        const q = r ? sb.from('tournament_rules').update(row).eq('id', r.id) : sb.from('tournament_rules').insert(row);
        const { error } = await q; if (error) throw error;
        dlg.close(); toast('บันทึกกติกาแล้ว'); await reload();
      });
    };
  };

  const setCat = async (id, patch) => {
    const { error } = await sb.from('categories').update(patch).eq('id', id);
    if (error) throw error;
    Object.assign(D.C[id], patch);
  };

  const bind = () => {
    $('#add', root).onclick = () => edit(null);
    $('#pre', root).onclick = () => busy($('#pre', root), async () => {
      const have = new Set(D.rules.map((r) => r.name));
      const rows = PRESETS.filter((p) => !have.has(p.name)).map((p) => ({ ...p, tournament_id: t.id, cap: p.deuce ? p.cap : p.points }));
      if (!rows.length) return toast('มีกติกามาตรฐานครบแล้ว');
      const { error } = await sb.from('tournament_rules').insert(rows); if (error) throw error;
      toast(`เพิ่ม ${rows.length} กติกา`); await reload();
    });
    $$('[data-e]', root).forEach((b) => (b.onclick = () => edit(D.R[b.dataset.e])));
    $$('[data-d]', root).forEach((b) => (b.onclick = () => busy(b, async () => {
      if (!window.confirm('ลบกติกานี้? รุ่นที่ใช้อยู่จะกลับไปใช้ค่าเริ่มต้นของรุ่น')) return;
      const { error } = await sb.from('tournament_rules').delete().eq('id', b.dataset.d); if (error) throw error;
      await reload();
    })));
    $$('[data-g]', root).forEach((s) => (s.onchange = async () => { try { await setCat(s.dataset.g, { rule_group: s.value || null }); toast('บันทึกแล้ว'); } catch (e) { toast(e.message, 'err'); } }));
    $$('[data-k]', root).forEach((s) => (s.onchange = async () => { try { await setCat(s.dataset.k, { rule_ko: s.value || null }); toast('บันทึกแล้ว'); } catch (e) { toast(e.message, 'err'); } }));
    $('#applyall', root).onclick = () => busy($('#applyall', root), async () => {
      const g = $('#allg', root).value, k = $('#allk', root).value;
      if (!g && !k) throw new Error('เลือกกติกาก่อน');
      for (const c of D.cats) { const p = {}; if (g) p.rule_group = g; if (k) p.rule_ko = k; await setCat(c.id, p); }
      toast('ใช้กับทุกรุ่นแล้ว'); draw();
    });
  };
  draw();
}
