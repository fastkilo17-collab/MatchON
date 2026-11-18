import React, { useState } from 'react';
import { Minus, Plus, QrCode, Radio, SlidersHorizontal } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { fmtTime, ruleForMatch, ruleText, teamName } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { QrCodeSvg, ResponsiveSheet, TeamAvatars } from '../components/UiKit';
import { useLiveBridge } from '../lib/liveBridge';

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
    recordMatchSets,
    isManagerOf,
    toast,
    tReferees,
    assignReferee,
  } = useMatchON();

  const [qrCourtNo, setQrCourtNo] = useState<number | null>(null);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [refUrl, setRefUrl] = useState('');
  const [refMode, setRefMode] = useState(state.role === 'referee' || state.role === 'organizer');

  const canOperate = !!activeTournament && isManagerOf(activeTournament.id);
  const { fb, bridgeOn, error: bridgeError, refereeUrl } = useLiveBridge({
    tournament: activeTournament,
    courts: tCourts,
    matches: tMatches,
    regMap,
    catMap,
    canWrite: canOperate,
    recordSets: recordMatchSets,
    rules: tRules,
    categories: tCategories,
  });
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState('');
  const openQr = (no: number) => {
    const cur = tReferees.find((r) => r.court_no === no);
    setPickId(cur ? cur.id : '');
    setQrCourtNo(no);
    setRefUrl('');
    setPicking(true);
  };
  const chooseReferee = async (refId: string | null, label: string) => {
    if (qrCourtNo === null) return;
    assignReferee(refId, qrCourtNo);
    setPicking(false);
    try {
      setRefUrl(await refereeUrl(qrCourtNo, label));
    } catch (e: any) {
      toast(e?.message || 'สร้างลิงก์กรรมการไม่สำเร็จ', 'err');
      setPicking(true);
    }
  };

  if (!activeTournament) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรายการแข่งขัน
      </div>
    );
  }

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

      {canOperate && (
        <p className="text-xs text-slate-500">
          {bridgeOn
            ? '🟢 เชื่อมหน้ากรรมการแล้ว — เปิดหน้านี้ค้างไว้เพื่อรับคะแนนจากกรรมการ'
            : bridgeError
              ? `⚠️ เชื่อม Firebase ไม่สำเร็จ: ${bridgeError}`
              : 'กำลังเชื่อมหน้ากรรมการ…'}
        </p>
      )}

      {/* Live Courts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tCourts.map((court) => {
          const liveM = tMatches.find((m) => m.court === court.no && m.status === 'live');
          const nextM = !liveM
            ? tMatches.find((m) => m.court === court.no && m.status === 'scheduled' && m.reg_a && m.reg_b)
            : undefined;
          const m = liveM || nextM;
          const rule = m ? ruleForMatch(m, tCategories, tRules) : null;
          const f = fb[court.no];
          const fromRef = !!(m && f && f.status === 'LIVE' && f.matchCode === m.id.slice(0, 8) && (f.startedAt || f.scores.some((x) => x[0] || x[1])));
          const act = fromRef && f.activeSet >= 0 ? f.activeSet : 0;
          const shownSets: [number, number][] = fromRef
            ? (f.scores.slice(0, act).filter((x) => x[0] || x[1]) as [number, number][])
            : m?.sets || [];
          const shownCur: [number, number] = fromRef ? ((f.scores[act] || [0, 0]) as [number, number]) : [m?.cur_a || 0, m?.cur_b || 0];

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
                  {m && (m.match_no || m.scheduled_at) && (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 rounded-md px-1.5 py-0.5 shrink-0 tabular-nums">
                      {m.match_no ? `แมตช์ #${m.match_no}` : ''}{m.match_no && m.scheduled_at ? ' · ' : ''}{m.scheduled_at ? fmtTime(m.scheduled_at) : ''}
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
                      onClick={() => openQr(court.no)}
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
                      <div className="flex justify-center"><TeamAvatars reg={m.reg_a ? regMap[m.reg_a] : null} size={44} /></div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
                        {teamName(m.reg_a ? regMap[m.reg_a] : null)}
                      </div>
                      <div className="font-display text-5xl sm:text-6xl font-extrabold tabular-nums text-blue-600">
                        {shownCur[0]}
                      </div>
                    </div>

                    <div className="col-span-1 text-center text-xs font-bold text-slate-300">VS</div>

                    <div className="col-span-5 text-center space-y-2">
                      <div className="flex justify-center"><TeamAvatars reg={m.reg_b ? regMap[m.reg_b] : null} size={44} /></div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
                        {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                      </div>
                      <div className="font-display text-5xl sm:text-6xl font-extrabold tabular-nums text-slate-900">
                        {shownCur[1]}
                      </div>
                    </div>
                  </div>

                  {/* Completed Sets & Rule */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="font-mono tabular-nums">
                      {shownSets.length > 0
                        ? `เซตที่ผ่านมา: ${shownSets.map(([a, b]) => `${a}-${b}`).join(' · ')}`
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
        onClose={() => {
          setQrCourtNo(null);
          setPicking(false);
        }}
        title={`QR กรรมการ · สนาม ${qrCourtNo ?? ''}`}
        subtitle="ให้กรรมการประจำสนามสแกนเพื่อเปิดหน้าให้คะแนนสนามนี้โดยตรง"
      >
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          {picking ? (
            <div className="w-full space-y-3 text-left">
              <div className="text-xs font-semibold text-slate-500">เลือกกรรมการประจำสนามนี้ (แสดงเฉพาะกรรมการที่ว่าง + ที่ประจำสนามนี้)</div>
              {(() => {
                const cur = tReferees.find((r) => r.court_no === qrCourtNo);
                return cur ? (
                  <div className="rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-2.5">
                    <div className="text-[11px] font-semibold text-blue-700">กรรมการที่เลือกอยู่</div>
                    <div className="text-sm font-bold text-slate-900">{cur.name} <span className="text-xs font-normal text-slate-500 tabular-nums">{cur.phone || ''}</span></div>
                  </div>
                ) : null;
              })()}
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                className="w-full min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
              >
                <option value="">— เลือกกรรมการ —</option>
                {tReferees
                  .map((r, i) => ({ r, i }))
                  .filter(({ r }) => !r.court_no || r.court_no === qrCourtNo)
                  .map(({ r, i }) => (
                    <option key={r.id} value={r.id}>
                      {r.court_no === qrCourtNo ? '✓ ' : ''}กรรมการที่ {i + 1} · {r.name}{r.phone ? ` · ${r.phone}` : ''}
                    </option>
                  ))}
                <option value="special">กรรมการพิเศษ</option>
              </select>
              <button
                type="button"
                disabled={!pickId}
                onClick={() => {
                  if (pickId === 'special') void chooseReferee(null, 'กรรมการพิเศษ');
                  else {
                    const r = tReferees.find((x) => x.id === pickId);
                    if (r) void chooseReferee(r.id, r.name);
                  }
                }}
                className="w-full min-h-[48px] rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold"
              >
                สร้าง QR code
              </button>
            </div>
          ) : refUrl ? (
            <>
              <QrCodeSvg value={refUrl} size={220} />
              <div className="text-xs text-slate-500 max-w-xs">
                สแกนเพื่อเปิดหน้ากรรมการ (referee.html) ของสนาม {qrCourtNo} · อย่าแชร์ให้ผู้ชม
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(refUrl).then(() => toast('คัดลอกลิงก์แล้ว'), () => toast('คัดลอกไม่ได้', 'err'))}
                  className="min-h-[40px] px-4 rounded-xl bg-slate-100 text-xs font-semibold"
                >
                  คัดลอกลิงก์
                </button>
                <a href={refUrl} target="_blank" rel="noreferrer" className="min-h-[40px] px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center">
                  เปิดหน้ากรรมการ
                </a>
                <button type="button" onClick={() => setPicking(true)} className="min-h-[40px] px-4 rounded-xl bg-amber-100 text-amber-800 text-xs font-semibold">
                  เปลี่ยน QR code
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 py-8">
              {bridgeError ? `เชื่อม Firebase ไม่สำเร็จ: ${bridgeError}` : 'กำลังเชื่อม Firebase…'}
            </div>
          )}
        </div>
      </ResponsiveSheet>

      <MatchScoreSheet match={editMatch} onClose={() => setEditMatch(null)} />
    </div>
  );
}
