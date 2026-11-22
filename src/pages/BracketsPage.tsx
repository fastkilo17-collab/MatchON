import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, GitBranch, Hand, Lock, Printer, Shuffle, Sparkles, Trash2, Unlock, X } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { BracketFormat, Match, Registration } from '../types/matchon';
import { isByeMatch, computeStandings, standingPtsFor, fmtTime, FORMAT_TH, teamName, groupPlan, clubKey } from '../utils/bracket';
import type { StandingRow, StandingPts } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { MatchNo, ResponsiveSheet, TeamAvatars } from '../components/UiKit';

export function BracketsPage() {
  const {
    state,
    activeTournament,
    tCategories,
    tRules,
    tRegistrations,
    tMatches,
    tBrackets,
    regMap,
    generateBracket,
    toggleBracketLock,
    clearBracket,
    generateGroupKnockoutStage,
    generateNextSwissRound,
    setGroupTeams,
    toast,
  } = useMatchON();

  const [catId, setCatId] = useState<string>('');
  const [format, setFormat] = useState<BracketFormat>('knockout');
  const [gMode, setGMode] = useState<'groups' | 'perGroup'>('perGroup');
  const [gVal, setGVal] = useState(4);
  const [advance, setAdvance] = useState(2);
  const [seeded, setSeeded] = useState(false);
  const [hasLower, setHasLower] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [view, setView] = useState<'groups' | 'upper' | 'lower'>('groups');
  const [editGroup, setEditGroup] = useState<number | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const toggleTeam = (k: string) => setOpenTeams((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  useEffect(() => {
    if (!tCategories.length) return;
    if (!catId || !tCategories.some((c) => c.id === catId)) {
      setCatId(tCategories[0].id);
      setFormat(tCategories[0].format);
    }
  }, [tCategories, catId]);

  const activeCat = tCategories.find((c) => c.id === catId) || tCategories[0];
  if (!activeTournament || !activeCat) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรุ่นการแข่งขันในรายการนี้ กรุณาเพิ่มรุ่นในหน้ารายการแข่งขันก่อน
      </div>
    );
  }

  const confirmedTeams = tRegistrations.filter(
    (r) => r.category_id === activeCat.id && r.status === 'confirmed',
  );
  const catMatches = tMatches.filter((m) => m.category_id === activeCat.id);
  const meta = tBrackets.find((b) => b.category_id === activeCat.id);
  const locked = Boolean(meta?.locked);
  const isManager = state.role === 'organizer';

  const groupMatches = catMatches.filter((m) => m.stage === 'group');
  const swissMatches = catMatches.filter((m) => m.stage === 'swiss');
  const koMatches = catMatches.filter((m) => m.stage === 'knockout' || m.stage === 'main');
  const lowMatches = catMatches.filter((m) => m.stage === 'lower');
  const lowerOn = Boolean(meta?.has_lower) || lowMatches.length > 0;
  const sections = ([
    { k: 'groups', label: 'แบ่งกลุ่ม', n: groupMatches.length, why: 'รุ่นนี้ไม่มีรอบแบ่งกลุ่ม' },
    ...(lowerOn
      ? [
          { k: 'upper', label: 'น็อคเอาท์สายบน', n: koMatches.length, why: 'สายน็อคเอาท์สายบนยังไม่ถูกสร้าง (รอจบรอบแบ่งกลุ่ม)' },
          { k: 'lower', label: 'น็อคเอาท์สายล่าง', n: lowMatches.length, why: 'สายน็อคเอาท์สายล่างยังไม่ถูกสร้าง (รอจบรอบแบ่งกลุ่ม)' },
        ]
      : [{ k: 'upper', label: 'น็อคเอาท์', n: koMatches.length, why: 'สายน็อคเอาท์ยังไม่ถูกสร้าง' }]),
  ] as Array<{ k: 'groups' | 'upper' | 'lower'; label: string; n: number; why: string }>).map((x) => ({
    ...x,
    why: catMatches.length === 0 ? 'ยังไม่ได้จัดสายการแข่งขันของรุ่นนี้' : x.why,
  }));
  const firstOn = sections.find((x) => x.n > 0)?.k;
  const effView = sections.some((x) => x.k === view && x.n > 0) ? view : firstOn;
  const isRoundRobinMain = meta?.format === 'round_robin';
  const plan = groupPlan(confirmedTeams.length, gMode, gVal);
  const isGroupFmt = format === 'group_stage' || format === 'group_knockout';

  const renderMatchCard = (m: Match) => {
    const aWon = m.status === 'finished' && m.winner === m.reg_a;
    const bWon = m.status === 'finished' && m.winner === m.reg_b;
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => isManager && setEditingMatch(m)}
        className={`w-full text-left rounded-2xl border p-3.5 space-y-2 transition-colors ${
          m.status === 'live'
            ? 'border-red-300 bg-red-50/30'
            : 'border-slate-200 bg-white hover:border-blue-300'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-semibold tabular-nums">
            {m.match_no ? <MatchNo n={m.match_no} className="text-sm px-2 py-1" /> : 'แมตช์'}
            {m.scheduled_at ? <span className="text-slate-700">{fmtTime(m.scheduled_at)}</span> : null}
            {m.court ? <span>· สนาม {m.court}</span> : null}
          </span>
          <span
            className={
              m.status === 'live'
                ? 'font-bold text-red-600'
                : m.status === 'finished'
                  ? 'font-semibold text-emerald-700'
                  : 'text-slate-400'
            }
          >
            {m.status === 'live' ? 'กำลังแข่ง' : m.status === 'finished' ? 'จบแล้ว' : 'รอแข่ง'}
          </span>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              {m.reg_a && <TeamAvatars reg={regMap[m.reg_a]} size={26} flat />}
              <span className={`truncate ${aWon ? 'font-bold text-emerald-700' : 'font-medium text-slate-900'}`}>
                {teamName(m.reg_a ? regMap[m.reg_a] : null)}
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-600 shrink-0 flex items-center gap-1">
              {m.sets.map((s, i) => (
                <span key={i} className={`inline-flex min-w-[24px] h-6 items-center justify-center rounded-full px-1 ${s[0] > s[1] ? 'bg-emerald-100 font-bold text-blue-700' : ''}`}>{s[0]}</span>
              ))}
              {m.status === 'live' ? <span className="px-1">{m.cur_a}</span> : null}
            </span>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              {m.reg_b && <TeamAvatars reg={regMap[m.reg_b]} size={26} flat />}
              <span className={`truncate ${bWon ? 'font-bold text-emerald-700' : 'font-medium text-slate-900'}`}>
                {teamName(m.reg_b ? regMap[m.reg_b] : null)}
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-600 shrink-0 flex items-center gap-1">
              {m.sets.map((s, i) => (
                <span key={i} className={`inline-flex min-w-[24px] h-6 items-center justify-center rounded-full px-1 ${s[1] > s[0] ? 'bg-emerald-100 font-bold text-blue-700' : ''}`}>{s[1]}</span>
              ))}
              {m.status === 'live' ? <span className="px-1">{m.cur_b}</span> : null}
            </span>
          </div>
        </div>

        {m.status === 'finished' && (!m.reg_a || !m.reg_b) && (
          <div className="text-[11px] text-slate-500">ชนะบาย (Bye)</div>
        )}
      </button>
    );
  };

  const renderTree = (list: Match[], title: string) => <KnockoutTree list={list} title={title} renderCard={renderMatchCard} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 noprint">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">สายการแข่งขัน</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {activeCat.name} · ทีมยืนยันแล้ว {confirmedTeams.length} ทีม
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Printer className="w-4 h-4" />
            พิมพ์สาย
          </button>
        </div>
      </div>

      {/* Category Horizontal Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-200/70 rounded-2xl noprint">
        {tCategories.map((c) => {
          const active = c.id === activeCat.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCatId(c.id);
                setFormat(c.format);
              }}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Generator / Controls Panel */}
      {isManager && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 noprint">
          {catMatches.length === 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <GitBranch className="w-4 h-4 text-blue-600" />
                ตั้งค่ารูปแบบสายการแข่งขัน ({confirmedTeams.length} ทีมพร้อมจัดสาย)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">รูปแบบการแข่งขัน</span>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as BracketFormat)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    {Object.entries(FORMAT_TH).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">การจัดมือวาง</span>
                  <select
                    value={seeded ? 'seed' : 'random'}
                    onChange={(e) => setSeeded(e.target.value === 'seed')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    <option value="random">สุ่มทั้งหมด</option>
                    <option value="seed">เรียงตามมือวาง (Seed)</option>
                  </select>
                </label>

                {isGroupFmt && (
                  <>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">กำหนดจาก</span>
                      <select
                        value={gMode}
                        onChange={(e) => { setGMode(e.target.value as 'groups' | 'perGroup'); setGVal(e.target.value === 'groups' ? plan.groups : plan.perGroup); }}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        <option value="groups">จำนวนกลุ่ม</option>
                        <option value="perGroup">จำนวนทีมต่อกลุ่ม</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">{gMode === 'groups' ? 'จำนวนกลุ่ม' : 'ทีมต่อกลุ่ม'}</span>
                      <input
                        type="number"
                        min={gMode === 'groups' ? 1 : 2}
                        max={gMode === 'groups' ? 16 : 32}
                        value={gVal}
                        onChange={(e) => setGVal(Number(e.target.value))}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
                      />
                      <span className="block text-[11px] text-emerald-700 font-semibold">= {plan.groups} กลุ่ม · กลุ่มละไม่เกิน {plan.perGroup} ทีม</span>
                    </label>
                    {format === 'group_knockout' && (
                      <>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-slate-600">เข้ารอบกลุ่มละ (ทีม)</span>
                          <input
                            type="number"
                            min={1}
                            max={8}
                            value={advance}
                            onChange={(e) => setAdvance(Number(e.target.value))}
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
                          />
                        </label>
                        <label className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer self-end">
                          <input type="checkbox" checked={hasLower} onChange={(e) => setHasLower(e.target.checked)} className="w-4 h-4" />
                          <span>
                            มีสายบน/สายล่าง
                            <span className="block text-[11px] text-slate-500">สายบน = ทีมเข้ารอบ · สายล่าง = ทีมที่ตกรอบ</span>
                          </span>
                        </label>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => generateBracket(activeCat.id, { format, groups: plan.groups, advance, seeded, hasLower })}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                สร้างสายการแข่งขันอัตโนมัติ
              </button>
              {isGroupFmt && (
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
                >
                  <Hand className="w-4 h-4" />
                  จัดสายเอง
                </button>
              )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-700">
                รูปแบบ: <span className="font-bold text-slate-900">{FORMAT_TH[meta?.format || activeCat.format]}</span> ·{' '}
                {catMatches.filter((m) => !isByeMatch(m)).length} แมตช์ ·{' '}
                <span className={locked ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                  {locked ? 'ล็อกสายแล้ว' : 'ยังไม่ล็อกสาย'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {meta?.format === 'group_knockout' &&
                  !catMatches.some((m) => m.stage === 'knockout') && (
                    <button
                      type="button"
                      onClick={() => generateGroupKnockoutStage(activeCat.id)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      สร้างรอบน็อคเอาท์
                    </button>
                  )}
                {meta?.format === 'swiss' && (
                  <button
                    type="button"
                    onClick={() => generateNextSwissRound(activeCat.id)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    + สร้างรอบ Swiss ถัดไป
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleBracketLock(activeCat.id)}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                >
                  {locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {locked ? 'ปลดล็อก' : 'ล็อกสาย'}
                </button>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => clearBracket(activeCat.id)}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ล้างสาย
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isRoundRobinMain && swissMatches.length === 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar noprint">
          {sections.map((x) => {
            const on = x.n > 0;
            return (
              <button
                key={x.k}
                type="button"
                aria-disabled={!on}
                onClick={() => (on ? setView(x.k) : toast(x.why, 'info'))}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                  !on
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : effView === x.k
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Bracket Visualization */}
      {catMatches.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-sm text-slate-500">
          รุ่น {activeCat.name} ยังไม่ได้จัดสายการแข่งขัน
        </div>
      ) : (
        <div className="space-y-5">
          {/* Group Stage Tables */}
          {groupMatches.length > 0 && effView === 'groups' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...new Set(groupMatches.map((m) => m.group_no ?? 0))]
                .sort((a, b) => a - b)
                .map((gNo) => {
                  const gm = groupMatches.filter((m) => (m.group_no ?? 0) === gNo);
                  const teamIds = [...new Set(gm.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])];
                  const rows = computeStandings(teamIds, gm, standingPtsFor(activeCat.id, tCategories, tRules));
                  const sp = standingPtsFor(activeCat.id, tCategories, tRules);
                  const letter = String.fromCharCode(65 + gNo);
                  return (
                    <div key={gNo} className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 space-y-2">
                      <button
                        type="button"
                        onClick={() => setEditGroup(gNo)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <h3 className="font-display text-base font-bold text-slate-900">กลุ่ม {letter}</h3>
                        <span className="text-[11px] font-semibold text-blue-700 noprint">{isManager ? 'ดูแมตช์/แก้ไขกลุ่ม ›' : 'ดูแมตช์ ›'}</span>
                      </button>
                      <div className="space-y-1.5">
                        {rows.map((r, idx) => (
                          <TeamStandCard
                            key={r.id}
                            row={r}
                            rank={idx + 1}
                            reg={regMap[r.id]}
                            pts={sp}
                            matches={gm.filter((m) => m.reg_a === r.id || m.reg_b === r.id)}
                            regMap={regMap}
                            open={openTeams.has(`${gNo}:${r.id}`)}
                            onToggle={() => toggleTeam(`${gNo}:${r.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Round Robin Main Standings */}
          {isRoundRobinMain && koMatches.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <h3 className="font-display text-base font-bold text-slate-900">ตารางคะแนนพบกันหมด</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 text-left font-semibold">#</th>
                      <th className="py-2 text-left font-semibold">ทีม</th>
                      <th className="py-2 text-right font-semibold">แข่ง</th>
                      <th className="py-2 text-right font-semibold">ชนะ</th>
                      <th className="py-2 text-right font-semibold">แพ้</th>
                      <th className="py-2 text-right font-semibold">เกม+/-</th>
                      <th className="py-2 text-right font-semibold">แต้ม+/-</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums font-mono">
                    {computeStandings(
                      [...new Set(koMatches.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])],
                      koMatches,
                      standingPtsFor(activeCat.id, tCategories, tRules),
                    ).map((r, idx) => (
                      <tr key={r.id}>
                        <td className="py-2 text-slate-500">{idx + 1}</td>
                        <td className="py-2 font-sans font-semibold text-slate-900">
                          {teamName(regMap[r.id])}
                        </td>
                        <td className="py-2 text-right">{r.played}</td>
                        <td className="py-2 text-right font-bold text-blue-700">{r.won}</td>
                        <td className="py-2 text-right">{r.lost}</td>
                        <td className="py-2 text-right">{r.gf - r.ga}</td>
                        <td className="py-2 text-right">{r.pf - r.pa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {koMatches.map(renderMatchCard)}
              </div>
            </div>
          )}

          {/* Swiss Rounds */}
          {swissMatches.length > 0 && (
            <div className="space-y-4">
              {[...new Set(swissMatches.map((m) => m.round))]
                .sort((a, b) => a - b)
                .map((r) => (
                  <div key={r} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
                    <h3 className="font-display text-base font-bold text-slate-900">รอบที่ {r}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {swissMatches.filter((m) => m.round === r).map(renderMatchCard)}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Horizontal Scrollable Knockout Tree */}
          {!isRoundRobinMain && koMatches.length > 0 && effView === 'upper' && renderTree(koMatches, lowMatches.length ? 'สายบน (Knockout)' : 'สายการแข่งขัน (Knockout)')}
          {!isRoundRobinMain && lowMatches.length > 0 && effView === 'lower' && renderTree(lowMatches, 'สายล่าง (Knockout)')}
        </div>
      )}

      <MatchScoreSheet match={editingMatch} onClose={() => setEditingMatch(null)} />

      <ManualDraw
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        teams={confirmedTeams}
        groupCount={plan.groups}
        perGroup={plan.perGroup}
        draftKey={`matchon.draw.${activeCat.id}`}
        onConfirm={(manualGroups) => {
          try { localStorage.removeItem(`matchon.draw.${activeCat.id}`); } catch { /* ignore */ }
          generateBracket(activeCat.id, { format, groups: manualGroups.length, advance, seeded: false, hasLower, manualGroups });
          setManualOpen(false);
        }}
      />

      <GroupEditSheet
        open={editGroup !== null}
        onClose={() => setEditGroup(null)}
        groupNo={editGroup ?? 0}
        showTeams={isManager}
        current={editGroup === null ? [] : [...new Set(groupMatches.filter((m) => (m.group_no ?? 0) === editGroup).flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])]}
        assigned={new Set(groupMatches.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])}
        teams={confirmedTeams}
        regs={regMap}
        canEdit={isManager}
        matches={editGroup === null ? [] : groupMatches.filter((m) => (m.group_no ?? 0) === editGroup)}
        renderMatch={renderMatchCard}
        onSave={(ids) => { if (editGroup !== null && setGroupTeams(activeCat.id, editGroup, ids)) setEditGroup(null); }}
      />
    </div>
  );
}

/* ---------- สายน็อคเอาท์ + เส้นเชื่อมแต่ละแมตช์ไปรอบถัดไป ---------- */
function KnockoutTree({ list, title, renderCard }: { list: Match[]; title: string; renderCard: (m: Match) => React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Array<{ d: string; done: boolean }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sig = list.map((m) => `${m.id}${m.status}${m.reg_a}${m.reg_b}${m.sets.length}`).join('|');

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const calc = () => {
      const box = el.getBoundingClientRect();
      const pos: Record<string, DOMRect> = {};
      el.querySelectorAll<HTMLElement>('[data-mid]').forEach((n) => { pos[n.dataset.mid as string] = n.getBoundingClientRect(); });
      const out: Array<{ d: string; done: boolean }> = [];
      for (const m of list) {
        if (!m.next_match || !pos[m.id] || !pos[m.next_match]) continue;
        const a = pos[m.id];
        const b = pos[m.next_match];
        const x1 = a.right - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left;
        const y2 = b.top + b.height / 2 - box.top;
        const mx = x1 + (x2 - x1) / 2;
        out.push({ d: `M${x1} ${y1} H${mx} V${y2} H${x2}`, done: m.status === 'finished' });
      }
      setPaths((old) => (JSON.stringify(old) === JSON.stringify(out) ? old : out));
      setSize((o) => (o.w === box.width && o.h === box.height ? o : { w: box.width, h: box.height }));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sig]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400 noprint">ปัดซ้าย-ขวาเพื่อดูรอบถัดไป</span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div ref={wrap} className="relative flex items-stretch gap-10 w-max">
          <svg className="absolute inset-0 pointer-events-none" width={size.w} height={size.h} aria-hidden="true">
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill="none" strokeWidth={p.done ? 2 : 1.5} className={p.done ? 'stroke-blue-500' : 'stroke-slate-300'} />
            ))}
          </svg>
          {[...new Set(list.map((m) => m.round))]
            .sort((a, b) => a - b)
            .map((roundNum) => {
              const roundMatches = list.filter((m) => m.round === roundNum).sort((a, b) => a.slot - b.slot);
              return (
                <div key={roundNum} className="w-[260px] shrink-0 flex flex-col gap-3">
                  <div className="text-xs font-bold text-slate-500 px-1">{roundMatches[0]?.round_label || `รอบที่ ${roundNum}`}</div>
                  <div className="flex-1 flex flex-col justify-around gap-3">
                    {roundMatches.map((m) => (
                      <div key={m.id} data-mid={m.id} className="relative">{renderCard(m)}</div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ---------- การ์ดทีมในกลุ่ม (ย่อ/ขยาย) ---------- */
function TeamStandCard({
  row, rank, reg, pts, matches, regMap, open, onToggle,
}: {
  row: StandingRow; rank: number; reg?: Registration; pts: StandingPts;
  matches: Match[]; regMap: Record<string, Registration>; open: boolean; onToggle: () => void;
}) {
  const one = (n?: string, k?: string) => (n ? (k && k !== n ? `${n} (${k})` : n) : '');
  const people = reg ? [one(reg.p1_name, reg.p1_nick), one(reg.p2_name, reg.p2_nick)].filter(Boolean) : [];
  const stat = (label: string, v: React.ReactNode, tone = 'text-slate-900') => (
    <div className="rounded-lg bg-white border border-slate-200 py-1.5 text-center">
      <div className={`text-base font-bold tabular-nums ${tone}`}>{v}</div>
      <div className="text-xs text-slate-500 leading-tight">{label}</div>
    </div>
  );
  const sec = (title: string) => <div className="text-xs font-bold text-slate-500 mb-1.5">{title}</div>;
  return (
    <div className={`rounded-2xl border ${open ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 bg-white'} overflow-hidden`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full px-2.5 py-2 text-left space-y-1.5">
        <span className="flex items-center gap-2.5">
          <span className="w-7 h-7 shrink-0 grid place-items-center text-xs font-bold text-blue-700 bg-blue-50 rounded-lg tabular-nums">{rank}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{reg?.club || teamName(reg)}</span>
          {row.played >= 1 && <span className={`shrink-0 text-[10px] font-bold rounded-md px-1.5 py-0.5 ${rank <= 2 ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50'}`}>อันดับ {rank}</span>}
          <span className="shrink-0 text-right leading-tight">
            <span className="block text-base font-bold tabular-nums text-blue-700">{row.pts}</span>
            <span className="block text-[10px] text-slate-400">คะแนน</span>
          </span>
          <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
        <span className="flex items-center gap-2.5">
          <TeamAvatars reg={reg} size={34} flat />
          <span className="min-w-0 flex-1 text-xs text-slate-700 leading-snug">
            {people.map((n, i) => <span key={i} className="block truncate">{n}</span>)}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-3 space-y-3 border-t border-slate-200">
          <div>
            {sec('ผลการแข่งขัน')}
            <div className="grid grid-cols-4 gap-1.5">
              {stat('แข่ง', row.played)}
              {stat('ชนะ', row.won, 'text-emerald-700')}
              {stat('เสมอ', row.drawn)}
              {stat('แพ้', row.lost, 'text-red-600')}
            </div>
          </div>
          <div>
            {sec('เกมและแต้ม')}
            <div className="grid grid-cols-4 gap-1.5">
              {stat('เกม +/-', row.gf - row.ga)}
              {stat('แต้มได้', row.pf)}
              {stat('แต้มเสีย', row.pa)}
              {stat('แต้ม +/-', row.pf - row.pa)}
            </div>
          </div>
          <div>
            {sec('แมตช์ในกลุ่ม')}
            <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100">
              {matches.map((m) => {
                const isA = m.reg_a === row.id;
                const opp = regMap[(isA ? m.reg_b : m.reg_a) || ''];
                const done = m.status === 'finished' && m.reg_a && m.reg_b;
                const res = !done ? null : !m.winner ? 'draw' : m.winner === row.id ? 'win' : 'loss';
                const got = res === 'win' ? pts.win : res === 'draw' ? pts.draw : res === 'loss' ? pts.loss : null;
                const sc = m.sets.map((x) => (isA ? `${x[0]}-${x[1]}` : `${x[1]}-${x[0]}`)).join('  ');
                return (
                  <div key={m.id} className="flex items-center gap-2 px-2.5 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-800">พบ {opp ? (opp.club || teamName(opp)) : 'รอผลการแข่ง'}</span>
                      <span className="block text-xs font-mono tabular-nums text-slate-500">{done ? sc || '-' : m.status === 'live' ? 'กำลังแข่ง' : 'รอแข่ง'}</span>
                    </span>
                    {res && (
                      <span className={`shrink-0 min-w-[68px] text-center rounded-lg py-1 text-xs font-bold ${res === 'win' ? 'bg-emerald-100 text-emerald-700' : res === 'loss' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                        {res === 'win' ? 'ชนะ' : res === 'loss' ? 'แพ้' : 'เสมอ'} +{got}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- จัดสายเอง: สุ่ม/เลือกทีมลงกลุ่มทีละทีม (ทีม/ก๊วนเดียวกันห้ามอยู่กลุ่มเดียวกัน) ---------- */
function ManualDraw({
  open, onClose, teams, groupCount, perGroup, onConfirm, draftKey,
}: {
  draftKey: string;
  open: boolean; onClose: () => void; teams: import('../types/matchon').Registration[];
  groupCount: number; perGroup: number; onConfirm: (groups: string[][]) => void;
}) {
  const [groups, setGroups] = useState<string[][]>([]);
  const [roll, setRoll] = useState<{ g: number; shown: string; reg?: import('../types/matchon').Registration; done: boolean; pickId?: string } | null>(null);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const timer = React.useRef<number | null>(null);
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));

  useEffect(() => {
    if (open) {
      let init: string[][] = Array.from({ length: groupCount }, () => []);
      try {
        const raw = JSON.parse(localStorage.getItem(draftKey) || 'null') as string[][] | null;
        const ids = new Set(teams.map((t) => t.id));
        if (raw && raw.length === groupCount && raw.every((g) => Array.isArray(g) && g.every((id) => ids.has(id)))) init = raw;
      } catch { /* ignore */ }
      setGroups(init); setMsg(''); setRoll(null); setPickFor(null);
    }
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [open, groupCount]);

  useEffect(() => {
    if (!open || !groups.length) return;
    try { localStorage.setItem(draftKey, JSON.stringify(groups)); } catch { /* ignore */ }
  }, [groups, open, draftKey]);

  const used = new Set(groups.flat());
  const pool = teams.filter((t) => !used.has(t.id));
  const cap = perGroup;
  const clash = (g: number, t: import('../types/matchon').Registration) => {
    const k = clubKey(t);
    return !!k && groups[g].some((id) => clubKey(byId[id]) === k);
  };
  const eligible = (g: number) => (groups[g].length >= cap ? [] : pool.filter((t) => !clash(g, t)));
  const place = (g: number, id: string) => setGroups((prev) => prev.map((gr, i) => (i === g ? [...gr, id] : gr)));

  const drawTo = (g: number, force = false) => {
    if (roll && !force) return;
    const el = eligible(g);
    if (!el.length) {
      setMsg(groups[g].length >= cap ? `กลุ่ม ${String.fromCharCode(65 + g)} เต็มแล้ว` : `ไม่มีทีมที่ลงกลุ่ม ${String.fromCharCode(65 + g)} ได้ (ทีมที่เหลือซ้ำก๊วนกับทีมในกลุ่ม)`);
      return;
    }
    setMsg('');
    const pick = el[Math.floor(Math.random() * el.length)];
    // ช้าลงเรื่อยๆ ช่วงท้ายเพื่อให้ลุ้น
    const ticks = 20;
    let n = 0;
    let delay = 60;
    const step = () => {
      n++;
      if (n >= ticks) {
        setRoll({ g, shown: teamName(pick), reg: pick, done: true, pickId: pick.id });
        return;
      }
      const t = el[Math.floor(Math.random() * el.length)];
      setRoll({ g, shown: teamName(t), reg: t, done: false });
      delay = Math.min(300, n < 12 ? delay * 1.05 : delay * 1.22);
      timer.current = window.setTimeout(step, delay);
    };
    setRoll({ g, shown: teamName(pick), reg: pick, done: false });
    timer.current = window.setTimeout(step, delay);
  };
  const remove = (g: number, id: string) => setGroups((prev) => prev.map((gr, i) => (i === g ? gr.filter((x) => x !== id) : gr)));
  const randomRest = () => {
    const ids = [...pool].sort(() => Math.random() - 0.5);
    setGroups((prev) => {
      const next = prev.map((g) => [...g]);
      for (const t of ids) {
        const k = clubKey(t);
        const cands = next.map((g, i) => ({ g, i })).filter(({ g }) => g.length < cap);
        const ok = cands.filter(({ g }) => !k || !g.some((id) => clubKey(byId[id]) === k)).sort((a, b) => a.g.length - b.g.length);
        const to = ok[0];
        if (to) to.g.push(t.id);
      }
      return next;
    });
  };
  const ready = pool.length === 0 && groups.every((g) => g.length >= 2);

  return (
    <ResponsiveSheet open={open} onClose={onClose} title="จัดสายเอง" subtitle={`ทีม/ก๊วนเดียวกันห้ามอยู่กลุ่มเดียวกัน · ${groupCount} กลุ่ม กลุ่มละไม่เกิน ${cap} ทีม · บันทึกร่างอัตโนมัติ (ผู้เล่นยังไม่เห็นสายจนกว่าจะยืนยัน)`}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={randomRest} disabled={!!roll || !pool.length} className="min-h-[38px] px-3 rounded-xl bg-slate-100 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5" /> สุ่มที่เหลือทั้งหมด
          </button>
          <button type="button" onClick={() => { setGroups(Array.from({ length: groupCount }, () => [])); setMsg(''); }} disabled={!!roll} className="min-h-[38px] px-3 rounded-xl bg-slate-100 text-xs font-semibold">
            ล้างทั้งหมด
          </button>
        </div>
        {msg && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2">{msg}</div>}
        <div className="font-bold text-sm text-slate-900">เหลือ {pool.length}/{teams.length} ทีม</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-2xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-slate-900">กลุ่ม {String.fromCharCode(65 + gi)} <span className="text-xs font-normal text-slate-500">({g.length}/{cap})</span></span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={!!roll || !pool.length || g.length >= cap}
                    onClick={() => { setMsg(''); setPickFor(gi); }}
                    className="min-h-[34px] px-3 rounded-lg bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold"
                  >
                    เลือกทีม
                  </button>
                  <button
                    type="button"
                    disabled={!!roll || !pool.length || g.length >= cap}
                    onClick={() => drawTo(gi)}
                    className="min-h-[34px] px-3 rounded-lg bg-violet-600 disabled:bg-slate-300 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> สุ่มทีม
                  </button>
                </div>
              </div>
              {g.map((id) => (
                <div key={id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5">
                  <TeamAvatars reg={byId[id]} size={24} flat />
                  <span className="flex-1 min-w-0 text-xs font-semibold text-slate-900 truncate">{teamName(byId[id])}</span>
                  <button type="button" aria-label="เอาออก" disabled={!!roll} onClick={() => remove(gi, id)} className="w-7 h-7 grid place-items-center rounded-lg bg-red-50 text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {!g.length && <div className="text-[11px] text-slate-400 text-center py-2">ยังไม่มีทีม</div>}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!ready || !!roll}
          onClick={() => onConfirm(groups)}
          className="w-full min-h-[46px] rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold"
        >
          {ready ? 'ยืนยันและสร้างสาย' : pool.length ? `ต้องจัดทีมให้ครบก่อน (เหลือ ${pool.length} ทีม)` : 'ทุกกลุ่มต้องมีอย่างน้อย 2 ทีม'}
        </button>
      </div>

      {/* เลือกทีมเอง */}
      {pickFor !== null && createPortal(
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={() => setPickFor(null)}>
          <div className="w-full max-w-md max-h-[75vh] overflow-y-auto rounded-2xl bg-white p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-sm text-slate-900">เลือกทีมเข้ากลุ่ม {String.fromCharCode(65 + pickFor)}</div>
            {pool.map((t) => {
              const bad = clash(pickFor, t);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={bad}
                  onClick={() => { place(pickFor, t.id); setPickFor(null); }}
                  className="w-full flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left disabled:opacity-40"
                >
                  <TeamAvatars reg={t} size={28} flat />
                  <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">{teamName(t)}</span>
                  {bad && <span className="text-[11px] text-red-600 font-semibold shrink-0">ซ้ำก๊วน</span>}
                </button>
              );
            })}
            <button type="button" onClick={() => setPickFor(null)} className="w-full min-h-[40px] rounded-xl bg-slate-100 text-xs font-semibold">ปิด</button>
          </div>
        </div>,
        document.body,
      )}

      {/* popup แอนิเมชันสุ่มกลางจอ */}
      {roll && createPortal(
        <div className="fixed inset-0 z-[320] bg-black/80 flex flex-col items-center justify-center gap-5 p-6">
          <div className="text-white/80 text-lg font-semibold">กำลังสุ่มทีมเข้า กลุ่ม {String.fromCharCode(65 + roll.g)}</div>
          {roll.reg && <TeamAvatars reg={roll.reg} size={96} flat />}
          <div className={`w-full max-w-2xl rounded-3xl px-6 py-10 text-center font-display text-3xl sm:text-5xl font-extrabold leading-tight transition-colors ${roll.done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'}`}>
            {roll.shown}
          </div>
          {roll.done && (
            <>
              <div className="text-emerald-300 text-xl font-bold">🎉 ได้ทีมนี้!</div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => { place(roll.g, roll.pickId!); setRoll(null); }} className="min-h-[48px] px-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-bold">บันทึก</button>
                <button type="button" onClick={() => { const g = roll.g; setRoll(null); window.setTimeout(() => drawTo(g, true), 50); }} className="min-h-[48px] px-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-base font-bold">สุ่มใหม่</button>
                <button type="button" onClick={() => setRoll(null)} className="min-h-[48px] px-8 rounded-xl bg-white/15 hover:bg-white/25 text-white text-base font-bold">ปิด</button>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </ResponsiveSheet>
  );
}

/* ---------- popup กลุ่ม: ดูทีม/แมตช์ (ย่อขยายได้) และแก้ทีมหลังจัดสาย ---------- */
function GroupEditSheet({
  open, onClose, groupNo, current, assigned, teams, regs, canEdit, showTeams, matches, renderMatch, onSave,
}: {
  showTeams: boolean; open: boolean; onClose: () => void; groupNo: number; current: string[]; assigned: Set<string>;
  teams: import('../types/matchon').Registration[]; regs: Record<string, import('../types/matchon').Registration>; canEdit: boolean;
  matches: Match[]; renderMatch: (m: Match) => React.ReactNode; onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [add, setAdd] = useState('');
  const [showMatches, setShowMatches] = useState(true);
  useEffect(() => { if (open) { setIds(current); setAdd(''); setShowMatches(true); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, groupNo]);
  const byId = regs;
  const free = teams.filter((t) => !assigned.has(t.id) && !ids.includes(t.id));
  const changed = ids.length !== current.length || ids.some((x) => !current.includes(x));
  return (
    <ResponsiveSheet open={open} onClose={onClose} title={`กลุ่ม ${String.fromCharCode(65 + groupNo)}`} subtitle={canEdit ? 'ลบ/เพิ่มทีม แล้วกด บันทึก (แก้ได้เฉพาะกลุ่มที่ยังไม่มีผลแข่ง)' : `${ids.length} ทีม · ${matches.length} แมตช์`}>
      <div className="space-y-4">
        {showTeams && <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">ทีมในกลุ่ม ({ids.length})</div>
          {ids.map((id, ti) => (
            <div key={id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
              <span className="w-8 shrink-0 text-center text-xs font-bold text-slate-500">{String.fromCharCode(65 + groupNo)}{ti + 1}</span>
              <TeamAvatars reg={byId[id]} size={26} flat />
              <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">{teamName(byId[id])}</span>
              {canEdit && (
                <button type="button" aria-label="ลบ" onClick={() => setIds(ids.filter((x) => x !== id))} className="w-9 h-9 grid place-items-center rounded-lg bg-red-50 text-red-600"><X className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="flex gap-2">
              <select value={add} onChange={(e) => setAdd(e.target.value)} className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm">
                <option value="">เพิ่มทีม (ที่ยังไม่อยู่ในกลุ่มใด)…</option>
                {free.map((t) => <option key={t.id} value={t.id}>{teamName(t)}</option>)}
              </select>
              <button type="button" disabled={!add} onClick={() => { setIds([...ids, add]); setAdd(''); }} className="min-h-[42px] px-4 rounded-xl bg-slate-100 disabled:opacity-40 text-xs font-semibold">เพิ่ม</button>
            </div>
          )}
        </div>}

        <div className="space-y-2">
          {showTeams && (          <button type="button" onClick={() => setShowMatches(!showMatches)} className="w-full flex items-center justify-between min-h-[40px] px-3 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
            <span>การจับคู่แมตช์ ({matches.length})</span>
            <span>{showMatches ? 'ย่อ ▲' : 'ขยาย ▼'}</span>
          </button>)}
          {(showMatches || !showTeams) && (
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} onClick={onClose}>{renderMatch(m)}</div>
              ))}
              {!matches.length && <div className="text-xs text-slate-400 text-center py-3">ยังไม่มีแมตช์</div>}
            </div>
          )}
        </div>

        {canEdit && (
          <button type="button" disabled={!changed} onClick={() => onSave(ids)} className="w-full min-h-[46px] rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold">บันทึก</button>
        )}
      </div>
    </ResponsiveSheet>
  );
}
