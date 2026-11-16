# MatchON

ระบบจัดแข่งแบดมินตัน: สมัคร ประเมินมือ ตรวจสลิป สายแข่ง และคอร์ตสด

- `index.html` + `app/` — เว็บแอปหลักใหม่ (ระบบจัดการแข่งขันครบวงจร ต่อ Supabase จริง): Dashboard, รายการแข่งขัน/รุ่น, สมัครแข่ง+สลิป, จัดการนักกีฬา, จัดสาย (Knockout/Round Robin/Group/Group+KO/Swiss), ตารางแข่ง+สนาม, ผลการแข่งขัน, รายงาน (CSV/พิมพ์ PDF), ตั้งค่า. บทบาท: super_admin / organizer / staff / referee / player / ผู้ชม
- `courts.html` — คอร์ตสด (Firebase) เดิม ไม่เปลี่ยน; `referee.html` — หน้ากรรมการ
- `v1/` — เวอร์ชันก่อนหน้าที่ต่อ Supabase แล้ว (สมัคร/จ่ายเงิน/ให้คะแนน) เปิดที่ `/v1/`
- `supabase/` — สคีมาฐานข้อมูลของ v1

## คะแนนสด (Firebase Realtime Database)
- `js/live.js` ซิงก์คอร์ตและผลแมตช์ผ่าน Firebase โปรเจกต์ `matchon-c5217`
- `database.rules.json` กฎความปลอดภัย: ทุกคนอ่านคะแนนสดได้ แต่เขียนได้เฉพาะเครื่องที่มีรหัสกรรมการ (รหัสแยกรายคอร์ต อยู่ใน QR ส่วนหลัง `#k=`)
- ต้องเปิด Authentication → Sign-in method → **Anonymous** และวางกฎใน Realtime Database → Rules

## ฐานข้อมูลแอปหลัก (Supabase `atjxzczutrenphivihyd`)
ใช้ตารางเดิมของ v1 และเพิ่มส่วนที่ขาดผ่าน migration `002` – `006_live_staff_adminreg` (006: tournaments.live_id, tournament_live, ensure_live, admin_add_registration, list/add/remove_staff) (profiles.role, `become_organizer`, `can_manage()`, referees, payments, notifications, category_templates และ RPC `register_team`, `my_registration`, `submit_slip`, `update_partner`, `my_notifications`, `public_entries`)
การจับคู่ชื่อตารางกับสเปก: teams=registrations, match_entries=matches.reg_a/reg_b, match_schedules=matches.court/scheduled_at, match_scores=matches.sets/cur_a/cur_b, score_events=match_events
