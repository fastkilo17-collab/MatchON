import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- safe templating: every interpolated value is escaped unless wrapped by raw()/html``
const RAW = Symbol('raw');
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v) => {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (typeof v === 'object' && v[RAW]) return v.s;
  return esc(v);
};
export const raw = (s) => ({ [RAW]: true, s });
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += fmt(vals[i]);
  });
  return raw(out);
}
export const mount = (el, tpl) => {
  el.innerHTML = tpl.s;
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---- small UI helpers
export function toast(msg, kind = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

export const errMsg = (e) => (e && (e.message || e.error_description)) || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';

export async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'กำลังทำงาน…';
  try {
    return await fn();
  } catch (e) {
    toast(errMsg(e), 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return `${x.getDate()} ${THAI_MONTHS[x.getMonth()]} ${x.getFullYear() + 543}`;
}
export function fmtRange(a, b) {
  if (!a) return '';
  if (!b || a === b) return fmtDate(a);
  const x = new Date(a + 'T00:00:00');
  const y = new Date(b + 'T00:00:00');
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) {
    return `${x.getDate()}–${y.getDate()} ${THAI_MONTHS[x.getMonth()]} ${x.getFullYear() + 543}`;
  }
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}
export function fmtTime(d) {
  if (!d) return '';
  const x = new Date(d);
  return x.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
export const baht = (n) => '฿' + Number(n).toLocaleString('th-TH');

export const STATUS_TH = { draft: 'ร่าง', open: 'รับสมัคร', closed: 'ปิดรับสมัคร', live: 'กำลังแข่ง', finished: 'จบรายการ' };
export const REG_STATUS_TH = { pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', waitlist: 'สำรอง', cancelled: 'ยกเลิก' };
export const PAY_TH = { unpaid: 'ยังไม่ชำระ', slip_sent: 'รอตรวจสลิป', paid: 'ชำระแล้ว', rejected: 'สลิปไม่ผ่าน' };

// ---- storage helpers
export const publicUrl = (bucket, path) => (path ? sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : '');

// Resize in the browser so a 5 MB phone photo becomes ~100-200 KB before upload.
export async function compressImage(file, maxSide, quality = 0.8) {
  if (!file.type.startsWith('image/')) throw new Error('เลือกไฟล์รูปภาพเท่านั้น');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  let type = 'image/webp';
  let blob = await new Promise((r) => canvas.toBlob(r, type, quality));
  if (!blob || blob.type !== 'image/webp') {
    type = 'image/jpeg';
    blob = await new Promise((r) => canvas.toBlob(r, type, quality));
  }
  return { blob, ext: type === 'image/webp' ? 'webp' : 'jpg', type };
}

export async function uploadImage(bucket, path, file, maxSide, quality) {
  const { blob, ext, type } = await compressImage(file, maxSide, quality);
  const full = `${path}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(full, blob, { contentType: type, upsert: false });
  if (error) throw error;
  return full;
}

// ---- names
export const teamName = (e) => {
  if (!e) return 'รอผลการแข่ง';
  const a = e.p1_nick || e.p1_name;
  const b = e.p2_name ? e.p2_nick || e.p2_name : '';
  return b ? `${a} / ${b}` : a;
};

export function scoreText(m) {
  const done = (m.sets || []).map(([a, b]) => `${a}-${b}`).join('  ');
  if (m.status === 'live') return `${done}${done ? '  ' : ''}${m.cur_a}-${m.cur_b}`;
  return done;
}

export const uuid = () => crypto.randomUUID();
export const go = (hash) => {
  location.hash = hash;
};
