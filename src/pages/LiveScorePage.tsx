import React, { useState } from 'react';
import { Minus, Plus, QrCode, Radio, SlidersHorizontal } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { ruleForMatch, ruleText, teamName } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { QrCodeSvg, ResponsiveSheet } from '../components/UiKit';

export function LiveScorePage() {
  const {
    state,
    activeTournament,
    tCourts,
    tMatches,
    tCategories,
    tRules,
    regMap,
    catMap,
    adjustLivePoint,
  } = useMatchON();

  const [qrCourtNo, setQrCourtNo] = useState<number | null>(null);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [refMode, setRefMode] = useState(state.role === 'referee' || state.role === 'organizer');

  if (!activeTournament) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรายการแข่งขัน
      </div>
    );
  }

  const canOperate = state.role === 'organizer' || state.role === 'referee';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
            <Radio className="w-3.5 h-3.5" />
            กระดานคะแนนสดรายสนาม
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
            Live Score · {activeTournament.name}
          </h2>
        </div>

        {canOperate && (
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRefMode(false)}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                !refMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              มุมมองผู้ชม
            </button>
            <button
              type="button"
              onClick={() => setRefMode(true)}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                refMode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              โหมดกรรมการ (+1/-1)
            </button>
          </div>
        )}
      </div>

      {/* Live Courts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tCourts.map((court) => {
          const liveM = tMatches.find((m) => m.court === court.no && m.status === 'live');
          const nextM = !liveM
            ? tMatches.find((m) => m.court === court.no && m.status === 'scheduled' && m.reg_a && m.reg_b)
            : undefined;
          const m = liveM || nextM;
          const rule = m ? ruleForMatch(m, tCategories, tRules) : null;

          return (
            <div
              key={court.id}
              className={`rounded-3xl border p-5 flex flex-col justify-between gap-4 bg-white ${
                liveM ? 'border-blue-200 shadow-sm' : 'border-slate-200/80'
              }`}
            >
              {/* Court Bar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display font-bold text-base text-slate-900">{court.name}</span>
                  {m && (
                    <span className="text-xs text-slate-500 truncate">
                      · {catMap[m.category_id]?.name || ''} · {m.round_label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {liveM ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      LIVE
                    </span>
                  ) : nextM ? (
                    <span className="text-xs font-semibold text-amber-700">เตรียมลงสนาม</span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {court.status === 'maintenance' ? 'งดใช้งาน' : 'ว่าง'}
                    </span>
                  )}

                  {canOperate && (
                    <button
                      type="button"
                      onClick={() => setQrCourtNo(court.no)}
                      aria-label={`QR กรรมการ ${court.name}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {m ? (
                <>
                  {/* Scoreboard Face */}
                  <div className="grid grid-cols-11 items-center gap-2 py-2">
                    <div className="col-span-5 text-center space-y-2">
                      <div className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
                        {teamName(m.reg_a ? regMap[m.reg_a] : null)}
                      </div>
                      <div className="font-display text-5xl sm:text-6xl font-extrabold tabular-nums text-blue-600">
                        {m.cur_a}
                      </div>
                    </div>

                    <div className="col-span-1 text-center text-xs font-bold text-slate-300">VS</div>

                    <div className="col-span-5 text-center space-y-2">
                      <div className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
                        {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                      </div>
                      <div className="font-display text-5xl sm:text-6xl font-extrabold tabular-nums text-slate-900">
                        {m.cur_b}
                      </div>
                    </div>
                  </div>

                  {/* Completed Sets & Rule */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="font-mono tabular-nums">
                      {m.sets.length > 0
                        ? `เซตที่ผ่านมา: ${m.sets.map(([a, b]) => `${a}-${b}`).join(' · ')}`
                        : `เซตที่ 1`}
                    </div>
                    {rule && <span>{ruleText(rule)}</span>}
                  </div>

                  {/* Tactile Referee Controls (+1 / -1) */}
                  {canOperate && refMode && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustLivePoint(m.id, 'a', -1)}
                          aria-label="ลดแต้มทีม A"
                          className="min-h-[54px] w-14 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-transform"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustLivePoint(m.id, 'a', 1)}
                          className="flex-1 min-h-[54px] flex items-center justify-center gap-1 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-lg active:scale-95 transition-transform shadow-sm"
                        >
                          <Plus className="w-5 h-5" />
                          <span>1</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustLivePoint(m.id, 'b', -1)}
                          aria-label="ลดแต้มทีม B"
                          className="min-h-[54px] w-14 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-transform"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustLivePoint(m.id, 'b', 1)}
                          className="flex-1 min-h-[54px] flex items-center justify-center gap-1 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-display font-bold text-lg active:scale-95 transition-transform shadow-sm"
                        >
                          <Plus className="w-5 h-5" />
                          <span>1</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {canOperate && (
                    <button
                      type="button"
                      onClick={() => setEditMatch(m)}
                      className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      แก้ไขคะแนนรายเซต / เปลี่ยนคู่สนามนี้
                    </button>
                  )}
                </>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  ยังไม่มีแมตช์ลงสนาม {court.no} ในขณะนี้
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Court Referee QR Sheet */}
      <ResponsiveSheet
        open={qrCourtNo !== null}
        onClose={() => setQrCourtNo(null)}
        title={`QR กรรมการ · สนาม ${qrCourtNo ?? ''}`}
        subtitle="ให้กรรมการประจำสนามสแกนเพื่อเปิดหน้าให้คะแนนสนามนี้โดยตรง"
      >
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <QrCodeSvg
            value={`${location.origin}${import.meta.env.BASE_URL}?t=${activeTournament.id}&court=${qrCourtNo}`}
            size={196}
          />
          <div className="text-xs text-slate-500 max-w-xs">
            รหัสสนาม: <span className="font-mono font-bold text-slate-800">COURT-{qrCourtNo}</span> ·{' '}
            {activeTournament.name}
          </div>
        </div>
      </ResponsiveSheet>

      <MatchScoreSheet match={editMatch} onClose={() => setEditMatch(null)} />
    </div>
  );
}
