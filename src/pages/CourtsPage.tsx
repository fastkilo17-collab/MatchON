import React, { useState } from 'react';
import {
  Activity,
  Megaphone,
  PauseCircle,
  Play,
  Plus,
  RotateCcw,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  X,
  Trash2,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { fmtTime, playersNick, scoreText, teamName } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { MatchNo, ResponsiveSheet, TeamAvatars } from '../components/UiKit';

function CourtMenu({ name, maintenance, canCancelCall, onCancelCall, onToggle, onDelete }: { name: string; maintenance: boolean; canCancelCall: boolean; onCancelCall: () => void; onToggle: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const item = 'w-full flex items-center gap-2 min-h-[40px] px-3 text-left text-xs font-semibold hover:bg-slate-50';
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="relative ml-auto">
      <button type="button" aria-label={`เมนู ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex items-center justify-center min-h-[42px] min-w-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700">
        <MoreVertical className="w-5 h-5" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="ปิดเมนู" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 bottom-full mb-1 z-40 min-w-[180px] rounded-xl border border-slate-200 bg-white shadow-lg py-1">
            {canCancelCall && <button type="button" role="menuitem" onClick={run(onCancelCall)} className={`${item} text-slate-700`}><RotateCcw className="w-3.5 h-3.5" /> ยกเลิกการเรียก</button>}
            <button type="button" role="menuitem" onClick={run(onToggle)} className={`${item} text-slate-700`}>{maintenance ? <Play className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />} {maintenance ? 'เปิดใช้สนาม' : 'งดใช้สนาม'}</button>
            <button type="button" role="menuitem" onClick={run(onDelete)} className={`${item} text-red-600`}><Trash2 className="w-3.5 h-3.5" /> ลบสนาม</button>
          </div>
        </>
      )}
    </div>
  );
}

export function CourtsPage() {
  const {
    state,
    activeTournament,
    tCourts,
    tMatches,
    tReferees,
    regMap,
    catMap,
    navigate,
    callMatchToCourt,
    returnMatchToQueue,
    toast,
    updateMatchMeta,
    toggleCourtMaintenance,
    deleteCourt,
    addCourt,
    setCourtQueue,
    cancelCourtCall,
  } = useMatchON();

  const [callCourtNo, setCallCourtNo] = useState<number | null>(null);
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [openQ, setOpenQ] = useState<Record<string, boolean>>({});
  const [addSel, setAddSel] = useState<Record<string, string>>({});

  if (!activeTournament) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>;
  }

  const isManager = state.role === 'organizer' || state.role === 'referee';
  const liveMatches = tMatches.filter((m) => m.status === 'live');
  // ทีมที่กำลังแข่งอยู่ในสนาม -> สนามที่ลง
  const busyAt = new Map<string, number>();
  liveMatches.forEach((m) => {
    [m.reg_a, m.reg_b].forEach((r) => { if (r) busyAt.set(r, m.court || 0); });
  });
  const busyOf = (m: Match) => {
    const hit = [m.reg_a, m.reg_b].find((r) => r && busyAt.has(r));
    return hit ? busyAt.get(hit)! : null;
  };

  const readyQueue = tMatches
    .filter((m) => m.status === 'scheduled' && m.reg_a && m.reg_b)
    .sort((a, b) => {
      const ta = a.scheduled_at ? +new Date(a.scheduled_at) : Number.MAX_SAFE_INTEGER;
      const tb = b.scheduled_at ? +new Date(b.scheduled_at) : Number.MAX_SAFE_INTEGER;
      return ta - tb || (a.match_no || 9999) - (b.match_no || 9999) || a.round - b.round;
    });

  const queuedIds = new Set(tCourts.flatMap((c) => c.queue || []));
  const addable = readyQueue.filter((m) => !queuedIds.has(m.id));
  const matchById = new Map(tMatches.map((m) => [m.id, m]));
  const freeCount = tCourts.filter(
    (c) => c.status === 'available' && !liveMatches.some((m) => m.court === c.no),
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">จัดการสนามแข่งขัน</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            ทั้งหมด {tCourts.length} สนาม · กำลังแข่ง {liveMatches.length} · ว่าง {freeCount} · รอเรียก{' '}
            {readyQueue.length} คู่
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('live')}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap"
          >
            <Activity className="w-4 h-4 text-red-600" />
            ไปหน้า Live Score
          </button>
          {state.role === 'organizer' && (
            <button
              type="button"
              onClick={addCourt}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              เพิ่มสนาม
            </button>
          )}
        </div>
      </div>

      {/* Courts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tCourts.map((court) => {
          const liveM = liveMatches.find((m) => m.court === court.no);
          const waitM = !liveM
            ? tMatches
                .filter((m) => m.court === court.no && m.status === 'scheduled' && m.reg_a && m.reg_b)
                .sort((a, b) => (a.match_no || 0) - (b.match_no || 0))[0]
            : undefined;
          const m = liveM || waitM;
          const kind =
            court.status === 'maintenance'
              ? 'off'
              : liveM
                ? 'live'
                : waitM
                  ? 'wait'
                  : 'free';

          const statusMeta = {
            live: { label: 'กำลังแข่ง', textCls: 'text-red-600', cardCls: 'border-red-200 bg-white' },
            wait: { label: 'รอเริ่มแข่ง', textCls: 'text-amber-700', cardCls: 'border-amber-200 bg-white' },
            free: { label: 'สนามว่าง', textCls: 'text-emerald-700', cardCls: 'border-slate-200/80 bg-white' },
            off: { label: 'งดใช้งาน', textCls: 'text-slate-400', cardCls: 'border-slate-300 bg-slate-100 opacity-75' },
          }[kind];

          const courtRefs = tReferees
            .filter((r) => r.court_no === court.no)
            .map((r) => r.name)
            .join(', ');

          return (
            <div
              key={court.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between gap-2 ${statusMeta.cardCls}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-display text-lg font-bold text-slate-900 truncate">{court.name}</h3>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${statusMeta.textCls}`}>{statusMeta.label}</span>
                </div>

                {m ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <MatchNo n={m.match_no} />
                        <span className="truncate">{catMap[m.category_id]?.name || ''} · {m.round_label}</span>
                      </span>
                      {m.scheduled_at && <span className="tabular-nums text-[13px] font-light text-slate-600">{fmtTime(m.scheduled_at)}</span>}
                    </div>
                    <div className="space-y-1.5">
                      {(['a', 'b'] as const).map((side) => {
                        const rid = side === 'a' ? m.reg_a : m.reg_b;
                        const r = rid ? regMap[rid] : null;
                        const k = side === 'a' ? 0 : 1;
                        return (
                          <div key={side} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 min-w-0">
                              <TeamAvatars reg={r} />
                              <span className="min-w-0 leading-tight">
                                <span className="block text-sm font-normal text-slate-900 truncate">{r?.club || teamName(r)}</span>
                                {r && <span className="block text-xs font-light text-slate-500 truncate">{playersNick(r)}</span>}
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0 tabular-nums">
                              {m.sets.map((st, i) => (
                                <span key={i} className={`w-6 text-center text-xs ${st[k] > st[1 - k] ? 'font-bold text-emerald-600' : 'font-medium text-slate-400'}`}>{st[k]}</span>
                              ))}
                              {kind === 'live' && <span className="w-10 text-center font-mono text-xl font-bold text-blue-700">{k === 0 ? m.cur_a : m.cur_b}</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    {kind === 'off' ? 'งดใช้สนามชั่วคราว (พักการใช้งาน)' : 'พร้อมเรียกแมตช์ลงสนาม'}
                  </div>
                )}

                {courtRefs && (
                  <div className="text-xs text-slate-500">กรรมการประจำสนาม: {courtRefs}</div>
                )}
              </div>

              {isManager && kind !== 'off' && (() => {
                const q = (court.queue || []).filter((id) => matchById.get(id)?.status === 'scheduled');
                const open = !!openQ[court.id];
                const move = (i: number, d: number) => {
                  const a = [...q];
                  const j = i + d;
                  if (j < 0 || j >= a.length) return;
                  [a[i], a[j]] = [a[j], a[i]];
                  setCourtQueue(court.id, a);
                };
                return (
                  <div className="rounded-xl border border-slate-200">
                    <button type="button" aria-expanded={open} onClick={() => setOpenQ((o) => ({ ...o, [court.id]: !o[court.id] }))} className="w-full flex items-center gap-2 min-h-[40px] px-3 text-xs font-bold text-slate-700">
                      คิวแมตช์ถัดไป
                      {q.length > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] grid place-items-center tabular-nums">{q.length}</span>}
                      <ChevronDown className={`w-4 h-4 ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-[11px] text-slate-400">แมตช์ในคิวจะถูกเรียกลงสนามนี้อัตโนมัติเมื่อสนามว่าง (ตามลำดับ)</p>
                        {q.map((id, i) => {
                          const qm = matchById.get(id)!;
                          const ra = qm.reg_a ? regMap[qm.reg_a] : null;
                          const rb = qm.reg_b ? regMap[qm.reg_b] : null;
                          return (
                            <div key={id} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
                              <span className="w-5 text-center text-xs font-bold text-slate-400 tabular-nums">{i + 1}</span>
                              <div className="min-w-0 flex-1 leading-tight">
                                <div className="text-xs font-semibold text-slate-800 truncate">{qm.match_no ? `แมตช์ #${qm.match_no} · ` : ''}{ra ? playersNick(ra) : '-'} vs {rb ? playersNick(rb) : '-'}</div>
                                <div className="text-[11px] text-slate-500 truncate">{qm.round_label}</div>
                              </div>
                              <button type="button" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-200 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                              <button type="button" aria-label="เลื่อนลง" disabled={i === q.length - 1} onClick={() => move(i, 1)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-200 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                              <button type="button" aria-label="เอาออกจากคิว" onClick={() => setCourtQueue(court.id, q.filter((x) => x !== id))} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-red-50 text-red-600"><X className="w-4 h-4" /></button>
                            </div>
                          );
                        })}
                        {!q.length && <div className="text-xs text-slate-400 text-center py-1">ยังไม่มีแมตช์ในคิว</div>}
                        <div className="flex gap-2">
                          <select value={addSel[court.id] || ''} onChange={(e) => setAddSel((o) => ({ ...o, [court.id]: e.target.value }))} className="flex-1 min-w-0 min-h-[38px] px-2 rounded-lg border border-slate-200 bg-white text-xs">
                            <option value="">เพิ่มแมตช์เข้าคิว…</option>
                            {addable.map((am) => (
                              <option key={am.id} value={am.id}>{am.match_no ? `#${am.match_no} ` : ''}{am.reg_a && regMap[am.reg_a] ? playersNick(regMap[am.reg_a]) : '-'} vs {am.reg_b && regMap[am.reg_b] ? playersNick(regMap[am.reg_b]) : '-'}</option>
                            ))}
                          </select>
                          <button type="button" disabled={!addSel[court.id]} onClick={() => { setCourtQueue(court.id, [...q, addSel[court.id]]); setAddSel((o) => ({ ...o, [court.id]: '' })); }} className="min-h-[38px] px-3 rounded-lg bg-blue-600 disabled:bg-slate-300 text-white text-xs font-semibold">เพิ่ม</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {isManager && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {kind !== 'off' && (<>
                  {kind === 'wait' && m && (
                    <button
                      type="button"
                      onClick={() => updateMatchMeta(m.id, { status: 'live' })}
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <Play className="w-3.5 h-3.5" />
                      เริ่มแข่ง
                    </button>
                  )}
                  {kind === 'live' && m && (
                    <>
                      <button
                        type="button"
                        onClick={() => setScoreMatch(m)}
                        className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        บันทึกคะแนน
                      </button>
                      <button
                        type="button"
                        onClick={() => returnMatchToQueue(m.id)}
                        className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        ส่งกลับคิว
                      </button>
                    </>
                  )}
                  {(kind === 'free' || kind === 'wait') && (
                    <button
                      type="button"
                      onClick={() => setCallCourtNo(court.no)}
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                    >
                      <Megaphone className="w-3.5 h-3.5 text-blue-600" />
                      เรียกแมตช์
                    </button>
                  )}
                  </>)}
                  <CourtMenu
                    name={court.name}
                    maintenance={court.status === 'maintenance'}
                    canCancelCall={kind === 'wait' && !!m}
                    onCancelCall={() => m && cancelCourtCall(m.id)}
                    onToggle={() => toggleCourtMaintenance(court.id)}
                    onDelete={() => { if (window.confirm(`ลบ ${court.name} ? แมตช์ที่ยังไม่แข่งในสนามนี้จะกลับเป็นไม่กำหนดสนาม`)) deleteCourt(court.id); }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Call Match to Court Sheet */}
      <ResponsiveSheet
        open={callCourtNo !== null}
        onClose={() => setCallCourtNo(null)}
        title={`เรียกคู่ลงสนาม ${callCourtNo ?? ''}`}
        subtitle="เรียงตามเวลา · คู่ที่ทีมกำลังแข่งอยู่จะเป็นสีเทาและเรียกไม่ได้"
      >
        {readyQueue.length ? (
          <div className="space-y-2">
            {readyQueue.map((m, idx) => {
              const busy = busyOf(m);
              const called = !busy && m.court ? m.court : null;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-disabled={busy != null}
                  onClick={() => {
                    if (busy != null) { toast(`ทีมในแมตช์นี้กำลังแข่งอยู่ที่สนาม ${busy || '-'} เรียกลงสนามไม่ได้`, 'err'); return; }
                    if (callCourtNo != null) callMatchToCourt(m.id, callCourtNo);
                    setCallCourtNo(null);
                  }}
                  className={`w-full p-3.5 min-h-[60px] rounded-xl border border-l-4 text-left flex items-center justify-between gap-3 transition-colors ${
                    busy != null
                      ? 'border-slate-200 border-l-slate-400 bg-slate-100 text-slate-400'
                      : called
                        ? 'border-amber-200 border-l-amber-500 bg-amber-50 hover:bg-amber-100/70'
                        : 'border-slate-200 border-l-blue-500 hover:border-blue-400 hover:bg-blue-50/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MatchNo n={m.match_no} />
                      <span className="truncate">{catMap[m.category_id]?.name || ''} · {m.round_label}</span>
                    </div>
                    <div className={`text-sm font-bold truncate mt-0.5 ${busy != null ? 'text-slate-500' : 'text-slate-900'}`}>
                      {teamName(m.reg_a ? regMap[m.reg_a] : null)} vs {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                    </div>
                    {busy != null && <div className="text-xs font-semibold text-slate-500 mt-0.5">กำลังแข่งอยู่ สนาม {busy || '-'}</div>}
                    {called && <div className="text-xs font-bold text-amber-700 mt-0.5">ลงอยู่ สนาม {called} • รอแข่ง</div>}
                  </div>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-sm font-bold tabular-nums">{m.scheduled_at ? fmtTime(m.scheduled_at) : '--:--'}</span>
                    {busy == null && <span className="block text-xs font-semibold text-blue-600">{idx === 0 ? 'คิวถัดไป' : called ? 'ย้ายสนาม' : 'เลือก'}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            ไม่มีแมตช์ที่พร้อมเรียกในขณะนี้
          </div>
        )}
      </ResponsiveSheet>

      <MatchScoreSheet match={scoreMatch} onClose={() => setScoreMatch(null)} />
    </div>
  );
}
