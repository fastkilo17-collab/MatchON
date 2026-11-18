import { sb } from './supabase';

// LIFF ID ของ LIFF app ที่สร้างใน LINE Login channel 2012624545 (ตั้ง Endpoint URL = เว็บนี้)
export const LIFF_ID: string = (import.meta.env.VITE_LIFF_ID as string) || '';
const FLAG = 'matchon.lineLogin';

function loadSdk(): Promise<any> {
  const w = window as any;
  if (w.liff) return Promise.resolve(w.liff);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload = () => res(w.liff);
    s.onerror = () => rej(new Error('โหลด LINE SDK ไม่สำเร็จ'));
    document.head.appendChild(s);
  });
}

/** เริ่มล็อกอิน LINE (LINE ออก ID token แบบ ES256 ผ่าน LIFF แล้วแลกเป็น session ผ่าน edge function line-login) */
export async function startLineLogin() {
  if (!LIFF_ID) throw new Error('ยังไม่ได้ตั้งค่า LIFF ID (VITE_LIFF_ID)');
  const liff = await loadSdk();
  await liff.init({ liffId: LIFF_ID });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.origin + import.meta.env.BASE_URL });
    return false;
  }
  return finishLineLogin(true);
}

/** เรียกตอนเปิดแอป: ถ้าเพิ่งกลับมาจากหน้า LINE ให้แลก token เป็น session */
export async function finishLineLogin(force = false): Promise<boolean> {
  let flagged = false;
  try { flagged = localStorage.getItem(FLAG) === '1'; } catch { /* ignore */ }
  if (!force && (!flagged || !LIFF_ID)) return false;
  try {
    const liff = await loadSdk();
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) return false;
    const idToken = liff.getIDToken();
    if (!idToken) throw new Error('ไม่ได้รับ ID token จาก LINE (ตรวจ scope openid, profile ของ LIFF)');
    const { data, error } = await sb.functions.invoke('line-login', { body: { id_token: idToken } });
    if (error) throw error;
    if (!data?.token_hash) throw new Error(data?.error || 'ล็อกอินไม่สำเร็จ');
    const { error: e2 } = await sb.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (e2) throw e2;
    try { localStorage.removeItem(FLAG); } catch { /* ignore */ }
    return true;
  } catch (e) {
    try { localStorage.removeItem(FLAG); } catch { /* ignore */ }
    throw e;
  }
}
