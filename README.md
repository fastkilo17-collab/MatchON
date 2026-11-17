# MatchON

ระบบจัดการแข่งขันแบดมินตัน (React 19 + Vite + Tailwind 4 + TypeScript) เชื่อมฐานข้อมูล Supabase

- เว็บ: https://fastkilo17-collab.github.io/MatchON/
- ข้อมูล: Supabase (ตาราง/RLS/RPC ใน `supabase/migrations` 001–009)
- ล็อกอิน: อีเมล/รหัสผ่าน และ LINE (custom OIDC `custom:line`); นักกีฬาสมัครได้โดยไม่ต้องล็อกอิน (ใช้ edit token ในเบราว์เซอร์)
- `public/` เก็บหน้าเดิม: `referee.html`, `courts.html`, `js/`, `v1/` (Firebase live)

## โครงสร้าง
- `src/lib/supabase.ts` client + อัปโหลดรูป
- `src/lib/db.ts` โหลดข้อมูล, แปลงฟิลด์, sync แบบ diff (เฉพาะผู้จัด/staff), RPC สมัคร/แก้ไข/สลิป
- `src/context/MatchONContext.tsx` state ทั้งแอป (โหลดจาก DB, บันทึกอัตโนมัติ, โพลทุก 20 วิ)
- `src/pages`, `src/components` หน้าจอ

## รัน / Deploy
```
npm install
npm run dev
npm run build
```
Deploy ผ่าน GitHub Actions (`.github/workflows/pages.yml`) — ตั้ง Settings → Pages → Source: GitHub Actions
