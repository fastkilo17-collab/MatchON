import React, { useState } from 'react';
import {
  Award,
  Download,
  Plus,
  Printer,
  Trash2,
  Trophy,
} from 'lucide-react';
import { AccountBox } from '../components/AuthDialog';
import { useMatchON } from '../context/MatchONContext';
import {
  baht,
  computeStandings,
  downloadCsv,
  FORMAT_TH,
  PAY_TH,
  peopleCount,
  REG_STATUS_TH,
  ruleText,
  scoreText,
  teamName,
} from '../utils/bracket';

export function ResultsPage() {
  const { activeTournament, tCategories, tMatches, tBrackets, regMap, catMap } = useMatchON();
  const [catFilter, setCatFilter] = useState('');

  if (!activeTournament) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรายการแข่งขัน
      </div>
    );
  }

  const finished = tMatches
    .filter(
      (m) =>
        m.status === 'finished' &&
        m.reg_a &&
        m.reg_b &&
        (!catFilter || m.category_id === catFilter),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const podiums = tCategories.map((cat) => {
    const ms = tMatches.filter((m) => m.category_id === cat.id);
    const b = tBrackets.find((x) => x.category_id === cat.id);
    const fmt = b?.format || cat.format;
    const ko = ms.filter((m) => m.stage === 'knockout' || (m.stage === 'main' && fmt === 'knockout'));
    if (ko.length) {
      const top = Math.max(...ko.map((m) => m.round));
      const finalMatch = ko.find((m) => m.round === top && m.status === 'finished');
      if (finalMatch && finalMatch.winner) {
        return {
          cat,
          first: finalMatch.winner,
          second: finalMatch.winner === finalMatch.reg_a ? finalMatch.reg_b : finalMatch.reg_a,
        };
      }
      return { cat, first: null, second: null };
    }
    if (ms.length && ms.every((m) => m.status === 'finished') && fmt === 'round_robin') {
      const ids = [...new Set(ms.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])];
      const st = computeStandings(ids, ms);
      return { cat, first: st[0]?.id || null, second: st[1]?.id || null };
    }
    return { cat, first: null, second: null };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          ผลการแข่งขัน · {activeTournament.name}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">สรุปทำเนียบแชมป์และผลคะแนนทุกคู่ที่จบแล้ว</p>
      </div>

      {/* Podium Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {podiums.map(({ cat, first, second }) => (
          <div key={cat.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900">{cat.name}</h3>
              <Award className={`w-4 h-4 ${first ? 'text-amber-500' : 'text-slate-300'}`} />
            </div>
            {first ? (
              <div className="space-y-2 text-sm">
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-800">ชนะเลิศ</span>
                  <span className="font-bold text-slate-900 truncate">{teamName(regMap[first])}</span>
                </div>
                {second && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">รองชนะเลิศ</span>
                    <span className="font-semibold text-slate-800 truncate">{teamName(regMap[second])}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-xs text-slate-400">กำลังแข่งขัน / ยังไม่จบสาย</div>
            )}
          </div>
        ))}
      </section>

      {/* Finished Matches List */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-display text-base font-bold text-slate-900">
            ผลคะแนนรายคู่ ({finished.length})
          </h3>
          <select
            aria-label="กรองตามรุ่น"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm sm:w-56"
          >
            <option value="">ทุกรุ่น</option>
            {tCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {finished.length ? (
          <div className="divide-y divide-slate-100">
            {finished.map((m) => {
              const winnerId = m.winner;
              const loserId = m.winner === m.reg_a ? m.reg_b : m.reg_a;
              return (
                <div
                  key={m.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      {m.match_no ? `#${m.match_no} · ` : ''}
                      {catMap[m.category_id]?.name || ''} · {m.round_label}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      <span className="text-emerald-700">
                        {teamName(winnerId ? regMap[winnerId] : null)}
                      </span>{' '}
                      <span className="font-normal text-slate-400">ชนะ</span>{' '}
                      <span>{teamName(loserId ? regMap[loserId] : null)}</span>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold tabular-nums text-slate-800 shrink-0">
                    {scoreText(m) || 'ชนะบาย'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">ยังไม่มีแมตช์ที่แข่งจบ</div>
        )}
      </section>
    </div>
  );
}

export function RulesStaffPage() {
  const {
    state,
    activeTournament,
    tRules,
    tCategories,
    tBrackets,
    tCourts,
    tReferees,
    addRulePreset,
    deleteRulePreset,
    assignCategoryRule,
    addReferee,
    updateRefereeCourt,
    deleteReferee,
  } = useMatchON();

  const [ruleName, setRuleName] = useState('');
  const [bestOf, setBestOf] = useState(3);
  const [points, setPoints] = useState(21);
  const [cap, setCap] = useState(30);
  const [deuce, setDeuce] = useState(true);

  const [refName, setRefName] = useState('');
  const [refPhone, setRefPhone] = useState('');
  const [refCourt, setRefCourt] = useState<string>('');

  if (!activeTournament) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรายการแข่งขัน
      </div>
    );
  }

  const isOrganizer = state.role === 'organizer';

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    addRulePreset({
      tournament_id: activeTournament.id,
      name: ruleName.trim(),
      best_of: bestOf,
      points,
      cap,
      deuce,
    });
    setRuleName('');
  };

  const handleAddRef = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refName.trim()) return;
    addReferee({
      tournament_id: activeTournament.id,
      name: refName.trim(),
      phone: refPhone.trim(),
      court_no: refCourt ? Number(refCourt) : null,
    });
    setRefName('');
    setRefPhone('');
    setRefCourt('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          กติกาและกรรมการ · {activeTournament.name}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          ตั้งค่ากติกาการนับคะแนนแต่ละรุ่นและมอบหมายกรรมการประจำสนาม
        </p>
      </div>

      {/* Rules Section */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">ชุดกติกาการแข่งขัน ({tRules.length})</h3>
        <div className="divide-y divide-slate-100">
          {tRules.map((r) => (
            <div key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">{ruleText(r)}</div>
              </div>
              {isOrganizer && (
                <button
                  type="button"
                  onClick={() => deleteRulePreset(r.id)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {isOrganizer && (
          <form onSubmit={handleAddRule} className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100">
            <input
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="ชื่อชุดกติกา เช่น 1 เกม 30 แต้ม"
              className="col-span-2 min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={bestOf}
              onChange={(e) => setBestOf(Number(e.target.value))}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value={1}>1 เกม</option>
              <option value={3}>1 ใน 3 เกม</option>
            </select>
            <input
              type="number"
              min={11}
              max={30}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              aria-label="แต้มต่อเกม"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
            />
            <button
              type="submit"
              className="col-span-2 sm:col-span-1 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              + เพิ่มกติกา
            </button>
          </form>
        )}
      </section>

      {/* Category Rule Mapping */}
      {isOrganizer && tCategories.length > 0 && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900">กำหนดกติกาประจำรุ่น</h3>
          <div className="divide-y divide-slate-100">
            {tCategories.map((c) => {
              const b = tBrackets.find((x) => x.category_id === c.id);
              const fmt = b?.format || c.format;
              return (
                <div
                  key={c.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{FORMAT_TH[fmt]}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-96">
                    <select
                      disabled={fmt === 'knockout'}
                      value={c.rule_group || ''}
                      onChange={(e) => assignCategoryRule(c.id, 'group', e.target.value || null)}
                      className="min-h-[40px] px-2.5 rounded-xl border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 text-xs"
                    >
                      <option value="">รอบกลุ่ม: ค่าเริ่มต้น</option>
                      {tRules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <select
                      disabled={fmt === 'group_stage' || fmt === 'round_robin' || fmt === 'swiss'}
                      value={c.rule_ko || ''}
                      onChange={(e) => assignCategoryRule(c.id, 'ko', e.target.value || null)}
                      className="min-h-[40px] px-2.5 rounded-xl border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 text-xs"
                    >
                      <option value="">น็อกเอาท์: ค่าเริ่มต้น</option>
                      {tRules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Referees */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">รายชื่อกรรมการ ({tReferees.length})</h3>
        <div className="divide-y divide-slate-100">
          {tReferees.map((rf) => (
            <div key={rf.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-slate-900">{rf.name}</div>
                <div className="text-xs text-slate-500 tabular-nums">{rf.phone || 'ไม่ระบุเบอร์'}</div>
              </div>
              <div className="flex items-center gap-2">
                {isOrganizer ? (
                  <>
                    <select
                      value={rf.court_no ?? ''}
                      onChange={(e) =>
                        updateRefereeCourt(rf.id, e.target.value ? Number(e.target.value) : null)
                      }
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                    >
                      <option value="">ยังไม่ระบุสนาม</option>
                      {tCourts.map((c) => (
                        <option key={c.id} value={c.no}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => deleteReferee(rf.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-blue-700">
                    {rf.court_no ? `สนาม ${rf.court_no}` : '-'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {isOrganizer && (
          <form onSubmit={handleAddRef} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
            <input
              required
              value={refName}
              onChange={(e) => setRefName(e.target.value)}
              placeholder="ชื่อกรรมการ"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="tel"
              value={refPhone}
              onChange={(e) => setRefPhone(e.target.value)}
              placeholder="เบอร์โทร"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={refCourt}
              onChange={(e) => setRefCourt(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">เลือกสนามประจำ</option>
              {tCourts.map((c) => (
                <option key={c.id} value={c.no}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              เพิ่มกรรมการ
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

export function ReportsPage() {
  const { activeTournament, tCategories, tRegistrations, tMatches, catMap, regMap } = useMatchON();

  if (!activeTournament) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        ยังไม่มีรายการแข่งขัน
      </div>
    );
  }

  const activeRegs = tRegistrations.filter((r) => r.status !== 'cancelled');
  const paidRegs = activeRegs.filter((r) => r.pay_status === 'paid');
  const owedRegs = activeRegs.filter((r) => r.pay_status !== 'paid');
  const feeOf = (cid: string) => catMap[cid]?.fee || 0;
  const revenue = paidRegs.reduce((s, r) => s + feeOf(r.category_id), 0);
  const owedTotal = owedRegs.reduce((s, r) => s + feeOf(r.category_id), 0);
  const finished = tMatches.filter((m) => m.status === 'finished' && m.reg_a && m.reg_b);

  const exportRegistrations = () => {
    downloadCsv(`ผู้สมัคร-${activeTournament.slug}.csv`, [
      ['รุ่น', 'ผู้เล่น 1', 'เบอร์ 1', 'ผู้เล่น 2', 'สถานะ', 'การชำระ', 'ค่าสมัคร'],
      ...tRegistrations.map((r) => [
        catMap[r.category_id]?.name || '',
        r.p1_name,
        r.p1_phone,
        r.p2_name || '',
        REG_STATUS_TH[r.status],
        PAY_TH[r.pay_status],
        feeOf(r.category_id),
      ]),
    ]);
  };

  const exportFinance = () => {
    downloadCsv(`การเงิน-${activeTournament.slug}.csv`, [
      ['ทีม', 'รุ่น', 'ค่าสมัคร', 'สถานะการชำระ'],
      ...activeRegs.map((r) => [
        teamName(r),
        catMap[r.category_id]?.name || '',
        feeOf(r.category_id),
        PAY_TH[r.pay_status],
      ]),
    ]);
  };

  const exportResults = () => {
    downloadCsv(`ผลแข่ง-${activeTournament.slug}.csv`, [
      ['#', 'รุ่น', 'รอบ', 'ผู้ชนะ', 'ผู้แพ้', 'คะแนน'],
      ...finished.map((m) => [
        m.match_no ?? '',
        catMap[m.category_id]?.name || '',
        m.round_label,
        teamName(m.winner ? regMap[m.winner] : null),
        teamName((m.winner === m.reg_a ? m.reg_b : m.reg_a) ? regMap[(m.winner === m.reg_a ? m.reg_b : m.reg_a)!] : null),
        scoreText(m),
      ]),
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 noprint">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            รายงานและสถิติ · {activeTournament.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">สรุปยอดผู้สมัคร รายรับค่าสมัคร และส่งออก Excel/CSV</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportRegistrations}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            ผู้สมัคร CSV
          </button>
          <button
            type="button"
            onClick={exportFinance}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            การเงิน CSV
          </button>
          <button
            type="button"
            onClick={exportResults}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            ผลแข่ง CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
          <div className="text-xs text-slate-500">ทีมที่สมัครทั้งหมด</div>
          <div className="font-display text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {activeRegs.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            {activeRegs.reduce((s, r) => s + peopleCount(r), 0)} นักกีฬา
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
          <div className="text-xs text-slate-500">รายรับชำระแล้ว</div>
          <div className="font-display text-2xl font-bold tabular-nums text-emerald-700 mt-1">
            {baht(revenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{paidRegs.length} ทีม</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
          <div className="text-xs text-slate-500">รอตรวจสอบ / ค้างชำระ</div>
          <div className="font-display text-2xl font-bold tabular-nums text-amber-700 mt-1">
            {baht(owedTotal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{owedRegs.length} ทีม</div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
          <div className="text-xs text-slate-500">แมตช์แข่งจบแล้ว</div>
          <div className="font-display text-2xl font-bold tabular-nums text-blue-700 mt-1">
            {finished.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            จาก {tMatches.filter((m) => m.reg_a && m.reg_b).length} แมตช์
          </div>
        </div>
      </div>

      {/* Category Progress */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">สถิติผู้สมัครและรายรับแยกตามรุ่น</h3>
        <div className="space-y-3.5">
          {tCategories.map((c) => {
            const count = activeRegs.filter((r) => r.category_id === c.id).length;
            const paidCount = paidRegs.filter((r) => r.category_id === c.id).length;
            const pct = Math.min(100, Math.round((count / Math.max(1, c.max_teams)) * 100));
            return (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{c.name}</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {count}/{c.max_teams} ทีม · ชำระแล้ว {baht(paidCount * c.fee)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { state, profile } = useMatchON();
  const roleTh = state.role === 'organizer' ? 'ผู้จัดการแข่งขัน' : 'นักกีฬา / ผู้ชม';
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">บัญชีผู้ใช้</h2>
        <p className="text-xs text-slate-500 mt-0.5">สิทธิ์การใช้งานผูกกับบัญชีที่ล็อกอิน ข้อมูลทั้งหมดบันทึกในฐานข้อมูลกลาง</p>
      </div>
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Trophy className="w-4 h-4 text-blue-600" />
          {profile ? profile.display_name || profile.email : 'ยังไม่ได้เข้าสู่ระบบ'}
        </div>
        <p className="text-xs text-slate-500">สิทธิ์ปัจจุบัน: {roleTh}</p>
        <AccountBox />
      </section>
    </div>
  );
}
