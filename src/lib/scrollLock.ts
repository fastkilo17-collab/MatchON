import { useEffect } from 'react';

let locks = 0;
let saved = { html: '', body: '', pad: '' };

/** ล็อกการเลื่อนหน้าด้านหลังตอนมี popup เปิด (นับซ้อนได้หลายชั้น) */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement, body = document.body;
    if (locks === 0) {
      saved = { html: html.style.overflow, body: body.style.overflow, pad: body.style.paddingRight };
      const sw = window.innerWidth - html.clientWidth;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      if (sw > 0) body.style.paddingRight = `${sw}px`;
    }
    locks++;
    return () => {
      locks--;
      if (locks === 0) { html.style.overflow = saved.html; body.style.overflow = saved.body; body.style.paddingRight = saved.pad; }
    };
  }, [active]);
}

/** วางไว้ในเนื้อหา popup: ล็อกการเลื่อนหน้าหลังตลอดที่ popup แสดงอยู่ */
export function ScrollLock() {
  useScrollLock(true);
  return null;
}
