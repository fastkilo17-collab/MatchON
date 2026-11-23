import React, { useState } from 'react';
import { CalendarDays, MapPin, Settings, Ticket } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { AthleteCard, AthleteSheet } from '../components/AthleteSheet';
import { LineLoginCard } from '../components/AuthDialog';
import { fmtDate, fmtTime, teamName } from '../utils/bracket';
import type { Registration } from '../types/matchon';

/** ข้อมูลของฉัน: โปรไฟล์ + ใบสมัครของฉัน + แมตช์ที่กำลังจะแข่ง */
export function MePage() {
  const { state, profile, navigate } = useMatchON();
  const [open, setOpen] = useState<Registration | null>(null);
  const mine = state.registrations.filter((r) => r.is_mine && r.status !== 'cancelled');
  if (!profile && !mine.length) return <LineLoginCard why="เข้าสู่ระบบเพื่อดูข้อมูลของคุณ ใบสมัคร และแมตช์ที่จะแข่ง" />;
  const catMap = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  const tName = (id: string) => state.tournaments.find((t) => t.id === id)?.name || '';
  const regMap = Object.fromEntries(state.registrations.map((r) => [r.id, r]));
  const myIds = new Set(mine.map((r) => r.id));
  const next = state.matches
    .filter((m) => m.status !== 'finished' && ((m.reg_a && myIds.has(m.reg_a)) || (m.reg_b && myIds.has(m.reg_b))))
    .sort((a, b) => (a.scheduled_at || '9').localeCompare(b.scheduled_at || '9'));
  const role = profile?.role === 'super_admin' ? 'ผู้ดูแลระบบ' : state.role === 'organizer' ? 'ผู้จัดการแข่งขัน' : 'นักกีฬา / ผู้ชม';
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-center gap-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-full object-cover bg-slate-100" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-100 grid place-items-center text-xl text-slate-400">👤</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-slate-900 truncate">{profile?.display_name || 'ผู้ใช้'}</div>
          <div className="text-xs text-slate-500">{role}{profile?.phone ? ` · ${profile.phone}` : ''}</div>
        </div>
        <button type="button" onClick={() => navigate('settings')} className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 text-xs font-semibold">
          <Settings className="w-4 h-4" /> โปรไฟล์
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-slate-900 px-1">แมตช์ที่กำลังจะแข่ง</h3>
        {next.length ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
            {next.slice(0, 8).map((m) => (
              <div key={m.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate">{tName(m.tournament_id)} · {catMap[m.category_id]?.name} · {m.round_label}</span>
                  <span className="shrink-0 font-semibold text-slate-700 tabular-nums">{m.scheduled_at ? `${fmtDate(m.scheduled_at)} ${fmtTime(m.scheduled_at)}` : 'รอจัดเวลา'}</span>
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">{teamName(m.reg_a ? regMap[m.reg_a] : null)} <span className="text-slate-400 font-normal">vs</span> {teamName(m.reg_b ? regMap[m.reg_b] : null)}</div>
                {m.court && <div className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="w-3.5 h-3.5" /> สนาม {m.court}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1"><CalendarDays className="w-5 h-5" />ยังไม่มีแมตช์ที่รอแข่ง</div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-base font-bold text-slate-900">ใบสมัครของฉัน ({mine.length})</h3>
          <button type="button" onClick={() => navigate('my')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 min-h-[36px]"><Ticket className="w-4 h-4" /> ชำระเงิน/สถานะ</button>
        </div>
        {mine.length ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
            {mine.map((r) => (
              <AthleteCard key={r.id} r={r} cat={catMap[r.category_id]} onOpen={() => setOpen(r)} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center text-xs text-slate-400">ยังไม่มีใบสมัคร</div>
        )}
      </section>
      <AthleteSheet reg={open} onClose={() => setOpen(null)} />
    </div>
  );
}
