import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  GitBranch,
  MapPin,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { fmtRange, fmtTime, peopleCount, scoreText, STATUS_TH, teamName } from '../utils/bracket';
import { MatchScoreSheet } from '../components/MatchScoreSheet';

export function DashboardPage() {
  const {
    state,
    activeTournament,
    tRegistrations,
    tMatches,
    tCourts,
    regMap,
    catMap,
    navigate,
    setActiveTid,
  } = useMatchON();

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const activeRegs = tRegistrations.filter((r) => r.status !== 'cancelled');
  const athletesCount = activeRegs.reduce((sum, r) => sum + peopleCount(r), 0);
  const liveMatches = tMatches.filter((m) => m.status === 'live');
  const waitingMatches = tMatches.filter((m) => m.status === 'scheduled' && m.reg_a && m.reg_b);
  const recentMatches = tMatches
    .filter((m) => m.status === 'finished' && m.reg_a && m.reg_b)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const slipsToVerify = tRegistrations.filter((r) => r.pay_status === 'slip_sent');
  const pendingApproval = tRegistrations.filter((r) => r.status === 'pending');
  const unscheduled = waitingMatches.filter((m) => !m.court || !m.scheduled_at);

  const actionTasks = [
    {
      count: slipsToVerify.length,
      label: 'ตรวจสอบสลิปการโอนเงิน',
      hint: 'รอผู้จัดยืนยันยอด',
      onClick: () => navigate('athletes', { filter: 'slip_sent' }),
    },
    {
      count: pendingApproval.length,
      label: 'อนุมัติใบสมัครที่รอยืนยัน',
      hint: 'ตรวจสอบคุณสมบัติและอนุมัติ',
      onClick: () => navigate('athletes', { filter: 'pending' }),
    },
    {
      count: unscheduled.length,
      label: 'แมตช์ที่ยังไม่ลงตารางสนาม/เวลา',
      hint: 'กดจัดตารางอัตโนมัติได้ทันที',
      onClick: () => navigate('schedule'),
    },
  ].filter((t) => t.count > 0);

  return (
    <div className="space-y-6">
      {/* Top Hero Greeting + Quick Actions Strip */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-slate-500">
              {activeTournament ? `${activeTournament.name} · ${STATUS_TH[activeTournament.status]}` : 'ยินดีต้อนรับสู่ MatchON'}
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 mt-0.5">
              ภาพรวมการจัดการแข่งขัน
            </h2>
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            {activeTournament
              ? `${fmtRange(activeTournament.start_date, activeTournament.end_date)} · ${tCourts.length} สนาม`
              : ''}
          </div>
        </div>

        {/* Thumb-Friendly Horizontal Quick Action Bar */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => navigate('tournaments')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold whitespace-nowrap shrink-0 shadow-sm shadow-blue-600/15 transition-colors"
          >
            <Plus className="w-4 h-4" />
            สร้าง / แก้ไขรายการ
          </button>
          <button
            type="button"
            onClick={() => navigate('courts')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <MapPin className="w-4 h-4 text-blue-600" />
            เรียกคู่ลงสนาม
          </button>
          <button
            type="button"
            onClick={() => navigate('brackets')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <GitBranch className="w-4 h-4 text-blue-600" />
            จัดสายแข่งขัน
          </button>
          <button
            type="button"
            onClick={() => navigate('schedule')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <CalendarDays className="w-4 h-4 text-blue-600" />
            จัดตารางอัตโนมัติ
          </button>
          <button
            type="button"
            onClick={() => navigate('live')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <Activity className="w-4 h-4 text-red-600" />
            Live Score
          </button>
        </div>
      </section>

      {/* 6-Metric KPI Strip (2 cols on mobile, 3 on tablet, 6 on desktop) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'รายการทั้งหมด', val: state.tournaments.length, sub: 'ทัวร์นาเมนต์' },
          { label: 'ทีมที่สมัคร', val: activeRegs.length, sub: `${athletesCount} นักกีฬา` },
          { label: 'กำลังแข่งขัน', val: liveMatches.length, sub: 'แมตช์สดบนคอร์ท', highlight: liveMatches.length > 0 },
          { label: 'สนามที่เปิดใช้', val: tCourts.filter((c) => c.status === 'available').length, sub: `จาก ${tCourts.length} สนาม` },
          { label: 'แมตช์รอแข่ง', val: waitingMatches.length, sub: 'พร้อมลงสนาม' },
          { label: 'ต้องดำเนินการ', val: actionTasks.reduce((s, t) => s + t.count, 0), sub: 'งานค้างตรวจสอบ' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between"
          >
            <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span
                className={`font-display text-2xl font-bold tabular-nums ${
                  kpi.highlight ? 'text-blue-600' : 'text-slate-900'
                }`}
              >
                {kpi.val}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 truncate">{kpi.sub}</span>
          </div>
        ))}
      </section>

      {/* 2-Column Operations Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Action Required */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-display text-base font-bold text-slate-900">สิ่งที่ต้องดำเนินการ</h3>
            <span className="text-xs text-slate-500 tabular-nums">{actionTasks.length} หัวข้อ</span>
          </div>

          {actionTasks.length ? (
            <div className="divide-y divide-slate-100">
              {actionTasks.map((task) => (
                <button
                  key={task.label}
                  type="button"
                  onClick={task.onClick}
                  className="w-full py-3.5 min-h-[56px] flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{task.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{task.hint}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm font-bold tabular-nums text-amber-700">
                      {task.count}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
              <div className="text-sm font-semibold text-slate-800">ไม่มีรายการค้างตรวจสอบ</div>
              <p className="text-xs text-slate-500 mt-0.5">ทุกรายการเรียบร้อยพร้อมสำหรับการแข่งขัน</p>
            </div>
          )}
        </div>

        {/* Recent Results */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-display text-base font-bold text-slate-900">ผลการแข่งขันล่าสุด</h3>
            <button
              type="button"
              onClick={() => navigate('results')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 min-h-[36px] px-2"
            >
              ดูทั้งหมด
            </button>
          </div>

          {recentMatches.length ? (
            <div className="divide-y divide-slate-100">
              {recentMatches.map((m) => {
                const winner = m.winner === m.reg_a ? m.reg_a : m.reg_b;
                const loser = m.winner === m.reg_a ? m.reg_b : m.reg_a;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEditingMatch(m)}
                    className="w-full py-3 min-h-[56px] flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {teamName(winner ? regMap[winner] : null)}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        ชนะ {teamName(loser ? regMap[loser] : null)} · {catMap[m.category_id]?.name || ''} ·{' '}
                        {m.round_label}
                      </div>
                    </div>
                    <div className="font-mono text-xs font-bold tabular-nums text-emerald-700 shrink-0">
                      {scoreText(m) || 'ชนะบาย'}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-400">
              ยังไม่มีผลการแข่งขันที่จบแล้ว
            </div>
          )}
        </div>
      </section>

      {/* Live & Upcoming Matches Table / Mobile Cards */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              แมตช์ที่กำลังแข่งและคิวถัดไป
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">แตะที่คู่แข่งขันเพื่อบันทึกคะแนนหรือปรับสนาม</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('courts')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap min-h-[40px] px-2"
          >
            จัดการสนาม
          </button>
        </div>

        {[...liveMatches, ...waitingMatches.slice(0, 6)].length ? (
          <div className="divide-y divide-slate-100">
            {[...liveMatches, ...waitingMatches.slice(0, 6)].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setEditingMatch(m)}
                className="w-full py-3.5 min-h-[60px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold tabular-nums text-slate-700">
                      {m.match_no ? `#${m.match_no}` : 'แมตช์'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{catMap[m.category_id]?.name || ''}</span>
                    <span aria-hidden="true">·</span>
                    <span>{m.round_label}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {teamName(m.reg_a ? regMap[m.reg_a] : null)}{' '}
                    <span className="font-normal text-slate-400">vs</span>{' '}
                    {teamName(m.reg_b ? regMap[m.reg_b] : null)}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs">
                  <span className="text-slate-600 tabular-nums">
                    {m.court ? `สนาม ${m.court}` : 'ยังไม่ระบุสนาม'}
                    {m.scheduled_at ? ` · ${fmtTime(m.scheduled_at)}` : ''}
                  </span>
                  {m.status === 'live' ? (
                    <span className="font-mono font-bold tabular-nums text-red-600">
                      สด {scoreText(m)}
                    </span>
                  ) : (
                    <span className="font-medium text-slate-500">รอแข่ง</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-medium text-slate-700">ยังไม่มีแมตช์ในตาราง</div>
            <button
              type="button"
              onClick={() => navigate('brackets')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              ไปที่หน้าจัดสายแข่งขัน
            </button>
          </div>
        )}
      </section>

      {/* Tournaments Quick Switcher List */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-base font-bold text-slate-900">รายการแข่งขันทั้งหมด</h3>
          <button
            type="button"
            onClick={() => navigate('tournaments')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 min-h-[36px] px-2"
          >
            จัดการรายการ
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {state.tournaments.map((t) => {
            const isActive = activeTournament?.id === t.id;
            return (
              <div
                key={t.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => setActiveTid(t.id)}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <Trophy className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-semibold truncate ${isActive ? 'text-blue-700' : 'text-slate-900'}`}>
                      {t.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 pl-6 truncate">
                    {fmtRange(t.start_date, t.end_date)} · {t.venue || 'ไม่ระบุสถานที่'} · {t.courts} สนาม
                  </div>
                </button>
                <div className="flex items-center gap-3 pl-6 sm:pl-0 shrink-0">
                  <span
                    className={`text-xs font-semibold ${
                      t.status === 'live'
                        ? 'text-red-600'
                        : t.status === 'open'
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {STATUS_TH[t.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTid(t.id);
                      navigate('tournaments');
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    เปิดจัดการ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <MatchScoreSheet match={editingMatch} onClose={() => setEditingMatch(null)} />
    </div>
  );
}
