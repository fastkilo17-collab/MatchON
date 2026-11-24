import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Minus, Plus, QrCode, Radio, SlidersHorizontal } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { fmtTime, ruleForMatch, playersNick, ruleShort, teamName } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { MatchNo, QrCodeSvg, ResponsiveSheet, TeamAvatars } from '../components/UiKit';
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
  const [compact, setCompact] = useState<boolean>(() => {
    try { return localStorage.getItem('matchon.liveCompact') === '1'; } catch { return false; }
  });
  const setSize = (v: boolean) => {
    setCompact(v);
    try { localStorage.setItem('matchon.liveCompact', v ? '1' : '0'); } catch { /* ignore */ }
  };
  const [refMode, setRefMode] = useState(false);

  const canOperate = !!activeTournament && isManagerOf(activeTournament.id);
  const { fb, bridgeOn, error: bridgeError, refereeUrl, liveId } = useLiveBridge({
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
  const [refLabel, setRefLabel] = useState('');
  const openQr = (no: number) => {
    const cur = tReferees.find((r) => r.court_no === no);
    setPickId(cur ? cur.id : '');
    setQrCourtNo(no);
    setRefUrl('');
    setRefLabel('');
    if (cur) {
      // already has a referee -> show the QR straight away
      setPicking(false);
      setRefLabel(cur.name);
      refereeUrl(no, cur.name).then(setRefUrl, (e: any) => {
        toast(e?.message || 'สร้างลิงก์กรรมการไม่สำเร็จ', 'err');
        setPicking(true);
      });
    } else setPicking(true);
  };
  const [rotating, setRotating] = useState(false);
  const rotateQr = async () => {
    if (qrCourtNo === null || rotating) return;
    if (!window.confirm('เปลี่ยน QR code ใหม่? ลิงก์/QR เดิมจะใช้ไม่ได้ทันที (กรรมการต้องสแกนใหม่)')) return;
    setRotating(true);
    try {
      setRefUrl('');
      setRefUrl(await refereeUrl(qrCourtNo, refLabel || undefined, true));
      toast('เปลี่ยน QR code แล้ว ลิงก์เดิมใช้ไม่ได้');
    } catch (e: any) {
      toast(e?.message || 'เปลี่ยน QR ไม่สำเร็จ', 'err');
    } finally {
      setRotating(false);
    }
  };
  // ยกเลิก QR กรรมการ: เปลี่ยนคีย์ให้ลิงก์เดิมใช้ไม่ได้ + เอากรรมการออกจากสนาม
  const revokeQr = async (no: number) => {
    if (!window.confirm(`ยกเลิก QR กรรมการสนาม ${no}? ลิงก์/QR เดิมจะใช้ไม่ได้ทันที และเอากรรมการออกจากสนามนี้`)) return;
    try {
      await refereeUrl(no, undefined, true);
      assignReferee(null, no);
      setQrCourtNo(null);
      setPicking(false);
      setRefUrl('');
      toast(`ยกเลิก QR กรรมการสนาม ${no} แล้ว`);
    } catch (e: any) {
      toast(e?.message || 'ยกเลิก QR ไม่สำเร็จ', 'err');
    }
  };
  // ยกเลิก QR กรรมการอัตโนมัติเมื่อแมตช์จบ (เฉพาะแมตช์ที่เห็นว่าเปลี่ยนเป็นจบระหว่างเปิดหน้านี้)
  const prevSt = useRef<Record<string, { st: string; court: number | null }> | null>(null);
  const autoRev = useRef({ refereeUrl, assignReferee, tReferees });
  autoRev.current = { refereeUrl, assignReferee, tReferees };
  useEffect(() => {
    const prev = prevSt.current;
    const next: Record<string, { st: string; court: number | null }> = {};
    for (const m of tMatches) next[m.id] = { st: m.status, court: m.court ?? (prev?.[m.id]?.court ?? null) };
    prevSt.current = next;
    if (!prev || !canOperate) return;
    for (const m of tMatches) {
      const p0 = prev[m.id];
      if (!p0 || p0.st === 'finished' || m.status !== 'finished') continue;
      const no = p0.court;
      if (!no || !autoRev.current.tReferees.some((r) => r.court_no === no)) continue;
      void (async () => {
        try {
          await autoRev.current.refereeUrl(no, undefined, true);
          autoRev.current.assignReferee(null, no);
          toast(`จบแมตช์ — ยกเลิก QR กรรมการสนาม ${no} อัตโนมัติ`);
        } catch {
          /* ไม่กระทบการแข่ง */
        }
      })();
    }
  }, [tMatches, canOperate]);
  const chooseReferee = async (refId: string | null, label: string) => {
    if (qrCourtNo === null) return;
    assignReferee(refId, qrCourtNo);
    setRefLabel(label);
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

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={() => setSize(!compact)}
          className="min-h-[38px] px-4 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-xs font-semibold text-slate-800"
          aria-label="สลับรูปแบบการ์ด"
        >
          {compact ? 'แบบย่อ' : 'แบบขยาย'} ⇄
        </button>
        {(liveId || activeTournament.live_id) && (
          <a
            href={`${import.meta.env.BASE_URL}board.html?live=${liveId || activeTournament.live_id}`}
            target="_blank"
            rel="noreferrer"
            className="min-h-[38px] px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> เปิดหน้าคะแนนสด (จอใหญ่)
          </a>
        )}
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
      <div className={`grid grid-cols-1 gap-2.5 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {tCourts.filter((c) => c.status !== 'maintenance').map((court) => {
          const f = fb[court.no];
          // ผู้ชม: กรรมการกดจบเกมแล้ว (สนามใน Firebase กลับเป็นว่าง) แต่ข้อมูลในระบบยังไม่อัปเดต -> แสดงเป็นสนามว่าง ไม่โชว์คะแนนค้าง
          const refFinished = !canOperate && !!f && f.status === 'READY';
          const liveM = refFinished ? undefined : tMatches.find((m) => m.court === court.no && m.status === 'live');
          const nextM = !liveM && !refFinished
            ? tMatches.find((m) => m.court === court.no && m.status === 'scheduled' && m.reg_a && m.reg_b)
            : undefined;
          const m = liveM || nextM;
          const rule = m ? ruleForMatch(m, tCategories, tRules) : null;
          const fromRef = !!(m && f && f.status === 'LIVE' && f.matchCode === m.id.slice(0, 8) && (f.startedAt || f.scores.some((x) => x[0] || x[1])));
          const act = fromRef && f.activeSet >= 0 ? f.activeSet : 0;
          const shownSets: [number, number][] = fromRef
            ? (f.scores.slice(0, act).filter((x) => x[0] || x[1]) as [number, number][])
            : m?.sets || [];
          const shownCur: [number, number] = fromRef ? ((f.scores[act] || [0, 0]) as [number, number]) : [m?.cur_a || 0, m?.cur_b || 0];

          return (
            <div
              key={court.id}
              className={`rounded-2xl border p-2.5 flex flex-col justify-between gap-1.5 bg-white ${
                liveM ? 'border-blue-200 shadow-sm' : 'border-slate-200/80'
              }`}
            >
              {/* Court Bar */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 leading-tight">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-base text-slate-900">{court.name}</span>
                    {m && <MatchNo n={m.match_no} />}
                    {m?.scheduled_at && <span className="text-xs font-bold text-slate-700 tabular-nums">{fmtTime(m.scheduled_at)}</span>}
                  </div>
                  {m && (
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {catMap[m.category_id]?.name || ''} · {m.round_label}
                    </div>
                  )}
                  {m && rule && !compact && <div className="text-[11px] text-slate-400 truncate">{ruleShort(rule)}</div>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {liveM ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      LIVE
                    </span>
                  ) : nextM ? (
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
                      รอเริ่มแข่ง
                    </span>
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
                      className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-700 ${
                        tReferees.some((r) => r.court_no === court.no)
                          ? 'bg-white border-2 border-emerald-500 text-emerald-700'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {m ? (
                <>
                  {(() => {
                    const ra = m.reg_a ? regMap[m.reg_a] : null;
                    const rb = m.reg_b ? regMap[m.reg_b] : null;
                    const maxSets = rule?.play_two ? 2 : rule?.best_of || 3;
                    const setNo = Math.min(maxSets, (fromRef && f.activeSet >= 0 ? f.activeSet : shownSets.length) + 1);
                    const started = !!(liveM || shownCur[0] || shownCur[1] || shownSets.length);
                    const av = compact ? 36 : 56;
                    const col = (r: typeof ra, side: 'a' | 'b') => (
                      <div className="min-w-0 flex flex-col items-center gap-1 text-center">
                        <TeamAvatars reg={r} size={av} flat={compact} />
                        <div className="min-w-0 max-w-full leading-tight">
                          <div className={`font-extrabold text-slate-900 line-clamp-2 ${compact ? 'text-sm' : 'text-lg'}`}>{r ? playersNick(r) : 'รอผลการแข่ง'}</div>
                          {r?.club && <div className={`font-medium text-slate-500 truncate ${compact ? 'text-[11px]' : 'text-sm'}`}>{r.club}</div>}
                        </div>
                        <div className={`font-display font-extrabold tabular-nums leading-none ${compact ? 'text-4xl' : 'text-6xl'} ${side === 'a' ? 'text-blue-600' : 'text-slate-900'}`}>{side === 'a' ? shownCur[0] : shownCur[1]}</div>
                      </div>
                    );
                    if (compact) {
                      return (
                        <div className="space-y-1.5 py-0.5">
                          {([['a', ra, shownCur[0], 0], ['b', rb, shownCur[1], 1]] as const).map(([side, r, cur, k]) => (
                            <div key={side} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <TeamAvatars reg={r} size={36} />
                                <span className="min-w-0 leading-tight">
                                  <span className="block text-base font-semibold text-slate-900 truncate">{r ? r.club || teamName(r) : 'รอผลการแข่ง'}</span>
                                  {r && <span className="block text-xs font-normal text-slate-500 truncate">{playersNick(r)}</span>}
                                </span>
                              </span>
                              <span className="flex items-center gap-1 shrink-0 tabular-nums">
                                {shownSets.map((x, i) => (
                                  <span key={i} className={`w-7 text-center text-sm ${x[k] > x[1 - k] ? 'font-bold text-emerald-600' : 'font-medium text-slate-400'}`}>{x[k]}</span>
                                ))}
                                {started && <span className="w-12 text-center font-display text-3xl font-extrabold text-blue-700">{cur}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-1.5 py-1">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                          {col(ra, 'a')}
                          <div className="pt-1 flex flex-col items-center gap-1">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${started ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              เซต {setNo}
                            </span>
                            <span className="text-[11px] font-bold text-slate-300">VS</span>
                            {shownSets.length > 0 && (
                              <div className="flex flex-col items-center text-base leading-tight font-bold tabular-nums">
                                {shownSets.map((x, i) => (
                                  <span key={i} className="text-slate-400">
                                    <span className={x[0] > x[1] ? 'text-emerald-600' : ''}>{x[0]}</span>
                                    {' - '}
                                    <span className={x[1] > x[0] ? 'text-emerald-600' : ''}>{x[1]}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {col(rb, 'b')}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tactile Referee Controls (+1 / -1) */}
                  {canOperate && refMode && !compact && (
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

                  {canOperate && !compact && (
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
              <div className="text-sm font-bold text-slate-900">กรรมการ: {refLabel || 'กรรมการพิเศษ'}</div>
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
                  เปลี่ยนกรรมการ
                </button>
                <button type="button" disabled={rotating} onClick={() => void rotateQr()} className="min-h-[40px] px-4 rounded-xl bg-red-100 text-red-700 text-xs font-semibold">
                  เปลี่ยน QR code
                </button>
                <button type="button" onClick={() => qrCourtNo !== null && void revokeQr(qrCourtNo)} className="min-h-[40px] px-4 rounded-xl bg-red-600 text-white text-xs font-semibold">
                  ยกเลิก QR กรรมการ
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
