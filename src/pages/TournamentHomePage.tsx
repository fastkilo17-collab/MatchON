import React from 'react';
import {
  Activity, CalendarDays, ClipboardCheck, GitBranch, MapPin, Trophy, Users, Award,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { PhotoLightbox } from '../components/UiKit';
import type { NavRoute } from '../types/matchon';
import { baht, fmtRange, FORMAT_TH, KIND_TH, STATUS_TH } from '../utils/bracket';

function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: React.ReactNode; sub?: string; tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' }) {
  const c = { slate: 'text-slate-900', blue: 'text-blue-600', emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' }[tone];
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className={`font-display text-3xl font-bold tabular-nums mt-1 ${c}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function TournamentHomePage() {
  const { activeTournament: t, tCategories, tRegistrations, tMatches, tCourts, navigate, state } = useMatchON();
  const [zoom, setZoom] = React.useState(false);
  if (!t) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>;
  }
  const live = tRegistrations.filter((r) => r.status !== 'cancelled' && r.status !== 'rejected');
  const by = (s: string) => tRegistrations.filter((r) => r.status === s).length;
  const done = tMatches.filter((m) => m.status === 'finished' && m.reg_a && m.reg_b).length;
  const total = tMatches.filter((m) => m.reg_a && m.reg_b).length;
  const liveNow = tMatches.filter((m) => m.status === 'live').length;
  const isMgr = state.role === 'organizer';

  const menu: Array<{ id: NavRoute; label: string; icon: React.ComponentType<{ className?: string }>; show?: boolean }> = [
    { id: 'register', label: 'สมัครแข่งขัน', icon: ClipboardCheck, show: t.status === 'open' },
    { id: 'roster', label: 'รายชื่อนักกีฬา', icon: Users },
    { id: 'brackets', label: 'สายแข่งขัน', icon: GitBranch },
    { id: 'schedule', label: 'ตารางแข่ง', icon: CalendarDays },
    { id: 'live', label: 'Live Score', icon: Activity },
    { id: 'results', label: 'ผลการแข่งขัน', icon: Trophy },
    { id: 'athletes', label: 'จัดการนักกีฬา', icon: Award, show: isMgr },
    { id: 'courts', label: 'จัดการสนาม', icon: MapPin, show: isMgr },
  ];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-5">
        {t.poster && (
          <button type="button" onClick={() => setZoom(true)} className="md:col-span-2 bg-slate-100 block" aria-label="ดูโปสเตอร์">
            <img src={t.poster} alt="โปสเตอร์" className="w-full h-full max-h-[420px] object-contain" />
          </button>
        )}
        <div className={`${t.poster ? 'md:col-span-3' : 'md:col-span-5'} p-5 sm:p-7 space-y-3`}>
          <div className="text-xs font-bold text-blue-600">{STATUS_TH[t.status]}</div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{t.name}</h2>
          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-400" />{fmtRange(t.start_date, t.end_date)}</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><span>{t.venue || 'ไม่ระบุสนาม'} · {t.courts} สนาม</span></div>
            {t.reg_deadline && <div className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-slate-400" />ปิดรับสมัคร {fmtRange(t.reg_deadline, t.reg_deadline)}</div>}
          </div>
          {t.description && <p className="text-sm text-slate-600 whitespace-pre-line">{t.description}</p>}
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="ภาพรวม">
        <Kpi label="ประเภท / รุ่นที่เปิดรับ" value={tCategories.length} tone="blue" />
        <Kpi label="ทีมที่สมัคร" value={live.length} sub={`ทั้งหมด ${tRegistrations.length} ใบสมัคร`} />
        <Kpi label="ประเมินผ่าน" value={by('confirmed')} tone="emerald" sub={`รอประเมิน ${by('pending')} · สำรอง ${by('waitlist')}`} />
        <Kpi label="ไม่ผ่าน / ยกเลิก" value={by('rejected') + by('cancelled')} tone={by('rejected') + by('cancelled') ? 'red' : 'slate'} />
        <Kpi label="สนามแข่ง" value={tCourts.length || t.courts} />
        <Kpi label="แมตช์ทั้งหมด" value={total} sub={`แข่งแล้ว ${done}`} />
        <Kpi label="กำลังแข่ง" value={liveNow} tone={liveNow ? 'red' : 'slate'} />
        <Kpi label="ความคืบหน้า" value={total ? `${Math.round((done / total) * 100)}%` : '-'} tone="emerald" />
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-slate-900">เมนูด่วน</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {menu.filter((m) => m.show !== false).map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" onClick={() => navigate(m.id)} className="min-h-[64px] flex items-center gap-3 px-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40 text-left transition-colors">
                <Icon className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-800">{m.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-slate-900">ประเภทที่เปิดรับสมัคร</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tCategories.map((c) => {
            const n = tRegistrations.filter((r) => r.category_id === c.id && r.status !== 'cancelled' && r.status !== 'rejected').length;
            const pct = c.max_teams ? Math.min(100, Math.round((n / c.max_teams) * 100)) : 0;
            return (
              <div key={c.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{c.name}</div>
                    <div className="text-xs text-slate-500">{KIND_TH[c.kind]} · {FORMAT_TH[c.format]} · {c.fee ? baht(c.fee) : 'ฟรี'}</div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums"><b className="text-lg text-slate-900">{n}</b><span className="text-xs text-slate-400"> / {c.max_teams}</span></div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: pct + '%' }} /></div>
              </div>
            );
          })}
          {!tCategories.length && <div className="text-sm text-slate-500">ยังไม่มีรุ่นการแข่งขัน</div>}
        </div>
      </section>

      {[['รูปแบบการแข่งขัน', t.format_text], ['รายละเอียดกติกา', t.rules_text], ['เงื่อนไขที่นักกีฬาต้องทราบ', t.notice]].map(([h, v]) =>
        v ? (
          <section key={h} className="bg-white border border-slate-200/80 rounded-2xl p-5">
            <h3 className="font-display text-base font-bold text-slate-900">{h}</h3>
            <p className="text-sm text-slate-600 whitespace-pre-line mt-1.5">{v}</p>
          </section>
        ) : null,
      )}
      <PhotoLightbox src={zoom ? t.poster || null : null} caption={t.name} onClose={() => setZoom(false)} />
    </div>
  );
}
