import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Search, Wand2 } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import {
  findScheduleConflicts,
  fmtDate,
  fmtTime,
  MATCH_TH,
  scoreText,
  teamName,
} from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { ResponsiveSheet } from '../components/UiKit';

export function SchedulePage() {
  const {
    state,
    activeTournament,
    tMatches,
    tCourts,
    regMap,
    catMap,
    runAutoSchedule,
  } = useMatchON();

  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'live' | 'finished'>('all');
  const [courtFilter, setCourtFilter] = useState<string>('');
  const [query, setQuery] = useState('');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, []);
  const [startDT, setStartDT] = useState(defaultStart);
  const [selectedCourts, setSelectedCourts] = useState<number[]>([]);
  const [timeOnly, setTimeOnly] = useState(false);

  if (!activeTournament) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรายการแข่งขัน
      </div>
    );
  }

  const isManager = state.role === 'organizer';
  const conflicts = findScheduleConflicts(tMatches, activeTournament, regMap);
  const availableCourtNos = tCourts.filter((c) => c.status === 'available').map((c) => c.no);

  const openAutoPlanner = () => {
    setSelectedCourts(availableCourtNos);
    setAutoOpen(true);
  };

  const handleRunAuto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourts.length) return;
    runAutoSchedule(new Date(startDT).toISOString(), selectedCourts, timeOnly);
    setAutoOpen(false);
  };

  const filtered = tMatches
    .filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (courtFilter === 'unassigned' && m.court != null) return false;
      if (courtFilter && courtFilter !== 'unassigned' && String(m.court) !== courtFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const names = [
        teamName(m.reg_a ? regMap[m.reg_a] : null),
        teamName(m.reg_b ? regMap[m.reg_b] : null),
        catMap[m.category_id]?.name || '',
        m.match_no ? `#${m.match_no}` : '',
      ];
      return names.some((s) => s.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const ta = a.scheduled_at ? +new Date(a.scheduled_at) : Number.MAX_SAFE_INTEGER;
      const tb = b.scheduled_at ? +new Date(b.scheduled_at) : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return (a.match_no || 999) - (b.match_no || 999);
    });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">ตารางการแข่งขัน</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            แมตช์ละ {activeTournament.match_minutes} นาที · พักระหว่างแมตช์{' '}
            {activeTournament.rest_minutes} นาที
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={openAutoPlanner}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm shadow-blue-600/15"
          >
            <Wand2 className="w-4 h-4" />
            จัดตารางอัตโนมัติ
          </button>
        )}
      </div>

      {/* Real Conflict Warning (only shown if conflicts exist) */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            พบเวลาชนกันหรือนักกีฬาพักไม่พอ ({conflicts.length} จุด)
          </div>
          <ul className="text-xs text-amber-800/90 space-y-0.5 pl-6 list-disc">
            {conflicts.slice(0, 4).map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อนักกีฬา รุ่น หรือ #แมตช์..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>
          <select
            aria-label="กรองตามสนาม"
            value={courtFilter}
            onChange={(e) => setCourtFilter(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
          >
            <option value="">ทุกสนาม</option>
            <option value="unassigned">ยังไม่ระบุสนาม</option>
            {tCourts.map((c) => (
              <option key={c.id} value={c.no}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100 rounded-xl">
          {(
            [
              ['all', `ทั้งหมด (${tMatches.length})`],
              ['live', `กำลังแข่ง (${tMatches.filter((m) => m.status === 'live').length})`],
              ['scheduled', `รอแข่ง (${tMatches.filter((m) => m.status === 'scheduled').length})`],
              ['finished', `จบแล้ว (${tMatches.filter((m) => m.status === 'finished').length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatusFilter(k)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                statusFilter === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
        {filtered.length ? (
          filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => isManager && setEditingMatch(m)}
              className="w-full p-4 min-h-[68px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-slate-50/70 transition-colors"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-bold text-slate-800 tabular-nums">
                    {m.match_no ? `#${m.match_no}` : '—'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{catMap[m.category_id]?.name || ''}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{m.round_label}</span>
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {teamName(m.reg_a ? regMap[m.reg_a] : null)}{' '}
                  <span className="font-normal text-slate-400">vs</span>{' '}
                  {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 tabular-nums">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {m.court ? `สนาม ${m.court}` : 'รอสนาม'}
                    {m.scheduled_at ? ` · ${fmtDate(m.scheduled_at)} ${fmtTime(m.scheduled_at)}` : ''}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    m.status === 'live'
                      ? 'text-red-600'
                      : m.status === 'finished'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                  }`}
                >
                  {m.status === 'finished' || m.status === 'live'
                    ? scoreText(m) || MATCH_TH[m.status]
                    : MATCH_TH[m.status]}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">ไม่พบแมตช์ในตารางการแข่งขัน</div>
        )}
      </div>

      {/* Auto-Schedule Sheet */}
      <ResponsiveSheet
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        title="จัดตารางแข่งขันอัตโนมัติ"
        subtitle="ระบบคำนวณสนามว่าง เวลาพักนักกีฬา และลำดับรอบให้โดยอัตโนมัติ"
      >
        <form onSubmit={handleRunAuto} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">เวลาเริ่มแข่งรอบถัดไป</span>
            <input
              type="datetime-local"
              value={startDT}
              onChange={(e) => setStartDT(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            {([[false, 'จัดสนาม + เวลา'], [true, 'จัดเฉพาะเวลา']] as const).map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTimeOnly(v)}
                className={`min-h-[40px] rounded-lg text-xs font-semibold ${timeOnly === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {timeOnly && (
            <p className="text-xs text-slate-500">
              กำหนดเฉพาะเวลาเริ่ม ไม่ผูกสนาม — เลือกจำนวนสนามด้านล่างเพื่อกำหนดว่าแข่งพร้อมกันได้กี่คู่ แล้วค่อยเรียกคู่ลงสนามที่ว่างตอนแข่งจริง
            </p>
          )}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">{timeOnly ? 'จำนวนสนามที่แข่งพร้อมกัน (เลือกกี่สนามก็ได้)' : 'เลือกสนามที่ใช้จัดตาราง'}</div>
            <div className="grid grid-cols-3 gap-2">
              {tCourts.map((c) => {
                const checked = selectedCourts.includes(c.no);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 p-3 min-h-[44px] rounded-xl border text-xs font-semibold cursor-pointer ${
                      checked
                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedCourts((prev) =>
                          prev.includes(c.no) ? prev.filter((x) => x !== c.no) : [...prev, c.no],
                        )
                      }
                      className="accent-blue-600"
                    />
                    <span>{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            เริ่มจัดตารางแมตช์ที่ยังว่าง
          </button>
        </form>
      </ResponsiveSheet>

      <MatchScoreSheet match={editingMatch} onClose={() => setEditingMatch(null)} />
    </div>
  );
}
