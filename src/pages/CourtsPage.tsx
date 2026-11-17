import React, { useState } from 'react';
import {
  Activity,
  Megaphone,
  PauseCircle,
  Play,
  Plus,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { fmtTime, scoreText, teamName } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { ResponsiveSheet } from '../components/UiKit';

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
    updateMatchMeta,
    toggleCourtMaintenance,
    addCourt,
  } = useMatchON();

  const [callCourtNo, setCallCourtNo] = useState<number | null>(null);
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);

  if (!activeTournament) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>;
  }

  const isManager = state.role === 'organizer' || state.role === 'referee';
  const liveMatches = tMatches.filter((m) => m.status === 'live');
  const busyPlayers = new Set(
    liveMatches.flatMap((m) => [m.reg_a, m.reg_b].filter(Boolean) as string[]),
  );

  const readyQueue = tMatches
    .filter(
      (m) =>
        m.status === 'scheduled' &&
        m.reg_a &&
        m.reg_b &&
        !busyPlayers.has(m.reg_a) &&
        !busyPlayers.has(m.reg_b),
    )
    .sort((a, b) => a.round - b.round || (a.match_no || 0) - (b.match_no || 0));

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
            off: { label: 'งดใช้งาน', textCls: 'text-slate-400', cardCls: 'border-slate-200 bg-slate-50/80' },
          }[kind];

          const courtRefs = tReferees
            .filter((r) => r.court_no === court.no)
            .map((r) => r.name)
            .join(', ');

          return (
            <div
              key={court.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${statusMeta.cardCls}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-slate-900">{court.name}</h3>
                  <span className={`text-xs font-bold ${statusMeta.textCls}`}>{statusMeta.label}</span>
                </div>

                {m ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {m.match_no ? `#${m.match_no} · ` : ''}
                        {catMap[m.category_id]?.name || ''} · {m.round_label}
                      </span>
                      {m.scheduled_at && <span className="tabular-nums">{fmtTime(m.scheduled_at)}</span>}
                    </div>
                    <div className="space-y-1 text-sm font-bold text-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{teamName(m.reg_a ? regMap[m.reg_a] : null)}</span>
                        {kind === 'live' && (
                          <span className="font-mono text-base tabular-nums text-blue-700">{m.cur_a}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{teamName(m.reg_b ? regMap[m.reg_b] : null)}</span>
                        {kind === 'live' && (
                          <span className="font-mono text-base tabular-nums text-blue-700">{m.cur_b}</span>
                        )}
                      </div>
                    </div>
                    {m.sets.length > 0 && (
                      <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                        เซตก่อนหน้า: {scoreText({ ...m, status: 'finished' })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    {kind === 'off' ? 'สนามปิดปรับปรุงชั่วคราว' : 'พร้อมเรียกแมตช์ลงสนาม'}
                  </div>
                )}

                {courtRefs && (
                  <div className="text-xs text-slate-500">กรรมการประจำสนาม: {courtRefs}</div>
                )}
              </div>

              {isManager && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
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
                        onClick={() => updateMatchMeta(m.id, { status: 'scheduled' })}
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
                  <button
                    type="button"
                    onClick={() => toggleCourtMaintenance(court.id)}
                    className="inline-flex items-center gap-1 min-h-[42px] px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium ml-auto"
                  >
                    {court.status === 'maintenance' ? (
                      <>
                        <PauseCircle className="w-3.5 h-3.5 text-emerald-600" />
                        เปิดใช้
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3.5 h-3.5 text-slate-400" />
                        งดใช้
                      </>
                    )}
                  </button>
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
        subtitle="แสดงเฉพาะคู่ที่นักกีฬาพร้อมและไม่ติดแข่งอยู่สนามอื่น"
      >
        {readyQueue.length ? (
          <div className="space-y-2">
            {readyQueue.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (callCourtNo != null) callMatchToCourt(m.id, callCourtNo);
                  setCallCourtNo(null);
                }}
                className="w-full p-3.5 min-h-[60px] rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    {m.match_no ? `#${m.match_no} · ` : ''}
                    {catMap[m.category_id]?.name || ''} · {m.round_label}
                  </div>
                  <div className="text-sm font-bold text-slate-900 truncate mt-0.5">
                    {teamName(m.reg_a ? regMap[m.reg_a] : null)} vs{' '}
                    {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-600 shrink-0">
                  {idx === 0 ? 'คิวถัดไป' : 'เลือก'}
                </span>
              </button>
            ))}
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
