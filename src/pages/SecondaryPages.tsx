import React, { useState } from 'react';
import {
  Award,
  Download,
  Plus,
  Printer,
  Trash2,
  Trophy,
} from 'lucide-react';
import { AccountBox, LineLoginCard } from '../components/AuthDialog';
import { rpcUpdateProfile, type StaffRow } from '../lib/db';
import { sb } from '../lib/supabase';
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
    tReferees,
    addRulePreset,
    deleteRulePreset,
    assignCategoryRule,
    addReferee,
    updateReferee,
    deleteReferee,
    addStandardRules,
  } = useMatchON();

  const [ruleName, setRuleName] = useState('');
  const [mode, setMode] = useState<'one' | 'bo3' | 'bo5' | 'two'>('bo3');
  const [points, setPoints] = useState(21);
  const [cap, setCap] = useState(30);
  const [deuce, setDeuce] = useState(true);

  const [refName, setRefName] = useState('');
  const [refPhone, setRefPhone] = useState('');

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
      best_of: mode === 'one' ? 1 : mode === 'bo5' ? 5 : 3,
      play_two: mode === 'two',
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
      court_no: null,
    });
    setRefName('');
    setRefPhone('');
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
          <button
            type="button"
            onClick={addStandardRules}
            className="min-h-[40px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
          >
            + เพิ่มชุดมาตรฐาน (1 เซต / 2 ใน 3 เซต / 3 ใน 5 เซต / 2 เซต)
          </button>
        )}
        {isOrganizer && (
          <form onSubmit={handleAddRule} className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 pt-3 border-t border-slate-100">
            <input
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="ชื่อชุดกติกา เช่น 1 เกม 30 แต้ม"
              className="col-span-2 min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="one">1 เซต</option>
              <option value="bo3">2 ใน 3 เซต</option>
              <option value="bo5">3 ใน 5 เซต</option>
              <option value="two">2 เซต (2-0 ได้ 2, 1-1 ได้ 1)</option>
            </select>
            <input
              type="number"
              min={5}
              max={50}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              aria-label="แต้มต่อเซต"
              title="แต้มต่อเซต"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 px-1">
              <input type="checkbox" checked={deuce} onChange={(e) => setDeuce(e.target.checked)} className="w-4 h-4" />
              ดิว
            </label>
            <input
              type="number"
              min={5}
              max={99}
              value={cap}
              disabled={!deuce}
              onChange={(e) => setCap(Number(e.target.value))}
              aria-label="แต้มสูงสุด"
              title="แต้มสูงสุด (ปิดเซต)"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums disabled:bg-slate-100"
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
        <p className="text-xs text-slate-500">
          เพิ่มสนามแล้วระบบสร้างกรรมการให้ตามจำนวนสนามอัตโนมัติ แก้ชื่อ/เบอร์โทรได้ภายหลัง · กรรมการถูกเลือกประจำสนามเมื่อกด QR กรรมการในหน้า Live Score
        </p>
        <div className="divide-y divide-slate-100">
          {tReferees.map((rf, i) => (
            <div key={rf.id} className="py-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto">
              {isOrganizer ? (
                <div className="flex flex-nowrap items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-500 shrink-0 whitespace-nowrap">กรรมการที่ {i + 1}</span>
                  <input
                    defaultValue={rf.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== rf.name && updateReferee(rf.id, { name: e.target.value.trim() })}
                    className="min-h-[40px] flex-1 min-w-[7rem] px-3 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                  <input
                    type="tel"
                    defaultValue={rf.phone || ''}
                    onBlur={(e) => e.target.value !== (rf.phone || '') && updateReferee(rf.id, { phone: e.target.value.trim() })}
                    className="min-h-[40px] w-32 shrink-0 px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
                    placeholder="เบอร์โทร"
                  />
                </div>
              ) : (
                <div className="text-sm flex-1 min-w-0 whitespace-nowrap">
                  <span className="text-xs text-slate-500 mr-2">กรรมการที่ {i + 1}</span>
                  <span className="font-bold text-slate-900">{rf.name}</span>
                  <span className="text-xs text-slate-500 tabular-nums ml-2">{rf.phone || ''}</span>
                </div>
              )}
              <div className="flex flex-nowrap items-center gap-2 shrink-0 whitespace-nowrap">
                {rf.court_no ? (
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1.5">ประจำสนาม {rf.court_no}</span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">ว่าง</span>
                )}
                {isOrganizer && rf.court_no ? (
                  <button
                    type="button"
                    onClick={() => updateReferee(rf.id, { court_no: null })}
                    className="min-h-[36px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600"
                  >
                    ปล่อยว่าง
                  </button>
                ) : null}
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={() => deleteReferee(rf.id)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {isOrganizer && (
          <form onSubmit={handleAddRef} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
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

  const activeRegs = tRegistrations.filter((r) => r.status !== 'cancelled' && r.status !== 'rejected');
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
  const { state, profile, toast, reload } = useMatchON();
  const [name, setName] = useState(profile?.display_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    setName(profile?.display_name || '');
    setPhone(profile?.phone || '');
  }, [profile?.id, profile?.display_name, profile?.phone]);
  const roleTh = state.role === 'organizer' ? 'ผู้จัดการแข่งขัน' : 'นักกีฬา / ผู้ชม';
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await rpcUpdateProfile(name, phone);
      toast('บันทึกโปรไฟล์แล้ว');
      await reload();
    } catch (err: any) {
      toast(err?.message || 'บันทึกไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };
  if (!profile) return <LineLoginCard why="เข้าสู่ระบบเพื่อดูและแก้ไขโปรไฟล์ รูปโปรไฟล์จะดึงมาจาก LINE อัตโนมัติ" />;
  const inp = 'w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm';
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">โปรไฟล์ & บัญชี</h2>
        <p className="text-xs text-slate-500 mt-0.5">ข้อมูลผูกกับบัญชีที่ล็อกอิน รูปโปรไฟล์ดึงจาก LINE</p>
      </div>
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover bg-slate-100" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-100 grid place-items-center text-2xl text-slate-400">👤</div>
          )}
          <div className="min-w-0">
            <div className="text-base font-bold text-slate-900 truncate">{profile.display_name || 'ผู้ใช้'}</div>
            <div className="text-xs text-slate-500 truncate">{profile.email || 'เข้าสู่ระบบด้วย LINE'}</div>
            <div className="text-xs font-semibold text-blue-700 mt-1">สิทธิ์: {roleTh}</div>
          </div>
        </div>
        <form onSubmit={save} className="space-y-2.5">
          <label className="block text-xs font-semibold text-slate-600">
            ชื่อที่แสดง
            <input value={name} onChange={(e) => setName(e.target.value)} className={inp + ' mt-1'} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            เบอร์โทร
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inp + ' mt-1'} />
          </label>
          <button disabled={busy} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            {busy ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
          </button>
        </form>
        <AccountBox />
      </section>
    </div>
  );
}

export function StaffPage() {
  const { activeTournament, isManagerOf, state, toast } = useMatchON();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const tid = activeTournament?.id || '';
  const load = React.useCallback(async () => {
    if (!tid) return;
    const { data, error } = await sb.rpc('list_staff', { p_tournament: tid });
    if (!error) setRows((data || []) as StaffRow[]);
  }, [tid]);
  React.useEffect(() => {
    void load();
  }, [load]);
  if (!activeTournament) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>;
  }
  const owner = state.role === 'organizer' && isManagerOf(tid);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    const { error } = await sb.rpc('add_staff', { p_tournament: tid, p_email: q.trim() });
    setBusy(false);
    if (error) return toast(error.message, 'err');
    toast('เพิ่ม staff แล้ว');
    setQ('');
    await load();
  };
  const remove = async (id: string) => {
    const { error } = await sb.rpc('remove_staff', { p_staff: id });
    if (error) return toast(error.message, 'err');
    toast('ลบ staff แล้ว');
    await load();
  };
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">จัดการ Staff · {activeTournament.name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Staff จัดการรายการนี้ร่วมกับผู้จัดได้ (สายแข่ง ตาราง คะแนน นักกีฬา) แต่ลบรายการหรือเพิ่ม staff เองไม่ได้
        </p>
      </div>
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900">รายชื่อ Staff ({rows.length})</h3>
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="py-3 flex items-center gap-3">
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover bg-slate-100" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center text-slate-400">👤</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{r.display_name || r.email || 'ผู้ใช้'}</div>
                <div className="text-xs text-slate-500 truncate">{r.email || 'บัญชี LINE'}</div>
              </div>
              {owner && (
                <button type="button" onClick={() => void remove(r.id)} className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {!rows.length && <div className="py-6 text-center text-sm text-slate-400">ยังไม่มี staff</div>}
        </div>
        {owner && (
          <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="อีเมล หรือ ชื่อที่แสดงใน LINE ของ staff"
              className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
            />
            <button disabled={busy} className="min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-xs font-semibold">
              + เพิ่ม Staff
            </button>
          </form>
        )}
        <p className="text-[11px] text-slate-400">ให้ staff ล็อกอินเข้าเว็บ (LINE หรืออีเมล) อย่างน้อยหนึ่งครั้งก่อน แล้วพิมพ์อีเมลหรือชื่อที่แสดงให้ตรง</p>
      </section>
    </div>
  );
}
