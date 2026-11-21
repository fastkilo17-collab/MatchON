import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarX, GripVertical, Search, Wand2 } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import {
  findScheduleConflicts,
  fmtDate,
  fmtTime,
  MATCH_TH,
  planAutoSchedule,
  scoreText,
  teamName,
} from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { MatchNo, ResponsiveSheet } from '../components/UiKit';

export function SchedulePage() {
  const {
    state,
    activeTournament,
    tMatches,
    tCategories,
    tCourts,
    regMap,
    catMap,
    runAutoSchedule,
    clearSchedule,
    saveTournament,
  } = useMatchON();

  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'live' | 'finished'>('all');
  const [catFilter, setCatFilter] = useState<string>('');
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
  const [catStart, setCatStart] = useState<Record<string, string>>({});
  const [useCourt, setUseCourt] = useState(false);
  const [useTime, setUseTime] = useState(true);
  const timeOnly = !useCourt;
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [matchMin, setMatchMin] = useState(30);
  const [restMin, setRestMin] = useState(15);
  const [confirmClear, setConfirmClear] = useState(false);

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

  const pendingCats = tCategories.filter((c) => tMatches.some((m) => m.category_id === c.id && m.status === 'scheduled' && !m.scheduled_at));
  const orderedCats = [...pendingCats].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  const moveCat = (id: string, to: number) => {
    const ids = orderedCats.map((c) => c.id).filter((x) => x !== id);
    ids.splice(Math.max(0, Math.min(ids.length, to)), 0, id);
    setOrder(ids);
  };
  const catStartIso = () => {
    const cs: Record<string, string> = {};
    Object.entries(catStart).forEach(([k, v]) => { if (v) cs[k] = new Date(v).toISOString(); });
    return cs;
  };
  // ประมาณเวลาเริ่มของแต่ละรุ่นตามลำดับที่ตั้ง
  const preview: Record<string, string> = {};
  if (autoOpen && selectedCourts.length && startDT) {
    const plan = planAutoSchedule(
      tMatches,
      { ...activeTournament, match_minutes: matchMin, rest_minutes: restMin },
      new Date(startDT).toISOString(),
      selectedCourts,
      timeOnly,
      catStartIso(),
      orderedCats.map((c) => c.id),
    );
    const cat: Record<string, string> = Object.fromEntries(tMatches.map((m) => [m.id, m.category_id]));
    for (const x of plan) {
      const c = cat[x.id];
      if (!preview[c] || x.scheduled_at < preview[c]) preview[c] = x.scheduled_at;
    }
  }

  const openAutoPlanner = () => {
    setMatchMin(activeTournament.match_minutes || 30);
    setRestMin(activeTournament.rest_minutes ?? 15);
    setOrder(pendingCats.map((c) => c.id));
    setSelectedCourts(availableCourtNos);
    setAutoOpen(true);
  };

  const handleRunAuto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourts.length || (!useCourt && !useTime)) return;
    if (matchMin !== activeTournament.match_minutes || restMin !== activeTournament.rest_minutes) {
      saveTournament({ ...activeTournament, match_minutes: matchMin, rest_minutes: restMin });
    }
    runAutoSchedule(new Date(startDT).toISOString(), selectedCourts, timeOnly, useTime, catStartIso(), {
      order: orderedCats.map((c) => c.id),
      matchMin,
      restMin,
    });
    setAutoOpen(false);
  };

  const filtered = tMatches
    .filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (catFilter && m.category_id !== catFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const names = [
        teamName(m.reg_a ? regMap[m.reg_a] : null),
        teamName(m.reg_b ? regMap[m.reg_b] : null),
        catMap[m.category_id]?.name || '',
        m.match_no ? `แมตช์ #${m.match_no}` : '',
      ];
      return names.some((s) => s.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const fa = a.status === 'finished' ? 1 : 0;
      const fb = b.status === 'finished' ? 1 : 0;
      if (fa !== fb) return fa - fb; // แมตช์ที่จบแล้วไปต่อท้าย
      const ta = a.scheduled_at ? +new Date(a.scheduled_at) : Number.MAX_SAFE_INTEGER;
      const tb = b.scheduled_at ? +new Date(b.scheduled_at) : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return (a.match_no || 999) - (b.match_no || 999);
    });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-slate-900">ตารางการแข่งขัน</h2>

        {isManager && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs font-semibold text-red-700">ล้างเวลา/สนาม/เลขแมตช์ของแมตช์ที่ยังไม่แข่ง?</span>
                <button type="button" onClick={() => { clearSchedule(); setConfirmClear(false); }} className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white text-xs font-semibold">ยืนยัน</button>
                <button type="button" onClick={() => setConfirmClear(false)} className="min-h-[44px] px-4 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700">ไม่ใช่</button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs sm:text-sm font-semibold whitespace-nowrap"
                >
                  <CalendarX className="w-4 h-4" />
                  ยกเลิกตารางแข่ง
                </button>
                <button
                  type="button"
                  onClick={openAutoPlanner}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm shadow-blue-600/15"
                >
                  <Wand2 className="w-4 h-4" />
                  จัดตารางอัตโนมัติ
                </button>
              </>
            )}
          </div>
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
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-200/70 rounded-2xl">
          {[{ id: '', name: 'ทุกรุ่น' }, ...tCategories].map((c) => (
            <button
              key={c.id || 'all'}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                catFilter === c.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อนักกีฬา รุ่น หรือ #แมตช์..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>
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

      {/* Schedule List (จัดกลุ่มตามวัน) */}
      <div className="space-y-4">
        {filtered.length ? (
          (() => {
            const dayKey = (m: Match) => {
              const f = m.status === 'finished' ? 'fin:' : '';
              if (!m.scheduled_at) return f + 'none';
              const d = new Date(m.scheduled_at);
              return `${f}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            };
            const days: Array<{ key: string; items: Match[] }> = [];
            for (const m of filtered) {
              const k = dayKey(m);
              const last = days[days.length - 1];
              if (last && last.key === k) last.items.push(m);
              else days.push({ key: k, items: [m] });
            }
            return days.map((d) => (
              <section key={d.key} className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-700 px-1">
                  {d.key.startsWith('fin:') ? 'จบแล้ว · ' : ''}{d.key.endsWith('none') ? 'ยังไม่กำหนดเวลา' : fmtDate(d.items[0].scheduled_at!)}
                  <span className="ml-2 text-xs font-medium text-slate-400"> {d.items.length} แมตช์</span>
                </h3>
                <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {d.items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => isManager && setEditingMatch(m)}
                      className={`w-full p-4 text-left transition-colors space-y-1.5 ${m.status === 'live' ? 'bg-red-50 border-l-4 border-red-500 hover:bg-red-50' : m.status === 'finished' ? 'opacity-75 hover:bg-slate-50/70' : 'hover:bg-slate-50/70'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 text-xs text-slate-500">
                          {m.match_no ? <MatchNo n={m.match_no} className="text-sm px-2 py-1" /> : <span className="text-slate-400">—</span>}
                          {m.status === 'live' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-600 text-white px-1.5 py-0.5 text-[11px] font-extrabold shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
                            </span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{catMap[m.category_id]?.name || ''}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{m.round_label}</span>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-slate-800">
                          {m.scheduled_at ? fmtTime(m.scheduled_at) : '--:--'}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {teamName(m.reg_a ? regMap[m.reg_a] : null)}{' '}
                        <span className="font-normal text-slate-400">vs</span>{' '}
                        {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600 tabular-nums">{m.court ? `สนาม ${m.court}` : 'รอสนาม'}</span>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            m.status === 'live' ? 'text-red-600' : m.status === 'finished' ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {m.status === 'finished' || m.status === 'live' ? scoreText(m) || MATCH_TH[m.status] : MATCH_TH[m.status]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ));
          })()
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-sm text-slate-500">ไม่พบแมตช์ในตารางการแข่งขัน</div>
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">แมตช์ละ (นาที)</span>
              <input type="number" min={5} max={180} value={matchMin} onChange={(e) => setMatchMin(Math.max(5, Math.min(180, +e.target.value || 0)))} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">พักระหว่างแมตช์ (นาที)</span>
              <input type="number" min={0} max={120} value={restMin} onChange={(e) => setRestMin(Math.max(0, Math.min(120, +e.target.value || 0)))} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
          </div>

          {orderedCats.length > 1 && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-700">ลำดับการแข่งแต่ละรุ่น (ลากชื่อรุ่น หรือกดลูกศร) · ช่องเวลา = กำหนดเวลาเริ่มเอง เว้นว่างให้ระบบคำนวณตามลำดับ</div>
              {orderedCats.map((c, i) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId && dragId !== c.id) moveCat(dragId, i); setDragId(null); }}
                  onDragEnd={() => setDragId(null)}
                  className={`rounded-xl border p-2 space-y-1.5 bg-white ${dragId === c.id ? 'opacity-50 border-blue-400' : 'border-slate-200'}`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-400 shrink-0 cursor-grab" />
                    <span className="w-5 text-xs font-bold text-blue-700 tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 truncate">{c.name}</span>
                    <span className="text-xs text-slate-500 tabular-nums shrink-0">
                      {preview[c.id] ? `เริ่ม ${fmtDate(preview[c.id])} ${fmtTime(preview[c.id])}` : ''}
                    </span>
                    <button type="button" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => moveCat(c.id, i - 1)} className="w-8 h-8 grid place-items-center rounded-lg border border-slate-200 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" aria-label="เลื่อนลง" disabled={i === orderedCats.length - 1} onClick={() => moveCat(c.id, i + 1)} className="w-8 h-8 grid place-items-center rounded-lg border border-slate-200 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                  </div>
                  <input
                    type="datetime-local"
                    value={catStart[c.id] || ''}
                    onChange={(e) => setCatStart({ ...catStart, [c.id]: e.target.value })}
                    className="w-full min-h-[40px] px-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700">
            <span className="text-xs text-slate-500">จัด:</span>
            <label className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer">
              <input type="checkbox" checked={useCourt} onChange={(e) => setUseCourt(e.target.checked)} className="w-4 h-4" /> สนาม
            </label>
            <label className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer">
              <input type="checkbox" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} className="w-4 h-4" /> เวลา
            </label>
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
