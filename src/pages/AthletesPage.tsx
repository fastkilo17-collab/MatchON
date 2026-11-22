import { RosterPage } from './RosterPage';
import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Plus,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { photoUrl, uploadPhoto } from '../lib/supabase';
import type { PayStatus, RegStatus, Registration } from '../types/matchon';
import {
  baht,
  downloadCsv,
  PAY_TH,
  REG_STATUS_TH,
  teamFullName,
  teamName,
  catTotal,
  shuttleText,
  regSeqMap,
  byRegTime,
  teamRealWithNick,
  playersNick,
} from '../utils/bracket';
import { slipSignedUrl } from '../lib/db';
import { PhotoThumb, PhotoLightbox, ResponsiveSheet } from '../components/UiKit';

function ManageAthletes() {
  const {
    activeTournament,
    tCategories,
    tRegistrations,
    catMap,
    routeParam,
    addRegistration,
    simulateRegistrations,
    toast,
    updateRegistration,
    deleteRegistration,
  } = useMatchON();

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'slip_sent' | 'pending' | 'confirmed' | 'waitlist'>('all');
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Registration | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [slipSrc, setSlipSrc] = useState<string | null>(null);
  const openSlip = async (path: string) => {
    try { setSlipSrc(await slipSignedUrl(path)); } catch (e: any) { toast(e?.message || 'เปิดสลิปไม่ได้', 'err'); }
  };
  const openReg = (r: Registration) => { setSelectedReg(r); setDraft({ ...r }); setConfirmDel(false); };
  const closeReg = () => { setSelectedReg(null); setDraft(null); setConfirmDel(false); };

  const [f1, setF1] = useState<File | null>(null);
  const [f2, setF2] = useState<File | null>(null);
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

  const seq = regSeqMap(tRegistrations);
  const filtered = [...tRegistrations].sort(byRegTime).filter((r) => {
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
    .reduce((sum, r) => sum + catTotal(catMap[r.category_id]), 0);

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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = newReg.category_id || tCategories[0]?.id;
    if (!cid || !newReg.p1_name.trim()) return;
    const hasP2 = !!newReg.p2_name.trim();
    if (!f1 || (hasP2 && !f2)) {
      toast('กรุณาแนบรูปนักกีฬาให้ครบ (บังคับ)', 'err');
      return;
    }
    try {
      const tid = activeTournament.id;
      const ph1 = await uploadPhoto('photos', tid, f1);
      const ph2 = hasP2 && f2 ? await uploadPhoto('photos', tid, f2) : null;
      await addRegistration(
        {
          tournament_id: tid,
          category_id: cid,
          club: newReg.club.trim(),
          p1_name: newReg.p1_name.trim(),
          p1_nick: newReg.p1_nick.trim() || newReg.p1_name.trim().split(' ')[0],
          p1_phone: newReg.p1_phone.trim(),
          p1_photo: ph1,
          p2_name: newReg.p2_name.trim() || undefined,
          p2_nick: newReg.p2_nick.trim() || undefined,
          p2_photo: ph2,
        },
        { autoConfirm: true, payStatus: 'paid' },
      );
    } catch (err: any) {
      toast(err?.message || 'อัปโหลดรูปไม่สำเร็จ', 'err');
      return;
    }
    setAddOpen(false);
    setF1(null);
    setF2(null);
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
              ['pending', `รอประเมิน (${tRegistrations.filter((r) => r.status === 'pending').length})`],
              ['confirmed', `ผ่าน (${tRegistrations.filter((r) => r.status === 'confirmed').length})`],
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
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openReg(r)}
                onKeyDown={(e) => { if (e.key === 'Enter') openReg(r); }}
                className="p-3.5 flex items-center gap-3 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <span className="w-7 shrink-0 text-center font-mono text-xs font-bold text-slate-400 tabular-nums">{seq[r.id]}</span>
                <div className="flex -space-x-3 shrink-0">
                  {[r.p1_photo, r.p2_photo].filter(Boolean).map((ph, i) => (
                    <PhotoThumb key={i} photo={ph} name={i === 0 ? r.p1_name : r.p2_name} size={42} />
                  ))}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {r.club || playersNick(r)}{cat ? <span className="font-semibold text-slate-500"> • {cat.name}</span> : null}
                    {r.seed != null && <span className="font-mono text-xs font-bold text-blue-700"> · มือวาง {r.seed}</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{teamRealWithNick(r)}</div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${r.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : r.status === 'cancelled' || r.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{REG_STATUS_TH[r.status]}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${r.pay_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : r.pay_status === 'slip_sent' ? 'bg-blue-50 text-blue-700' : r.pay_status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{PAY_TH[r.pay_status]}</span>
                    {r.slip_path && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void openSlip(r.slip_path!); }}
                        className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700"
                      >
                        ดูสลิป
                      </button>
                    )}
                    {r.note && <span className="text-[11px] text-slate-500 truncate">📝 {r.note}</span>}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">ไม่พบข้อมูลนักกีฬาตามเงื่อนไขที่เลือก</div>
        )}
      </div>

      {/* Manage Registration Sheet (แก้ใน draft แล้วกด "บันทึก" ถึงจะอัปเดตจริง) */}
      <ResponsiveSheet
        open={Boolean(selectedReg)}
        onClose={closeReg}
        title={selectedReg ? teamName(selectedReg) : ''}
        subtitle={selectedReg ? `#${seq[selectedReg.id] || ''} · ${catMap[selectedReg.category_id]?.name || ''} · ${selectedReg.club || 'ไม่ระบุก๊วน'}` : ''}
      >
        {selectedReg && draft && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
              <div className="font-semibold text-slate-900">{teamRealWithNick(selectedReg)}</div>
              <div className="text-slate-600">โทร: {selectedReg.p1_phone || '-'}</div>
              <div className="text-slate-600">
                ค่าสมัคร: {baht(catTotal(catMap[selectedReg.category_id]))}{catMap[selectedReg.category_id]?.shuttle_fee ? ` (รวม ${shuttleText(catMap[selectedReg.category_id])})` : ''}
              </div>
              {selectedReg.slip_path && (
                <button type="button" onClick={() => void openSlip(selectedReg.slip_path!)} className="mt-1 min-h-[34px] px-3 rounded-lg bg-violet-100 text-violet-700 font-semibold">
                  ดูสลิปโอนเงิน
                </button>
              )}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">รุ่นที่สมัคร</span>
              <select
                value={draft.category_id}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
              >
                {tCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {draft.category_id !== selectedReg.category_id && (
                <span className="block text-[11px] text-amber-700">ย้ายรุ่น: ถ้ารุ่นเดิมจัดสายไปแล้ว ควรล้างสาย/จัดสายใหม่ และค่าสมัครจะเปลี่ยนตามรุ่นใหม่</span>
              )}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">สถานะใบสมัคร</span>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as RegStatus })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {Object.entries(REG_STATUS_TH).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">สถานะการชำระเงิน</span>
                <select
                  value={draft.pay_status}
                  onChange={(e) => setDraft({ ...draft, pay_status: e.target.value as PayStatus })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {Object.entries(PAY_TH).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">หมายเหตุ (ผู้สมัครเห็นข้อความนี้)</span>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="เช่น เหตุผลที่ไม่ผ่าน / สิ่งที่ต้องแก้ไข"
                value={draft.note ?? ''}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">ลำดับมือวาง (Seed)</span>
              <input
                type="number"
                min={1}
                placeholder="เว้นว่างหากไม่ใช่มือวาง"
                value={draft.seed ?? ''}
                onChange={(e) => setDraft({ ...draft, seed: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>

            {confirmDel ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                <div className="text-xs font-semibold text-red-700">ยืนยันลบใบสมัคร "{teamName(selectedReg)}" ? ลบแล้วกู้คืนไม่ได้</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmDel(false)} className="min-h-[42px] rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700">ไม่ลบ</button>
                  <button
                    type="button"
                    onClick={async () => { if (await deleteRegistration(selectedReg.id)) closeReg(); }}
                    className="min-h-[42px] rounded-xl bg-red-600 text-white text-xs font-semibold"
                  >
                    ลบเลย
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    updateRegistration(selectedReg.id, { category_id: draft.category_id, status: draft.status, pay_status: draft.pay_status, note: draft.note, seed: draft.seed });
                    closeReg();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDel(true)}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[46px] rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                >
                  <XCircle className="w-4 h-4" />
                  ลบใบสมัคร
                </button>
              </div>
            )}
          </div>
        )}
      </ResponsiveSheet>
      <PhotoLightbox src={slipSrc} caption="สลิปโอนเงิน" onClose={() => setSlipSrc(null)} />

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
          <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 cursor-pointer">
            <span className="text-xs font-semibold text-slate-700">รูปผู้เล่น 1 * {f1 ? '✓ ' + f1.name : '(แตะเพื่อเลือกรูป)'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setF1(e.target.files?.[0] || null)} />
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 cursor-pointer">
            <span className="text-xs font-semibold text-slate-700">รูปผู้เล่น 2 (ถ้ามีผู้เล่น 2) * {f2 ? '✓ ' + f2.name : '(แตะเพื่อเลือกรูป)'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setF2(e.target.files?.[0] || null)} />
          </label>

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

/** หน้าเดียว: ผู้จัดเห็นหน้าจัดการ, คนอื่นเห็นรายชื่ออ่านอย่างเดียว */
export function AthletesPage() {
  const { activeTournament, isManagerOf } = useMatchON();
  return activeTournament && isManagerOf(activeTournament.id) ? <ManageAthletes /> : <RosterPage />;
}
