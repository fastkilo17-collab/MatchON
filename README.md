# MatchON

ระบบจัดการแข่งขันแบดมินตัน (React 19 + Vite + Tailwind 4 + TypeScript) เชื่อมฐานข้อมูล Supabase

- เว็บ: https://fastkilo17-collab.github.io/MatchON/
- ข้อมูล: Supabase (ตาราง/RLS/RPC ใน `supabase/migrations` 001–010)
- ล็อกอิน: นักกีฬาต้องล็อกอิน LINE (custom OIDC `custom:line`) ก่อนสมัคร ผู้จัด/staff ใช้ LINE หรืออีเมล; รูปโปรไฟล์ดึงจาก LINE
- Live: `public/referee.html` (หน้ากรรมการ) เชื่อม Firebase ผ่าน `src/lib/liveBridge.ts`; QR กรรมการอยู่ในหน้า Live Score
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

### migration 011–012
- 011: สถานะใบสมัคร `rejected`, `registrations.note`, ข้อมูลรายการ (poster/format_text/rules_text/notice)
- 012: ผู้ดูแลระบบ (`super_admin`) อนุมัติคำขอเป็นผู้จัด (`organizer_requests`, RPC request_organizer / list_organizer_requests / decide_organizer_request); ลบ `become_organizer`
- 014: `categories.prizes` (เงินรางวัลสายบน/ล่าง), `brackets.has_lower`, stage `lower` ใน matches
- 015: `tournaments.posters jsonb` (โปสเตอร์หลายรูป แสดงเป็นสไลด์)
- 013: `categories.shuttle_fee/shuttle_qty` (ค่าลูกแบด รวมในยอดชำระ), `win_pts/draw_pts/loss_pts` ในชุดกติกา/รุ่น, อัปเดต my_registration และ admin_add_registration
- LINE login ใช้ LIFF (`VITE_LIFF_ID`) + edge function `line-login`
