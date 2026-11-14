# MatchON

ระบบจัดแข่งแบดมินตัน: สมัคร ประเมินมือ ตรวจสลิป สายแข่ง และคอร์ตสด

- `index.html` — เว็บแอปใหม่ (หน้าเดียว Tailwind + JS ข้อมูลเก็บในเครื่องผ่าน localStorage ก่อน)
- `v1/` — เวอร์ชันก่อนหน้าที่ต่อ Supabase แล้ว (สมัคร/จ่ายเงิน/ให้คะแนน) เปิดที่ `/v1/`
- `supabase/` — สคีมาฐานข้อมูลของ v1

## คะแนนสด (Firebase Realtime Database)
- `js/live.js` ซิงก์คอร์ตและผลแมตช์ผ่าน Firebase โปรเจกต์ `matchon-c5217`
- `database.rules.json` กฎความปลอดภัย: ทุกคนอ่านคะแนนสดได้ แต่เขียนได้เฉพาะเครื่องที่มีรหัสกรรมการ (รหัสแยกรายคอร์ต อยู่ใน QR ส่วนหลัง `#k=`)
- ต้องเปิด Authentication → Sign-in method → **Anonymous** และวางกฎใน Realtime Database → Rules
