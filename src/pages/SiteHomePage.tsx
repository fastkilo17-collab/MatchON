import React from 'react';
import { ArrowRight, CalendarDays, MapPin, Radio, Trophy, Users, QrCode, Network, ClipboardList, Search } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { isByeMatch, tourStage, byNearestDate } from '../utils/bracket';
import type { Tournament } from '../types/matchon';
import { CatLine, DateChip, RegMeter, StageBadge, TourButtons, VenueLine } from '../components/TourCard';

/** สไลด์โชว์รายการแนะนำ: เลื่อนอัตโนมัติทุก 5 วินาที, ปัด/กดจุดเพื่อเปลี่ยน */
function Slideshow({ items, onOpen }: { items: Tournament[]; onOpen: (t: Tournament) => void }) {
  const [i, setI] = React.useState(0);
  const [hold, setHold] = React.useState(false);
  const n = items.length;
  React.useEffect(() => {
    if (n < 2 || hold) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => window.clearInterval(id);
  }, [n, hold]);
  const cur = Math.min(i, n - 1);
  const touch = React.useRef(0);
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-slate-900"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40 && n > 1) setI((x) => (x + (dx < 0 ? 1 : n - 1)) % n); }}
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${cur * 100}%)` }}>
        {items.map((t) => {
          const img = t.posters?.[0] || t.poster;
          return (
            <button key={t.id} type="button" onClick={() => onOpen(t)} className="relative shrink-0 w-full h-56 sm:h-72 text-left" aria-label={t.name}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900" />
              {img && <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute left-4 top-4"><DateChip t={t} /></div>
              <div className="absolute left-0 right-0 bottom-0 p-4 sm:p-6 space-y-1.5">
                <div className="font-display text-xl sm:text-3xl font-extrabold text-white leading-tight line-clamp-2">{t.name}</div>
                <div className="flex flex-wrap items-center gap-2"><StageBadge t={t} /><span className="text-xs text-white/85 truncate">{t.venue}</span></div>
              </div>
            </button>
          );
        })}
      </div>
      {n > 1 && (
        <div className="absolute bottom-2.5 right-4 flex gap-1.5">
          {items.map((t, k) => (
            <button key={t.id} type="button" aria-label={`สไลด์ ${k + 1}`} onClick={() => setI(k)} className={`h-2 rounded-full transition-all ${k === cur ? 'w-5 bg-white' : 'w-2 bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

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
  const stage = (t: Tournament) => tourStage(t, state.matches);
  const sorted = [...ts].filter((t) => t.status !== 'draft').sort(byNearestDate);
  const featured = sorted.slice(0, 6);
  // รายการแนะนำ: เฉพาะรายการที่ผู้ดูแลเว็บติดดาวไว้
  const recommended = sorted.filter((t) => t.featured).slice(0, 8);
  // รายการที่กำลังแข่งสด (มีแมตช์ live หรืออยู่ในช่วงวันแข่ง)
  const liveTours = sorted.filter((t) => stage(t) === 'live' || state.matches.some((m) => m.tournament_id === t.id && m.status === 'live'));
  const [livePop, setLivePop] = React.useState(false);

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
      <section className="relative rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 text-white px-6 py-10 sm:px-12 sm:py-16">
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none" aria-hidden="true">
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-16 -bottom-24 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
        </div>
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
          <div className="relative flex flex-wrap gap-2.5 pt-1">
            <button type="button" onClick={() => navigate('tournaments')} className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl bg-white text-blue-800 font-bold text-sm hover:bg-blue-50 transition-colors">
              <Search className="w-4 h-4" /> ดูรายการแข่งขัน
            </button>
            <div>
              <button type="button" onClick={() => setLivePop((v) => !v)} aria-expanded={livePop} className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl bg-white/15 text-white font-bold text-sm hover:bg-white/25 transition-colors">
                <Radio className="w-4 h-4" /> ดูคะแนนสด{liveNow > 0 ? ` (${liveNow})` : ''}
              </button>
              {livePop && (
                <>
                  <button type="button" aria-label="ปิด" className="fixed inset-0 z-30 cursor-default" onClick={() => setLivePop(false)} />
                  <div className="absolute left-0 top-full mt-2 z-40 w-72 max-w-[85vw] rounded-2xl bg-white text-slate-900 shadow-xl border border-slate-200 p-2">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500">รายการที่แข่งสดอยู่</div>
                    {liveTours.length ? liveTours.map((t) => (
                      <button key={t.id} type="button" onClick={() => { setLivePop(false); setActiveTid(t.id); navigate('live'); }} className="w-full min-h-[44px] flex items-center gap-2 text-left px-3 rounded-xl hover:bg-slate-50">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span className="text-sm font-semibold truncate">{t.name}</span>
                      </button>
                    )) : <div className="px-3 py-3 text-sm text-slate-400">ยังไม่มีรายการที่แข่งสดอยู่</div>}
                  </div>
                </>
              )}
            </div>
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

      {/* Recommended slideshow */}
      {recommended.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-xl font-bold text-slate-900">รายการแนะนำ</h3>
          <Slideshow items={recommended} onOpen={openT} />
        </section>
      )}

      {/* Tournaments */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900">รายการแข่ง</h3>
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
                <article key={t.id} role="link" tabIndex={0} onClick={() => openT(t)} onKeyDown={(e) => { if (e.key === 'Enter') openT(t); }} className="cursor-pointer text-left rounded-2xl bg-white border border-slate-200/80 overflow-hidden hover:border-blue-300 transition-colors flex flex-col">
                  <div className="relative h-36 bg-gradient-to-br from-blue-600 to-blue-800">
                    {img && <img src={img} alt={t.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                    <DateChip t={t} className="absolute left-3 top-3" />
                  </div>
                  <div className="p-4 space-y-2.5 flex-1">
                    <div className="font-display font-bold text-slate-900 leading-snug">{t.name}</div>
                    <div className="space-y-1.5"><div><StageBadge t={t} /></div><VenueLine t={t} /></div>
                    <CatLine t={t} />
                    <RegMeter t={t} />
                  </div>
                  <div className="px-4 pb-4"><TourButtons t={t} /></div>
                </article>
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
        <div className="grid grid-cols-2 gap-3">
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
