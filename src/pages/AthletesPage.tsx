import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Plus,
  Search,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { PayStatus, RegStatus, Registration } from '../types/matchon';
import {
  baht,
  downloadCsv,
  PAY_TH,
  REG_STATUS_TH,
  teamFullName,
  teamName,
} from '../utils/bracket';
import { ResponsiveSheet } from '../components/UiKit';

export function AthletesPage() {
  const {
    activeTournament,
    tCategories,
    tRegistrations,
    catMap,
    routeParam,
    addRegistration,
    simulateRegistrations,
    updateRegistration,
  } = useMatchON();

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'slip_sent' | 'pending' | 'confirmed' | 'waitlist'>('all');
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [newReg, setNewReg] = useState({
    category_id: '',
    club: '',
    p1_name: '',
    p1_nick: '',
    p1_phone: '',
    p2_name: '',
    p2_nick: '',
  });

  useEffect(() => {
    if (routeParam === 'slip_sent' || routeParam === 'pending') {
      setQuickFilter(routeParam);
    }
  }, [routeParam]);

  if (!activeTournament) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>;
  }

  const filtered = tRegistrations.filter((r) => {
    if (catFilter && r.category_id !== catFilter) return false;
    if (quickFilter === 'slip_sent' && r.pay_status !== 'slip_sent') return false;
    if (quickFilter === 'pending' && r.status !== 'pending') return false;
    if (quickFilter === 'confirmed' && r.status !== 'confirmed') return false;
    if (quickFilter === 'waitlist' && r.status !== 'waitlist') return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.p1_name, r.p1_nick, r.p1_phone, r.p2_name, r.p2_nick, r.club].some((v) =>
      (v || '').toLowerCase().includes(q),
    );
  });

  const paidTotal = filtered
    .filter((r) => r.pay_status === 'paid')
    .reduce((sum, r) => sum + (catMap[r.category_id]?.fee || 0), 0);

  const handleExportCsv = () => {
    downloadCsv(`นักกีฬา-${activeTournament.slug}.csv`, [
      ['รุ่น', 'ทีม/ก๊วน', 'ผู้เล่น 1', 'ชื่อเล่น 1', 'เบอร์โทร', 'ผู้เล่น 2', 'สถานะ', 'การชำระเงิน', 'มือวาง'],
      ...filtered.map((r) => [
        catMap[r.category_id]?.name || '',
        r.club,
        r.p1_name,
        r.p1_nick,
        r.p1_phone,
        r.p2_name || '',
        REG_STATUS_TH[r.status],
        PAY_TH[r.pay_status],
        r.seed ?? '',
      ]),
    ]);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cid = newReg.category_id || tCategories[0]?.id;
    if (!cid || !newReg.p1_name.trim()) return;
    addRegistration(
      {
        tournament_id: activeTournament.id,
        category_id: cid,
        club: newReg.club.trim(),
        p1_name: newReg.p1_name.trim(),
        p1_nick: newReg.p1_nick.trim() || newReg.p1_name.trim().split(' ')[0],
        p1_phone: newReg.p1_phone.trim(),
        p2_name: newReg.p2_name.trim() || undefined,
        p2_nick: newReg.p2_nick.trim() || undefined,
      },
      { autoConfirm: true, payStatus: 'paid' },
    );
    setAddOpen(false);
    setNewReg({ category_id: '', club: '', p1_name: '', p1_nick: '', p1_phone: '', p2_name: '', p2_nick: '' });
  };

  const selectedCatObj = catMap[newReg.category_id || tCategories[0]?.id || ''];

  return (
    <div className="space-y-5">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">จัดการนักกีฬาและใบสมัคร</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            ทั้งหมด {tRegistrations.length} ทีม · ยอดชำระแล้วในรายการที่กรอง {baht(paidTotal)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            เพิ่มนักกีฬา
          </button>
          {tCategories[0] && (
            <button
              type="button"
              onClick={() => simulateRegistrations(catFilter || tCategories[0].id, 4)}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              จำลอง +4 ทีม
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Search & Segmented Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อนักกีฬา ชื่อเล่น เบอร์โทร หรือก๊วน..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>
          <select
            aria-label="กรองตามรุ่น"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-sm"
          >
            <option value="">ทุกรุ่น ({tCategories.length})</option>
            {tCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Horizontal Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100 rounded-xl">
          {(
            [
              ['all', `ทั้งหมด (${tRegistrations.length})`],
              ['slip_sent', `รอตรวจสลิป (${tRegistrations.filter((r) => r.pay_status === 'slip_sent').length})`],
              ['pending', `รอยืนยัน (${tRegistrations.filter((r) => r.status === 'pending').length})`],
              ['confirmed', `ยืนยันแล้ว (${tRegistrations.filter((r) => r.status === 'confirmed').length})`],
              ['waitlist', `สำรอง (${tRegistrations.filter((r) => r.status === 'waitlist').length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setQuickFilter(key)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                quickFilter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Athlete List (Mobile Tap Cards + Desktop Clean Rows) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
        {filtered.length ? (
          filtered.map((r) => {
            const cat = catMap[r.category_id];
            const needsAction = r.pay_status === 'slip_sent' || r.status === 'pending';
            return (
              <div
                key={r.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{teamName(r)}</span>
                    {r.seed != null && (
                      <span className="font-mono text-xs font-bold text-blue-700">มือวาง {r.seed}</span>
                    )}
                    {r.club && <span className="text-xs text-slate-500">· {r.club}</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {teamFullName(r)} · {cat?.name || ''} · {r.p1_phone || 'ไม่ระบุเบอร์'}
                  </div>
                  <div className="flex items-center gap-3 text-xs pt-0.5">
                    <span
                      className={`font-semibold ${
                        r.status === 'confirmed'
                          ? 'text-emerald-700'
                          : r.status === 'cancelled'
                            ? 'text-red-600'
                            : 'text-amber-700'
                      }`}
                    >
                      {REG_STATUS_TH[r.status]}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      /
                    </span>
                    <span
                      className={`font-semibold ${
                        r.pay_status === 'paid'
                          ? 'text-emerald-700'
                          : r.pay_status === 'slip_sent'
                            ? 'text-blue-600'
                            : r.pay_status === 'rejected'
                              ? 'text-red-600'
                              : 'text-slate-500'
                      }`}
                    >
                      {PAY_TH[r.pay_status]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {needsAction && (
                    <button
                      type="button"
                      onClick={() => updateRegistration(r.id, { status: 'confirmed', pay_status: 'paid' })}
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      อนุมัติ & รับยอด
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedReg(r)}
                    className="min-h-[42px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    จัดการ
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">ไม่พบข้อมูลนักกีฬาตามเงื่อนไขที่เลือก</div>
        )}
      </div>

      {/* Manage Registration Sheet */}
      <ResponsiveSheet
        open={Boolean(selectedReg)}
        onClose={() => setSelectedReg(null)}
        title={selectedReg ? teamName(selectedReg) : ''}
        subtitle={selectedReg ? `${catMap[selectedReg.category_id]?.name || ''} · ${selectedReg.club || 'ไม่ระบุก๊วน'}` : ''}
      >
        {selectedReg && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
              <div className="font-semibold text-slate-900">{teamFullName(selectedReg)}</div>
              <div className="text-slate-600">โทร: {selectedReg.p1_phone || '-'}</div>
              <div className="text-slate-600">
                ค่าสมัคร: {baht(catMap[selectedReg.category_id]?.fee || 0)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">สถานะใบสมัคร</span>
                <select
                  value={selectedReg.status}
                  onChange={(e) => {
                    const status = e.target.value as RegStatus;
                    updateRegistration(selectedReg.id, { status });
                    setSelectedReg({ ...selectedReg, status });
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {Object.entries(REG_STATUS_TH).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">สถานะการชำระเงิน</span>
                <select
                  value={selectedReg.pay_status}
                  onChange={(e) => {
                    const pay_status = e.target.value as PayStatus;
                    updateRegistration(selectedReg.id, { pay_status });
                    setSelectedReg({ ...selectedReg, pay_status });
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {Object.entries(PAY_TH).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">ลำดับมือวาง (Seed)</span>
              <input
                type="number"
                min={1}
                placeholder="เว้นว่างหากไม่ใช่มือวาง"
                value={selectedReg.seed ?? ''}
                onChange={(e) => {
                  const seed = e.target.value === '' ? null : Number(e.target.value);
                  updateRegistration(selectedReg.id, { seed });
                  setSelectedReg({ ...selectedReg, seed });
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  updateRegistration(selectedReg.id, { status: 'confirmed', pay_status: 'paid' });
                  setSelectedReg(null);
                }}
                className="inline-flex items-center justify-center gap-1.5 min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                ยืนยัน + ชำระแล้ว
              </button>
              <button
                type="button"
                onClick={() => {
                  updateRegistration(selectedReg.id, { status: 'cancelled' });
                  setSelectedReg(null);
                }}
                className="inline-flex items-center justify-center gap-1.5 min-h-[46px] rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
              >
                <XCircle className="w-4 h-4" />
                ยกเลิกใบสมัคร
              </button>
            </div>
          </div>
        )}
      </ResponsiveSheet>

      {/* Add Athlete Sheet */}
      <ResponsiveSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="เพิ่มนักกีฬา / ทีมเข้าแข่งขัน"
        subtitle="เพิ่มโดยผู้จัด สถานะจะถูกยืนยันและชำระเงินทันที"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">รุ่นการแข่งขัน</span>
            <select
              value={newReg.category_id || tCategories[0]?.id || ''}
              onChange={(e) => setNewReg({ ...newReg, category_id: e.target.value })}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              {tCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">ทีม / ก๊วน</span>
            <input
              value={newReg.club}
              onChange={(e) => setNewReg({ ...newReg, club: e.target.value })}
              placeholder="เช่น Smash Club"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">ชื่อผู้เล่น 1 *</span>
              <input
                required
                value={newReg.p1_name}
                onChange={(e) => setNewReg({ ...newReg, p1_name: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">ชื่อเล่น 1</span>
              <input
                value={newReg.p1_nick}
                onChange={(e) => setNewReg({ ...newReg, p1_nick: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">เบอร์โทร</span>
            <input
              type="tel"
              value={newReg.p1_phone}
              onChange={(e) => setNewReg({ ...newReg, p1_phone: e.target.value })}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
          </label>

          {selectedCatObj?.kind === 'doubles' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">ชื่อผู้เล่น 2</span>
                <input
                  value={newReg.p2_name}
                  onChange={(e) => setNewReg({ ...newReg, p2_name: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">ชื่อเล่น 2</span>
                <input
                  value={newReg.p2_nick}
                  onChange={(e) => setNewReg({ ...newReg, p2_nick: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
                />
              </label>
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            บันทึกผู้สมัคร
          </button>
        </form>
      </ResponsiveSheet>
    </div>
  );
}
