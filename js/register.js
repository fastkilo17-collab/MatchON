import {
  sb, html, mount, $, raw, toast, errMsg, busy, baht, fmtDate, uuid, go, uploadImage,
  PAY_TH, REG_STATUS_TH,
} from './lib.js';
import { promptPayPayload } from './promptpay.js';

const SAVED_KEY = 'courtday.registrations';
const saveLocal = (rec) => {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    all.unshift(rec);
    localStorage.setItem(SAVED_KEY, JSON.stringify(all.slice(0, 20)));
  } catch { /* storage may be blocked; the status link still works */ }
};

// ------------------------------------------------------------------ registration form
export async function registerPage(root, slug) {
  mount(root, html`<section class="wrap narrow"><div class="skeleton">กำลังโหลด…</div></section>`);
  const { data: t } = await sb.from('tournaments').select('*').eq('slug', slug).maybeSingle();
  if (!t) return mount(root, html`<section class="wrap narrow"><p class="err">ไม่พบรายการนี้</p></section>`);
  const open = t.status === 'open' && (!t.reg_deadline || new Date(t.reg_deadline) > new Date());
  if (!open) {
    return mount(root, html`<section class="wrap narrow"><a class="back" href="#/t/${slug}">← กลับ</a>
      <h1>${t.name}</h1><p class="err">ปิดรับสมัครแล้ว</p></section>`);
  }
  const { data: cats } = await sb.from('categories').select('*').eq('tournament_id', t.id).order('sort').order('name');
  const { data: entries } = await sb.rpc('public_entries', { p_tournament: t.id });
  const counts = {};
  (entries || []).forEach((e) => {
    if (e.status === 'pending' || e.status === 'confirmed') counts[e.category_id] = (counts[e.category_id] || 0) + 1;
  });
  if (!cats || !cats.length) {
    return mount(root, html`<section class="wrap narrow"><p class="muted">ผู้จัดยังไม่ได้เปิดประเภทให้สมัคร</p></section>`);
  }

  const person = (n, label, required) => html`
    <fieldset class="card person">
      <legend>${label}</legend>
      <label class="field"><span>ชื่อ-นามสกุล</span><input id="p${n}-name" autocomplete="name" ${required ? raw('required') : ''} maxlength="80"></label>
      <label class="field"><span>ชื่อเล่น (แสดงบนจอ ถ้าไม่ใส่จะใช้ชื่อจริง)</span><input id="p${n}-nick" maxlength="40"></label>
      <label class="field"><span>เบอร์โทร${n === 1 ? '' : ' (ไม่บังคับ)'}</span><input id="p${n}-phone" type="tel" inputmode="tel" maxlength="20" ${n === 1 ? raw('required') : ''}></label>
      <label class="field"><span>ปีเกิด พ.ศ. (ไม่บังคับ ใช้จัดรุ่นอายุ)</span><input id="p${n}-year" inputmode="numeric" maxlength="4" placeholder="2538"></label>
      <label class="field"><span>รูปนักกีฬา (ไม่บังคับ)</span><input id="p${n}-photo" type="file" accept="image/*"></label>
    </fieldset>`;

  mount(
    root,
    html`<section class="wrap narrow">
      <a class="back" href="#/t/${slug}">← ${t.name}</a>
      <h1>สมัครแข่งขัน</h1>
      <form id="reg-form" class="stack" novalidate>
        <label class="field"><span>ประเภทที่สมัคร</span>
          <select id="cat">${cats.map((c) => {
            const full = (counts[c.id] || 0) >= c.max_teams;
            return html`<option value="${c.id}" data-kind="${c.kind}" data-fee="${c.fee}">${c.name} · ${c.fee ? baht(c.fee) : 'ฟรี'}${full ? ' (เต็ม ลงสำรองได้)' : ''}</option>`;
          })}</select></label>
        ${person(1, 'ข้อมูลนักกีฬา', true)}
        <div id="p2-box">${person(2, 'ข้อมูลคู่ของคุณ', false)}</div>
        <label class="field"><span>ลิงก์วิดีโอการเล่น (ไม่บังคับ)</span>
          <input id="video" type="url" inputmode="url" placeholder="https://youtube.com/…" maxlength="300">
          <small class="muted">ใส่หรือไม่ใส่ก็ได้ ช่วยให้ผู้จัดจัดรุ่นได้ตรงระดับ</small></label>
        <label class="check"><input id="consent" type="checkbox"> <span>ยินยอมให้ผู้จัดเก็บข้อมูลและแสดงชื่อ รูป และผลการแข่งขันของฉันบนหน้ารายการ</span></label>
        <button class="btn primary big" type="submit">ส่งใบสมัคร</button>
      </form>
    </section>`
  );

  const cat = $('#cat', root);
  const toggle = () => {
    const doubles = cat.selectedOptions[0].dataset.kind === 'doubles';
    $('#p2-box', root).hidden = !doubles;
  };
  cat.addEventListener('change', toggle);
  toggle();

  $('#reg-form', root).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('button[type=submit]', root);
    const doubles = cat.selectedOptions[0].dataset.kind === 'doubles';
    const v = (id) => $(id, root).value.trim();
    if (!v('#p1-name') || !v('#p1-phone')) return toast('กรอกชื่อและเบอร์โทร', 'err');
    if (doubles && !v('#p2-name')) return toast('กรอกชื่อคู่ของคุณ', 'err');
    if (v('#video') && !/^https?:\/\//i.test(v('#video'))) return toast('ลิงก์วิดีโอต้องขึ้นต้นด้วย http หรือ https', 'err');
    if (!$('#consent', root).checked) return toast('กรุณาติ๊กยินยอมการเก็บข้อมูล', 'err');

    await busy(btn, async () => {
      const photo = async (n) => {
        const f = $(`#p${n}-photo`, root).files[0];
        return f ? uploadImage('photos', `${t.id}/${uuid()}`, f, 800, 0.8) : null;
      };
      // The form asks for a Buddhist-era year (พ.ศ.); the database stores the Gregorian year (ค.ศ.).
      const year = (n) => {
        const raw = v(`#p${n}-year`);
        if (!raw) return null;
        const y = Number(raw);
        const ce = y > 2400 ? y - 543 : y;
        if (!Number.isInteger(ce) || ce < 1930 || ce > 2030) throw new Error('ปีเกิดไม่ถูกต้อง กรอกเป็น พ.ศ. 4 หลัก เช่น 2538');
        return ce;
      };
      const body = (n) => ({
        name: v(`#p${n}-name`),
        nick: v(`#p${n}-nick`),
        phone: v(`#p${n}-phone`),
        birth_year: year(n),
      });
      const p1 = { ...body(1), photo: await photo(1) };
      const p2 = doubles ? { ...body(2), photo: await photo(2) } : {};
      const { data, error } = await sb.rpc('register_team', {
        p_tournament: t.id,
        p_category: cat.value,
        p_p1: p1,
        p_p2: p2,
        p_video: v('#video') || null,
      });
      if (error) throw error;
      saveLocal({ id: data.id, token: data.token, tournament: t.name, at: new Date().toISOString() });
      go(`#/status/${data.id}/${data.token}`);
    });
  });
}

// ------------------------------------------------------------------ status + payment
export async function statusPage(root, regId, token) {
  mount(root, html`<section class="wrap narrow"><div class="skeleton">กำลังโหลด…</div></section>`);
  const draw = async () => {
    const { data: r, error } = await sb.rpc('my_registration', { p_reg: regId, p_token: token });
    if (error || !r) {
      return mount(root, html`<section class="wrap narrow"><p class="err">ไม่พบรายการสมัคร ตรวจลิงก์อีกครั้ง</p></section>`);
    }
    const needsPay = r.fee > 0 && (r.status === 'pending' || r.status === 'confirmed') && r.pay_status !== 'paid';
    const canPay = needsPay && r.promptpay_id;
    const doneMsg =
      r.status === 'confirmed' && r.pay_status === 'paid'
        ? 'ยืนยันการสมัครเรียบร้อย พบกันวันแข่ง'
        : r.status === 'confirmed' && r.fee === 0
        ? 'ยืนยันการสมัครเรียบร้อย พบกันวันแข่ง'
        : '';

    mount(
      root,
      html`<section class="wrap narrow">
        <a class="back" href="#/t/${r.tournament_slug}">← ${r.tournament_name}</a>
        <h1>สถานะการสมัคร</h1>
        <div class="card">
          <p class="muted">${r.category}</p>
          <h2>${r.p1_name}${r.p2_name ? ' / ' + r.p2_name : ''}</h2>
          <p><span class="pill rs-${r.status}">${REG_STATUS_TH[r.status]}</span>
             <span class="pill pay-${r.pay_status}">${PAY_TH[r.pay_status]}</span></p>
          ${doneMsg ? html`<p class="ok">${doneMsg}</p>` : ''}
          ${r.status === 'waitlist' ? html`<p>ประเภทนี้เต็มแล้ว คุณอยู่ในรายชื่อสำรอง ผู้จัดจะแจ้งให้ชำระเงินเมื่อมีที่ว่าง</p>` : ''}
          ${r.status === 'cancelled' ? html`<p class="err">รายการนี้ถูกยกเลิก</p>` : ''}
        </div>
        ${needsPay ? payCard(r, canPay) : ''}
        <p class="muted small">เก็บลิงก์หน้านี้ไว้ดูสถานะภายหลัง ใครมีลิงก์ก็เปิดดูได้</p>
      </section>`
    );

    const form = $('#slip-form', root);
    if (form)
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = $('#slip', root).files[0];
        if (!f) return toast('เลือกรูปสลิปก่อน', 'err');
        await busy($('button', form), async () => {
          const path = await uploadImage('slips', `${r.tournament_id}/${r.id}/${Date.now()}`, f, 1200, 0.75);
          const { error: e2 } = await sb.rpc('submit_slip', { p_reg: r.id, p_token: token, p_path: path });
          if (e2) throw e2;
          toast('ส่งสลิปแล้ว รอผู้จัดตรวจสอบ');
          await draw();
        });
      });

    if (canPay) {
      try {
        const { default: QR } = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm');
        const url = await QR.toDataURL(promptPayPayload(r.promptpay_id, r.fee), { margin: 1, width: 260 });
        const img = $('#qr', root);
        if (img) img.src = url;
      } catch (e) {
        const box = $('#qr-box', root);
        if (box) box.textContent = 'สร้าง QR ไม่สำเร็จ โอนเข้า PromptPay ' + r.promptpay_id + ' ยอด ' + baht(r.fee);
      }
    }
  };
  await draw();
}

function payCard(r, canPay) {
  if (!canPay) {
    return html`<div class="card"><h2>ชำระค่าสมัคร ${baht(r.fee)}</h2>
      <p class="muted">ผู้จัดยังไม่ได้ตั้งบัญชีรับเงิน ติดต่อผู้จัดโดยตรง</p></div>`;
  }
  const waiting = r.pay_status === 'slip_sent';
  return html`<div class="card center">
    <h2>ชำระค่าสมัคร ${baht(r.fee)}</h2>
    <div id="qr-box"><img id="qr" alt="QR PromptPay ยอด ${baht(r.fee)}" width="260" height="260"></div>
    <p class="muted">สแกนด้วยแอปธนาคาร ยอดตรงกับค่าสมัครอัตโนมัติ</p>
    ${r.pay_status === 'rejected' ? html`<p class="err">สลิปไม่ผ่านการตรวจ กรุณาส่งใหม่</p>` : ''}
    ${waiting ? html`<p class="ok">ส่งสลิปแล้ว รอผู้จัดตรวจสอบ ส่งใหม่ได้ถ้าส่งผิด</p>` : ''}
    <form id="slip-form" class="stack">
      <label class="field"><span>แนบรูปสลิป</span><input id="slip" type="file" accept="image/*"></label>
      <button class="btn primary" type="submit">ส่งสลิป</button>
    </form>
  </div>`;
}
