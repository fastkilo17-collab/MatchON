import React, { useEffect, useState } from 'react';
import { GitBranch, Hand, Lock, Printer, Shuffle, Sparkles, Trash2, Unlock, X } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { BracketFormat, Match } from '../types/matchon';
import { computeStandings, standingPtsFor, FORMAT_TH, scoreText, teamName, groupPlan, snakeGroups } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';
import { ResponsiveSheet, TeamAvatars } from '../components/UiKit';

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
  } = useMatchON();

  const [catId, setCatId] = useState<string>('');
  const [format, setFormat] = useState<BracketFormat>('knockout');
  const [gMode, setGMode] = useState<'groups' | 'perGroup'>('groups');
  const [gVal, setGVal] = useState(2);
  const [advance, setAdvance] = useState(2);
  const [seeded, setSeeded] = useState(false);
  const [hasLower, setHasLower] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<number | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

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
          <span className="font-mono font-semibold tabular-nums">
            {m.match_no ? `แมตช์ #${m.match_no}` : 'แมตช์'}
            {m.court ? ` · สนาม ${m.court}` : ''}
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
            <span className={`truncate ${aWon ? 'font-bold text-emerald-700' : 'font-medium text-slate-900'}`}>
              {teamName(m.reg_a ? regMap[m.reg_a] : null)}
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-600 shrink-0">
              {m.sets.map((s) => s[0]).join(' ')}
              {m.status === 'live' ? ` ${m.cur_a}` : ''}
            </span>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate ${bWon ? 'font-bold text-emerald-700' : 'font-medium text-slate-900'}`}>
              {teamName(m.reg_b ? regMap[m.reg_b] : null)}
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-600 shrink-0">
              {m.sets.map((s) => s[1]).join(' ')}
              {m.status === 'live' ? ` ${m.cur_b}` : ''}
            </span>
          </div>
        </div>

        {m.status === 'finished' && (m.sets.length > 0 || !m.reg_a || !m.reg_b) && (
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            {scoreText(m) || 'ชนะบาย (Bye)'}
          </div>
        )}
      </button>
    );
  };

  const renderTree = (list: Match[], title: string) => (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400 noprint">ปัดซ้าย-ขวาเพื่อดูรอบถัดไป</span>
      </div>
      <div className="flex items-stretch gap-5 overflow-x-auto pb-2">
        {[...new Set(list.map((m) => m.round))]
          .sort((a, b) => a - b)
          .map((roundNum) => {
            const roundMatches = list.filter((m) => m.round === roundNum).sort((a, b) => a.slot - b.slot);
            return (
              <div key={roundNum} className="w-[260px] shrink-0 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-500 px-1">{roundMatches[0]?.round_label || `รอบที่ ${roundNum}`}</div>
                <div className="flex-1 flex flex-col justify-around gap-3">{roundMatches.map(renderMatchCard)}</div>
              </div>
            );
          })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 noprint">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">จัดสายการแข่งขัน</h2>
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
                {catMatches.length} แมตช์ ·{' '}
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

      {/* Bracket Visualization */}
      {catMatches.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-sm text-slate-500">
          รุ่น {activeCat.name} ยังไม่ได้จัดสายการแข่งขัน
        </div>
      ) : (
        <div className="space-y-5">
          {/* Group Stage Tables */}
          {groupMatches.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...new Set(groupMatches.map((m) => m.group_no ?? 0))]
                .sort((a, b) => a - b)
                .map((gNo) => {
                  const gm = groupMatches.filter((m) => (m.group_no ?? 0) === gNo);
                  const teamIds = [...new Set(gm.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])];
                  const rows = computeStandings(teamIds, gm, standingPtsFor(activeCat.id, tCategories, tRules));
                  return (
                    <div key={gNo} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
                      <button
                        type="button"
                        disabled={!isManager}
                        onClick={() => setEditGroup(gNo)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <h3 className="font-display text-base font-bold text-slate-900">
                          กลุ่ม {String.fromCharCode(65 + gNo)}
                        </h3>
                        {isManager && <span className="text-[11px] font-semibold text-blue-700 noprint">แตะเพื่อแก้ไขทีม</span>}
                      </button>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2 text-left font-semibold">#</th>
                              <th className="py-2 text-left font-semibold">ทีม</th>
                              <th className="py-2 text-right font-semibold">แข่ง</th>
                              <th className="py-2 text-right font-semibold">คะแนน</th>
                              <th className="py-2 text-right font-semibold">เกม+/-</th>
                              <th className="py-2 text-right font-semibold">แต้ม+/-</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 tabular-nums font-mono">
                            {rows.map((r, idx) => (
                              <tr key={r.id}>
                                <td className="py-2 text-slate-500">{idx + 1}</td>
                                <td className="py-2 font-sans font-semibold text-slate-900">
                                  <span className="inline-flex items-center gap-1.5">
                                    <TeamAvatars reg={regMap[r.id]} size={22} flat />
                                    <span>{teamName(regMap[r.id])}</span>
                                  </span>
                                </td>
                                <td className="py-2 text-right">{r.played}</td>
                                <td className="py-2 text-right font-bold text-blue-700">{r.pts}</td>
                                <td className="py-2 text-right">{r.gf - r.ga}</td>
                                <td className="py-2 text-right">{r.pf - r.pa}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="space-y-2">{gm.map(renderMatchCard)}</div>
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
          {!isRoundRobinMain && koMatches.length > 0 && renderTree(koMatches, lowMatches.length ? 'สายบน (Knockout)' : 'สายการแข่งขัน (Knockout)')}
          {!isRoundRobinMain && lowMatches.length > 0 && renderTree(lowMatches, 'สายล่าง (Knockout)')}
        </div>
      )}

      <MatchScoreSheet match={editingMatch} onClose={() => setEditingMatch(null)} />

      <ManualDraw
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        teams={confirmedTeams}
        groupCount={plan.groups}
        perGroup={plan.perGroup}
        onConfirm={(manualGroups) => {
          generateBracket(activeCat.id, { format, groups: manualGroups.length, advance, seeded: false, hasLower, manualGroups });
          setManualOpen(false);
        }}
      />

      <GroupEditSheet
        open={editGroup !== null}
        onClose={() => setEditGroup(null)}
        groupNo={editGroup ?? 0}
        current={editGroup === null ? [] : [...new Set(groupMatches.filter((m) => (m.group_no ?? 0) === editGroup).flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])]}
        assigned={new Set(groupMatches.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])}
        teams={confirmedTeams}
        onSave={(ids) => { if (editGroup !== null && setGroupTeams(activeCat.id, editGroup, ids)) setEditGroup(null); }}
      />
    </div>
  );
}

/* ---------- จัดสายเอง: สุ่มทีมลงกลุ่มทีละทีม พร้อมแอนิเมชันลุ้น ---------- */
function ManualDraw({
  open, onClose, teams, groupCount, perGroup, onConfirm,
}: {
  open: boolean; onClose: () => void; teams: import('../types/matchon').Registration[];
  groupCount: number; perGroup: number; onConfirm: (groups: string[][]) => void;
}) {
  const [groups, setGroups] = useState<string[][]>([]);
  const [roll, setRoll] = useState<{ g: number; shown: string } | null>(null);
  const timer = React.useRef<number | null>(null);
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));

  useEffect(() => {
    if (open) setGroups(Array.from({ length: groupCount }, () => []));
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [open, groupCount]);

  const used = new Set(groups.flat());
  const pool = teams.filter((t) => !used.has(t.id));
  const cap = perGroup;

  const drawTo = (g: number) => {
    if (roll || !pool.length || groups[g].length >= cap) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    let n = 0;
    timer.current = window.setInterval(() => {
      n++;
      const t = pool[Math.floor(Math.random() * pool.length)];
      setRoll({ g, shown: teamName(t) });
      if (n >= 18) {
        if (timer.current) window.clearInterval(timer.current);
        setRoll(null);
        setGroups((prev) => prev.map((gr, i) => (i === g ? [...gr, pick.id] : gr)));
      }
    }, 80);
    setRoll({ g, shown: teamName(pick) });
  };
  const remove = (g: number, id: string) => setGroups((prev) => prev.map((gr, i) => (i === g ? gr.filter((x) => x !== id) : gr)));
  const randomRest = () => {
    const ids = [...pool].sort(() => Math.random() - 0.5).map((t) => t.id);
    setGroups((prev) => {
      const next = prev.map((g) => [...g]);
      for (const id of ids) {
        const open = next.map((g, i) => ({ g, i })).filter(({ g }) => g.length < cap).sort((a, b) => a.g.length - b.g.length)[0];
        if (open) open.g.push(id);
      }
      return next;
    });
  };
  const ready = pool.length === 0 && groups.every((g) => g.length >= 2);

  return (
    <ResponsiveSheet open={open} onClose={onClose} title="จัดสายเอง" subtitle={`กดสุ่มทีมเข้ากลุ่มทีละทีม · ${groupCount} กลุ่ม กลุ่มละไม่เกิน ${cap} ทีม · เหลือ ${pool.length}/${teams.length} ทีม`}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={randomRest} disabled={!!roll || !pool.length} className="min-h-[38px] px-3 rounded-xl bg-slate-100 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5" /> สุ่มที่เหลือทั้งหมด
          </button>
          <button type="button" onClick={() => setGroups(Array.from({ length: groupCount }, () => []))} disabled={!!roll} className="min-h-[38px] px-3 rounded-xl bg-slate-100 text-xs font-semibold">
            ล้างทั้งหมด
          </button>
        </div>
        {pool.length > 0 && (
          <div className="text-[11px] text-slate-500">ยังไม่ได้ลงกลุ่ม: {pool.map((t) => teamName(t)).join(' | ')}</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-2xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">กลุ่ม {String.fromCharCode(65 + gi)} <span className="text-xs font-normal text-slate-500">({g.length}/{cap})</span></span>
                <button
                  type="button"
                  disabled={!!roll || !pool.length || g.length >= cap}
                  onClick={() => drawTo(gi)}
                  className="min-h-[34px] px-3 rounded-lg bg-violet-600 disabled:bg-slate-300 text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Shuffle className="w-3.5 h-3.5" /> สุ่มทีม
                </button>
              </div>
              {roll && roll.g === gi && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 text-sm font-bold text-amber-800 animate-pulse truncate">🎲 {roll.shown}</div>
              )}
              {g.map((id) => (
                <div key={id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5">
                  <TeamAvatars reg={byId[id]} size={24} flat />
                  <span className="flex-1 min-w-0 text-xs font-semibold text-slate-900 truncate">{teamName(byId[id])}</span>
                  <button type="button" aria-label="เอาออก" onClick={() => remove(gi, id)} className="w-7 h-7 grid place-items-center rounded-lg bg-red-50 text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {!g.length && !(roll && roll.g === gi) && <div className="text-[11px] text-slate-400 text-center py-2">ยังไม่มีทีม</div>}
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
    </ResponsiveSheet>
  );
}

/* ---------- แก้ทีมในกลุ่มหลังจัดสาย ---------- */
function GroupEditSheet({
  open, onClose, groupNo, current, assigned, teams, onSave,
}: {
  open: boolean; onClose: () => void; groupNo: number; current: string[]; assigned: Set<string>;
  teams: import('../types/matchon').Registration[]; onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [add, setAdd] = useState('');
  useEffect(() => { if (open) { setIds(current); setAdd(''); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, groupNo]);
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const free = teams.filter((t) => !assigned.has(t.id) && !ids.includes(t.id));
  return (
    <ResponsiveSheet open={open} onClose={onClose} title={`แก้ไขกลุ่ม ${String.fromCharCode(65 + groupNo)}`} subtitle="ลบ/เปลี่ยน/เพิ่มทีม แล้วกด บันทึก (แก้ได้เฉพาะกลุ่มที่ยังไม่มีผลแข่ง)">
      <div className="space-y-3">
        {ids.map((id) => (
          <div key={id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
            <TeamAvatars reg={byId[id]} size={26} flat />
            <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">{teamName(byId[id])}</span>
            <select
              aria-label="เปลี่ยนทีม"
              value=""
              onChange={(e) => e.target.value && setIds(ids.map((x) => (x === id ? e.target.value : x)))}
              className="max-w-[40%] min-h-[36px] px-2 rounded-lg border border-slate-200 bg-white text-xs"
            >
              <option value="">เปลี่ยนเป็น…</option>
              {free.map((t) => <option key={t.id} value={t.id}>{teamName(t)}</option>)}
            </select>
            <button type="button" aria-label="ลบ" onClick={() => setIds(ids.filter((x) => x !== id))} className="w-9 h-9 grid place-items-center rounded-lg bg-red-50 text-red-600"><X className="w-4 h-4" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <select value={add} onChange={(e) => setAdd(e.target.value)} className="flex-1 min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="">เพิ่มทีม (ที่ยังไม่อยู่ในกลุ่มใด)…</option>
            {free.map((t) => <option key={t.id} value={t.id}>{teamName(t)}</option>)}
          </select>
          <button type="button" disabled={!add} onClick={() => { setIds([...ids, add]); setAdd(''); }} className="min-h-[42px] px-4 rounded-xl bg-slate-100 disabled:opacity-40 text-xs font-semibold">เพิ่ม</button>
        </div>
        <button type="button" onClick={() => onSave(ids)} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">บันทึก</button>
      </div>
    </ResponsiveSheet>
  );
}
