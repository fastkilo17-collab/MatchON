import React from 'react';
import { CalendarDays, Flag, MapPin } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { STATUS_TH, fmtRange, tourStage } from '../utils/bracket';
import type { Tournament, TournamentStatus } from '../types/matchon';

export const STAGE_TONE: Record<TournamentStatus, string> = {
  open: 'bg-emerald-50 text-emerald-700',
  live: 'bg-red-50 text-red-600',
  announced: 'bg-blue-50 text-blue-700',
  closed: 'bg-amber-50 text-amber-700',
  finished: 'bg-slate-100 text-slate-600',
  draft: 'bg-slate-100 text-slate-500',
};

/** ป้ายสถานะรายการ (คำนวณอัตโนมัติ) */
export function StageBadge({ t, className = '' }: { t: Tournament; className?: string }) {
  const { state } = useMatchON();
  const st = tourStage(t, state.matches);
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${STAGE_TONE[st]} ${className}`}><Flag className="w-3 h-3" />{STATUS_TH[st]}</span>;
}

/** แถบวันที่แข่ง: พื้นหลังขาว */
export function DateChip({ t, className = '' }: { t: Tournament; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm tabular-nums ${className}`}>
      <CalendarDays className="w-3.5 h-3.5 text-blue-600" />{fmtRange(t.start_date, t.end_date) || 'ยังไม่กำหนดวัน'}
    </span>
  );
}

/** meter bar สมัคร [ใบสมัคร / เปิดรับทั้งหมด] */
export function RegMeter({ t }: { t: Tournament }) {
  const { state } = useMatchON();
  const cats = state.categories.filter((c) => c.tournament_id === t.id);
  const cap = cats.reduce((a, c) => a + (c.max_teams || 0), 0);
  const n = state.registrations.filter((r) => r.tournament_id === t.id && r.status !== 'cancelled' && r.status !== 'rejected').length;
  const pct = cap ? Math.min(100, Math.round((n / cap) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-600">สมัคร</span>
        <span className="tabular-nums font-bold text-slate-900">{n}<span className="font-normal text-slate-400"> / {cap || '-'}</span></span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

const BTN = 'min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap';

/** ปุ่มทางลัดตามสถานะ: เปิดรับ→สมัคร / ปิดรับ→สาย+ตาราง / ถึงวันแข่ง→คะแนนสด / จบ→ผลการแข่งขัน */
export function TourButtons({ t, extra }: { t: Tournament; extra?: React.ReactNode }) {
  const { state, navigate, setActiveTid } = useMatchON();
  const st = tourStage(t, state.matches);
  const go = (route: Parameters<typeof navigate>[0]) => () => { setActiveTid(t.id); navigate(route); };
  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {st === 'open' && (
        <button type="button" onClick={() => navigate('register', { regTid: t.id })} className={`${BTN} bg-blue-600 hover:bg-blue-700 text-white`}>สมัครแข่งขัน</button>
      )}
      {st !== 'open' && st !== 'draft' && (
        <>
          <button type="button" onClick={go('brackets')} className={`${BTN} bg-slate-100 hover:bg-slate-200 text-slate-800`}>ดูสายแข่ง</button>
          <button type="button" onClick={go('schedule')} className={`${BTN} bg-slate-100 hover:bg-slate-200 text-slate-800`}>ตารางแข่ง</button>
        </>
      )}
      {st === 'live' && <button type="button" onClick={go('live')} className={`${BTN} bg-red-600 hover:bg-red-700 text-white`}>คะแนนสด</button>}
      {st === 'finished' && <button type="button" onClick={go('results')} className={`${BTN} bg-slate-900 hover:bg-slate-800 text-white`}>ผลการแข่งขัน</button>}
      {extra}
    </div>
  );
}

export function VenueLine({ t }: { t: Tournament }) {
  return <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{t.venue || 'ไม่ระบุสนาม'} · <span className="tabular-nums">{t.courts} สนาม</span></span></div>;
}
