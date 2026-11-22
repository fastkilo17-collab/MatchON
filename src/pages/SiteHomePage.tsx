import React from 'react';
import { ArrowRight, CalendarDays, MapPin, Radio, Trophy, Users, QrCode, Network, ClipboardList, Search } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { fmtRange, STATUS_TH, isByeMatch } from '../utils/bracket';
import type { Tournament } from '../types/matchon';

const FEATURES: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; desc: string }> = [
  { icon: Network, title: 'จัดสายอัตโนมัติ', desc: 'แบ่งกลุ่ม น็อคเอาท์ สายบน-สายล่าง พร้อมตัวเลือกจับสายแบบเลี่ยงทีมเดียวกัน' },
  { icon: CalendarDays, title: 'ตารางแข่งและเรียกสนาม', desc: 'จัดเวลา พักผู้เล่น และเรียกทีมลงสนามตามคิวแบบเรียลไทม์' },
  { icon: Radio, title: 'คะแนนสดบนทุกหน้าจอ', desc: 'กรรมการนับคะแนนผ่าน QR แล้วบอร์ดและมือถือผู้ชมอัปเดตทันที' },
  { icon: QrCode, title: 'สมัครและชำระผ่านมือถือ', desc: 'สมัครรุ่น ชำระ PromptPay และตรวจสถานะการสมัครได้ในที่เดียว' },
];

const STEPS = [
  { n: 1, t: 'เลือกรายการ', d: 'ค้นหารายการแข่งขันที่เปิดรับสมัคร' },
  { n: 2, t: 'สมัครและชำระ', d: 'กรอกข้อมูลทีม ชำระเงิน รอยืนยัน' },
  { n: 3, t: 'ติดตามผลสด', d: 'ดูสาย ตารางแข่ง และคะแนนสดทุกสนาม' },
];

export function SiteHomePage() {
  const { state, navigate, setActiveTid } = useMatchON();
  const ts = state.tournaments;
  const regs = state.registrations.filter((r) => r.status !== 'cancelled' && r.status !== 'rejected');
  const matches = state.matches.filter((m) => !isByeMatch(m));
  const liveNow = matches.filter((m) => m.status === 'live').length;
  const rank = (t: Tournament) => (t.status === 'live' ? 0 : t.status === 'open' ? 1 : t.status === 'closed' ? 2 : 3);
  const featured = [...ts].filter((t) => t.status !== 'draft').sort((a, b) => rank(a) - rank(b)).slice(0, 3);

  const openT = (t: Tournament) => {
    setActiveTid(t.id);
    navigate('home');
  };

  const stats: Array<[string, number, string]> = [
    ['รายการแข่งขัน', ts.length, 'text-blue-700'],
    ['ทีมที่สมัคร', regs.length, 'text-slate-900'],
    ['แมตช์ทั้งหมด', matches.length, 'text-slate-900'],
    ['กำลังแข่งตอนนี้', liveNow, 'text-red-600'],
  ];

  return (
    <div className="space-y-10 pb-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 text-white px-6 py-10 sm:px-12 sm:py-16">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-16 -bottom-24 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Trophy className="w-3.5 h-3.5" /> แพลตฟอร์มแข่งขันแบดมินตัน
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            จัดแข่ง สมัคร และดูคะแนนสด<br className="hidden sm:block" />จบในที่เดียว
          </h2>
          <p className="text-sm sm:text-base text-white/80 leading-relaxed">
            ตั้งแต่เปิดรับสมัคร จัดสาย จัดตารางแข่ง ไปจนถึงกรรมการนับคะแนนผ่านมือถือ — ใช้งานง่ายสำหรับทั้งผู้จัด นักกีฬา และผู้ชม
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button type="button" onClick={() => navigate('tournaments')} className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl bg-white text-blue-800 font-bold text-sm hover:bg-blue-50 transition-colors">
              <Search className="w-4 h-4" /> ดูรายการแข่งขัน
            </button>
            <button type="button" onClick={() => navigate('live')} className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl bg-white/15 text-white font-bold text-sm hover:bg-white/25 transition-colors">
              <Radio className="w-4 h-4" /> ดูคะแนนสด{liveNow > 0 ? ` (${liveNow})` : ''}
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(([l, v, c]) => (
          <div key={l} className="rounded-2xl bg-white border border-slate-200/80 px-4 py-4 text-center">
            <div className={`font-display text-3xl font-extrabold tabular-nums ${c}`}>{v}</div>
            <div className="text-xs text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </section>

      {/* Featured tournaments */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900">รายการแข่งขันแนะนำ</h3>
            <p className="text-xs text-slate-500 mt-0.5">รายการที่กำลังแข่งและเปิดรับสมัคร</p>
          </div>
          <button type="button" onClick={() => navigate('tournaments')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 min-h-[40px]">
            ดูทั้งหมด <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {featured.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featured.map((t) => {
              const img = t.posters?.[0] || t.poster;
              return (
                <button key={t.id} type="button" onClick={() => openT(t)} className="text-left rounded-2xl bg-white border border-slate-200/80 overflow-hidden hover:border-blue-300 transition-colors flex flex-col">
                  <div className="relative h-36 bg-gradient-to-br from-blue-600 to-blue-800">
                    {img && <img src={img} alt={t.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                    <span className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold ${t.status === 'live' ? 'bg-red-600 text-white' : t.status === 'open' ? 'bg-emerald-500 text-white' : 'bg-white/90 text-slate-700'}`}>
                      {STATUS_TH[t.status]}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="font-display font-bold text-slate-900 leading-snug">{t.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600"><CalendarDays className="w-3.5 h-3.5 text-slate-400" />{fmtRange(t.start_date, t.end_date)}</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{t.venue || 'ไม่ระบุสถานที่'}</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200/80 p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>
        )}
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h3 className="font-display text-xl font-bold text-slate-900">ทำอะไรได้บ้าง</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-2.5">
              <span className="w-10 h-10 grid place-items-center rounded-xl bg-blue-50 text-blue-700"><f.icon className="w-5 h-5" /></span>
              <div className="font-bold text-slate-900 text-sm">{f.title}</div>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="space-y-4">
        <h3 className="font-display text-xl font-bold text-slate-900">เริ่มต้นใน 3 ขั้นตอน</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-start gap-3 rounded-2xl bg-white border border-slate-200/80 p-4">
              <span className="w-9 h-9 shrink-0 grid place-items-center rounded-full bg-blue-600 text-white font-bold tabular-nums">{s.n}</span>
              <div>
                <div className="font-bold text-sm text-slate-900">{s.t}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA / footer */}
      <section className="rounded-3xl bg-slate-900 text-white px-6 py-8 sm:px-10 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-display text-xl font-bold">พร้อมลงสนามแล้วหรือยัง</div>
          <div className="text-xs text-white/70">สมัครแข่ง หรือสร้างรายการของคุณเอง</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => navigate('register')} className="inline-flex items-center gap-2 min-h-[46px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm">
            <ClipboardList className="w-4 h-4" /> สมัครแข่ง
          </button>
          <button type="button" onClick={() => navigate('tournaments')} className="inline-flex items-center gap-2 min-h-[46px] px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm">
            <Users className="w-4 h-4" /> รายการทั้งหมด
          </button>
        </div>
      </section>
      <div className="text-center text-[11px] text-slate-400">MatchON · Badminton Tournament Platform</div>
    </div>
  );
}
