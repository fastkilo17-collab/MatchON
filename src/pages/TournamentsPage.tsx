import React, { useState } from 'react';
import {
  CalendarDays,
  Check,
  Edit3,
  MapPin,
  Plus,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { BracketFormat, Category, CategoryGender, CategoryKind, Tournament, TournamentStatus } from '../types/matchon';
import {
  baht,
  CATEGORY_PRESETS,
  fmtRange,
  FORMAT_TH,
  GENDER_TH,
  KIND_TH,
  STATUS_TH,
  catTotal,
  shuttleText,
} from '../utils/bracket';
import { ResponsiveSheet } from '../components/UiKit';
import { resizeImage } from '../lib/supabase';

export type TournamentsMode = 'list' | 'mine' | 'cats' | 'info';

export function TournamentsPage({ mode = 'list' }: { mode?: TournamentsMode } = {}) {
  const {
    state,
    profile,
    isAdmin,
    isManagerOf,
    activeTournament,
    setActiveTid,
    navigate,
    saveTournament,
    toggleTournamentStatus,
    deleteTournament,
    saveCategory,
    deleteCategory,
  } = useMatchON();

  const isOrganizer = state.role === 'organizer';
  const [heroImgErr, setHeroImgErr] = useState(false);

  // Tournament modal state
  const [tSheetOpen, setTSheetOpen] = useState(false);
  const [editingT, setEditingT] = useState<Tournament | null>(null);
  const [tForm, setTForm] = useState({
    name: '',
    venue: '',
    description: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reg_deadline: new Date().toISOString().slice(0, 10) + 'T23:59',
    courts: 4,
    status: 'open' as TournamentStatus,
    promptpay_id: '',
    match_minutes: 30,
    rest_minutes: 15,
    poster: '' as string,
    format_text: '',
    rules_text: '',
    notice: '',
  });

  // Category modal state
  const [catManagerTid, setCatManagerTid] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({
    name: '',
    kind: 'singles' as CategoryKind,
    gender: 'male' as CategoryGender,
    level: '',
    age_min: '',
    age_max: '',
    max_teams: 16,
    fee: 450,
    shuttle_fee: 0,
    shuttle_qty: 0,
    format: 'knockout' as BracketFormat,
    best_of: 3,
    points: 21,
    cap: 30,
    deuce: true,
  });

  const myList = state.tournaments.filter((t) => isAdmin || (t as any).organizer_id === profile?.id || isManagerOf(t.id));
  const shownTournaments = mode === 'list' ? state.tournaments : myList;
  const openCard = (t: Tournament) => {
    setActiveTid(t.id);
    if (mode === 'cats') openCategoryManager(t.id);
    else if (mode === 'info') openEditT(t);
    else navigate('home');
  };
  const closeSheets = () => {
    setTSheetOpen(false);
    setCatManagerTid(null);
    if (mode === 'cats' || mode === 'info') navigate('home');
  };
  React.useEffect(() => {
    if (!activeTournament || !myList.some((x) => x.id === activeTournament.id)) return;
    if (mode === 'cats') openCategoryManager(activeTournament.id);
    else if (mode === 'info') openEditT(activeTournament);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeTournament?.id]);

  const openCreateT = () => {
    setEditingT(null);
    const today = new Date().toISOString().slice(0, 10);
    setTForm({
      name: '',
      venue: '',
      description: '',
      start_date: today,
      end_date: today,
      reg_deadline: today + 'T23:59',
      courts: 4,
      status: 'open',
      promptpay_id: '081-234-5678',
      match_minutes: 30,
      rest_minutes: 15,
      poster: '',
      format_text: '',
      rules_text: '',
      notice: '',
    });
    setTSheetOpen(true);
  };

  const openEditT = (t: Tournament) => {
    setEditingT(t);
    setTForm({
      name: t.name,
      venue: t.venue,
      description: t.description,
      start_date: t.start_date,
      end_date: t.end_date,
      reg_deadline: t.reg_deadline.length > 10 ? t.reg_deadline : (t.reg_deadline || new Date().toISOString().slice(0, 10)) + 'T23:59',
      courts: t.courts,
      status: t.status,
      promptpay_id: t.promptpay_id,
      match_minutes: t.match_minutes,
      rest_minutes: t.rest_minutes,
      poster: t.poster || '',
      format_text: t.format_text || '',
      rules_text: t.rules_text || '',
      notice: t.notice || '',
    });
    setTSheetOpen(true);
  };

  const pickPoster = async (f?: File | null) => {
    if (!f) return;
    try {
      const blob = await resizeImage(f, 1100, 0.78);
      const uri: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error('อ่านรูปไม่สำเร็จ'));
        fr.readAsDataURL(blob);
      });
      setTForm((x) => ({ ...x, poster: uri }));
    } catch {
      /* ignore */
    }
  };

  const handleSaveT = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tForm.name.trim()) return;
    saveTournament({
      id: editingT?.id,
      ...tForm,
      name: tForm.name.trim(),
      venue: tForm.venue.trim(),
      description: tForm.description.trim(),
      poster: tForm.poster || null,
      format_text: tForm.format_text.trim(),
      rules_text: tForm.rules_text.trim(),
      notice: tForm.notice.trim(),
    });
    setTSheetOpen(false);
  };

  const openCategoryManager = (tid: string) => {
    setCatManagerTid(tid);
    setEditingCatId(null);
    setCatForm({
      name: '',
      kind: 'singles',
      gender: 'male',
      level: '',
      age_min: '',
      age_max: '',
      max_teams: 16,
      fee: 450,
      shuttle_fee: 0,
      shuttle_qty: 0,
      format: 'knockout',
      best_of: 3,
      points: 21,
      cap: 30,
      deuce: true,
    });
  };

  const applyPreset = (idx: number) => {
    const [label, opts] = CATEGORY_PRESETS[idx];
    setCatForm((prev) => ({
      ...prev,
      name: label,
      kind: opts.kind || 'singles',
      gender: opts.gender || 'open',
      level: opts.level || '',
      age_min: opts.age_min != null ? String(opts.age_min) : '',
      age_max: opts.age_max != null ? String(opts.age_max) : '',
      fee: opts.fee ?? 450,
      shuttle_fee: 0,
      shuttle_qty: 0,
      best_of: opts.best_of ?? 3,
      points: opts.points ?? 21,
      cap: opts.cap ?? 30,
    }));
  };

  const loadCatForEdit = (c: Category) => {
    setEditingCatId(c.id);
    setCatForm({
      name: c.name,
      kind: c.kind,
      gender: c.gender,
      level: c.level || '',
      age_min: c.age_min != null ? String(c.age_min) : '',
      age_max: c.age_max != null ? String(c.age_max) : '',
      max_teams: c.max_teams,
      fee: c.fee,
      shuttle_fee: c.shuttle_fee || 0,
      shuttle_qty: c.shuttle_qty || 0,
      format: c.format,
      best_of: c.best_of,
      points: c.points,
      cap: c.cap,
      deuce: c.deuce,
    });
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catManagerTid || !catForm.name.trim()) return;
    saveCategory({
      id: editingCatId || undefined,
      tournament_id: catManagerTid,
      name: catForm.name.trim(),
      kind: catForm.kind,
      gender: catForm.gender,
      level: catForm.level.trim() || null,
      age_min: catForm.age_min === '' ? null : Number(catForm.age_min),
      age_max: catForm.age_max === '' ? null : Number(catForm.age_max),
      max_teams: Number(catForm.max_teams) || 16,
      fee: Number(catForm.fee) || 0,
      shuttle_fee: Number(catForm.shuttle_fee) || 0,
      shuttle_qty: Number(catForm.shuttle_qty) || 0,
      format: catForm.format,
      best_of: Number(catForm.best_of) || 3,
      points: Number(catForm.points) || 21,
      cap: Number(catForm.cap) || 30,
      deuce: catForm.deuce,
    });
    setEditingCatId(null);
    setCatForm((p) => ({ ...p, name: '', level: '', age_min: '', age_max: '' }));
  };

  const managedCategories = catManagerTid
    ? state.categories.filter((c) => c.tournament_id === catManagerTid)
    : [];

  return (
    <div className="space-y-6">
      {mode !== 'list' && (
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            {mode === 'mine' ? 'รายการจัดแข่งขันของฉัน' : mode === 'cats' ? 'จัดการรุ่นการแข่งขัน' : 'ข้อมูลรายการ'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'mine' ? 'รายการที่คุณเป็นผู้จัดหรือทีมงาน กดการ์ดเพื่อเข้าหน้าหลักของรายการ' : 'เลือกรายการที่ต้องการจัดการ'}
          </p>
        </div>
      )}
      {/* Bright Airy Arena Hero Banner */}
      {mode === 'list' && <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-5">
            <div className="space-y-2.5 max-w-xl">
              <div className="text-xs font-semibold text-blue-600">
                MatchON · แพลตฟอร์มจัดแข่งแบดมินตัน
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                จัดการแข่งขันแบดมินตันครบวงจรในหน้าเดียว
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                เปิดรับสมัครนักกีฬา จัดสายอัตโนมัติ วางตารางสนามแบบไม่ชนกัน และอัปเดต Live Score
                แบบเรียลไทม์จากมือถือได้ทันที
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isOrganizer ? (
                <button
                  type="button"
                  onClick={openCreateT}
                  className="inline-flex items-center gap-2 min-h-[46px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/15"
                >
                  <Plus className="w-4 h-4" />
                  สร้างรายการแข่งขันใหม่
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('register')}
                  className="inline-flex items-center gap-2 min-h-[46px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/15"
                >
                  สมัครแข่งขันเลย
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('live')}
                className="inline-flex items-center gap-2 min-h-[46px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold transition-colors"
              >
                ดูคะแนนสด (Live Score)
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 min-h-[190px] lg:min-h-[260px] bg-slate-100 relative overflow-hidden">
            {!heroImgErr ? (
              <img
                src={`${import.meta.env.BASE_URL}src/assets/images/hero_badminton_court_1794832771334.jpg`}
                alt="สนามแบดมินตันในร่มโทนสว่าง"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgErr(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
                <Trophy className="w-12 h-12 text-blue-600/40" />
              </div>
            )}
          </div>
        </div>
      </section>}

      {/* Tournaments Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-slate-900">
            {mode === 'list' ? 'รายการแข่งขัน' : 'รายการของฉัน'} ({shownTournaments.length})
          </h3>
          {isOrganizer && (
            <button
              type="button"
              onClick={openCreateT}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              เพิ่มรายการ
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shownTournaments.map((t) => {
            const cats = state.categories.filter((c) => c.tournament_id === t.id);
            const regs = state.registrations.filter(
              (r) => r.tournament_id === t.id && r.status !== 'cancelled' && r.status !== 'rejected',
            );
            const isSelected = activeTournament?.id === t.id;

            return (
              <article
                key={t.id}
                role="link"
                tabIndex={0}
                onClick={() => openCard(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openCard(t);
                }}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer hover:border-blue-300 ${
                  isSelected ? 'border-blue-300 shadow-sm' : 'border-slate-200/80'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span
                          className={
                            t.status === 'live'
                              ? 'text-red-600'
                              : t.status === 'open'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                          }
                        >
                          {STATUS_TH[t.status]}
                        </span>
                      </div>
                      <h4 className="font-display text-lg font-bold text-slate-900 mt-1">{t.name}</h4>
                    </div>

                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        กำลังดูอยู่
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{fmtRange(t.start_date, t.end_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{t.venue || 'ไม่ระบุสนาม'} · <span className="tabular-nums">{t.courts} สนาม</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="tabular-nums">
                        {cats.length} รุ่น{cats.length ? ` (${cats.map((c) => c.name).join(', ')})` : ''} • {regs.length} ทีมที่สมัคร
                      </span>
                    </div>
                  </div>

                  {t.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{t.description}</p>
                  )}
                </div>

                {/* Action Row */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {t.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => navigate('register', { regTid: t.id })}
                      className="min-h-[42px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      สมัครแข่งขัน
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTid(t.id);
                      navigate('schedule');
                    }}
                    className="min-h-[42px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    ตารางแข่ง
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTid(t.id);
                      navigate('results');
                    }}
                    className="min-h-[42px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    ผลการแข่งขัน
                  </button>

                  {isOrganizer && (
                    <>
                      <button
                        type="button"
                        onClick={() => openCategoryManager(t.id)}
                        className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        รุ่น ({cats.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditT(t)}
                        aria-label={`แก้ไข ${t.name}`}
                        className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors ml-auto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Create / Edit Tournament Sheet */}
      <ResponsiveSheet
        open={tSheetOpen}
        onClose={closeSheets}
        title={editingT ? 'แก้ไขรายการแข่งขัน' : 'สร้างรายการแข่งขันใหม่'}
        subtitle="กำหนดชื่อรายการ สถานที่ จำนวนสนาม และเวลาแข่ง"
        footer={
          <div className="flex items-center gap-2.5">
            {editingT && (
              <button
                type="button"
                onClick={() => {
                  deleteTournament(editingT.id);
                  setTSheetOpen(false);
                }}
                className="min-h-[46px] px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold transition-colors"
              >
                ลบรายการ
              </button>
            )}
            <button
              type="button"
              onClick={() => setTSheetOpen(false)}
              className="flex-1 min-h-[46px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="t-form"
              className="flex-[2] min-h-[46px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              บันทึก
            </button>
          </div>
        }
      >
        <form id="t-form" onSubmit={handleSaveT} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">ชื่อรายการแข่งขัน *</span>
            <input
              required
              value={tForm.name}
              onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
              placeholder="เช่น MatchON Badminton Open 2026"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">สนาม / สถานที่</span>
            <input
              value={tForm.venue}
              onChange={(e) => setTForm({ ...tForm, venue: e.target.value })}
              placeholder="เช่น สปอร์ตคอมเพล็กซ์ พระราม 9"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">ปิดรับสมัคร (วัน-เวลา)</span>
            <input
              type="datetime-local"
              value={tForm.reg_deadline}
              onChange={(e) => setTForm({ ...tForm, reg_deadline: e.target.value })}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">วันเริ่มแข่ง</span>
              <input
                type="date"
                value={tForm.start_date}
                onChange={(e) => setTForm({ ...tForm, start_date: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">วันสิ้นสุด</span>
              <input
                type="date"
                value={tForm.end_date}
                onChange={(e) => setTForm({ ...tForm, end_date: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">จำนวนสนาม</span>
              <input
                type="number"
                min={1}
                max={20}
                value={tForm.courts}
                onChange={(e) => setTForm({ ...tForm, courts: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">เวลา/แมตช์ (นาที)</span>
              <input
                type="number"
                min={10}
                max={90}
                value={tForm.match_minutes}
                onChange={(e) => setTForm({ ...tForm, match_minutes: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">เวลาพัก (นาที)</span>
              <input
                type="number"
                min={0}
                max={60}
                value={tForm.rest_minutes}
                onChange={(e) => setTForm({ ...tForm, rest_minutes: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">สถานะรายการ</span>
              <select
                value={tForm.status}
                onChange={(e) => setTForm({ ...tForm, status: e.target.value as TournamentStatus })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="open">เปิดรับสมัคร</option>
                <option value="live">กำลังแข่งขัน</option>
                <option value="closed">ปิดรับสมัคร</option>
                <option value="draft">ฉบับร่าง</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">PromptPay รับเงิน</span>
              <input
                value={tForm.promptpay_id}
                onChange={(e) => setTForm({ ...tForm, promptpay_id: e.target.value })}
                placeholder="081-xxx-xxxx"
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">รายละเอียดเพิ่มเติม</span>
            <textarea
              rows={2}
              value={tForm.description}
              onChange={(e) => setTForm({ ...tForm, description: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">รูปโปสเตอร์</span>
            {tForm.poster && <img src={tForm.poster} alt="โปสเตอร์" className="w-full max-h-64 object-contain rounded-xl bg-slate-100" />}
            <div className="flex gap-2">
              <label className="flex-1 min-h-[44px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer">
                {tForm.poster ? 'เปลี่ยนรูป' : 'เลือกรูปโปสเตอร์'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickPoster(e.target.files?.[0])} />
              </label>
              {tForm.poster && (
                <button type="button" onClick={() => setTForm({ ...tForm, poster: '' })} className="min-h-[44px] px-4 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">ลบรูป</button>
              )}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">รูปแบบการแข่งขัน</span>
            <textarea rows={3} value={tForm.format_text} onChange={(e) => setTForm({ ...tForm, format_text: e.target.value })} placeholder="เช่น แบ่งกลุ่มเก็บแต้ม แล้วเข้ารอบน็อคเอาท์ 8 ทีม" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">รายละเอียดกติกา</span>
            <textarea rows={3} value={tForm.rules_text} onChange={(e) => setTForm({ ...tForm, rules_text: e.target.value })} placeholder="เช่น 2 เซต เซตละ 21 แต้ม ลูกที่ใช้ ฯลฯ" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">เงื่อนไขที่ต้องแจ้งให้นักกีฬาทราบ</span>
            <textarea rows={3} value={tForm.notice} onChange={(e) => setTForm({ ...tForm, notice: e.target.value })} placeholder="เช่น มาถึงก่อนเวลา 30 นาที ชุดแข่งต้องสุภาพ ฯลฯ" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none" />
          </label>
          {editingT && (
            <button
              type="button"
              onClick={() => toggleTournamentStatus(editingT.id)}
              className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
            >
              สลับสถานะเปิด / ปิดรับสมัครทันที
            </button>
          )}
        </form>
      </ResponsiveSheet>

      {/* Category Manager Sheet */}
      <ResponsiveSheet
        open={Boolean(catManagerTid)}
        onClose={closeSheets}
        title="จัดการรุ่นการแข่งขัน"
        subtitle={state.tournaments.find((t) => t.id === catManagerTid)?.name}
      >
        {/* Existing Categories */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">
            รุ่นที่เปิดแข่ง ({managedCategories.length})
          </div>
          {managedCategories.length ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {managedCategories.map((c) => (
                <div key={c.id} className="p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5 tabular-nums">
                      {KIND_TH[c.kind]} · {GENDER_TH[c.gender]} · {FORMAT_TH[c.format]} ·{' '}
                      {c.fee ? baht(c.fee) : 'ฟรี'}{c.shuttle_fee ? ` + ${shuttleText(c)}` : ''} · รับ {c.max_teams} ทีม
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => loadCatForEdit(c)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(c.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 text-center">
              ยังไม่มีรุ่นการแข่งขัน เลือกจากตัวช่วยด่วนด้านล่างได้เลย
            </div>
          )}
        </div>

        {/* Presets & Add/Edit Form */}
        <form onSubmit={handleSaveCategory} className="space-y-3.5 pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700">
            {editingCatId ? 'แก้ไขรุ่นการแข่งขัน' : 'เพิ่มรุ่นใหม่ (หรือแตะตัวช่วยด่วน)'}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {CATEGORY_PRESETS.map(([label], i) => (
              <button
                key={label}
                type="button"
                onClick={() => applyPreset(i)}
                className="min-h-[36px] px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 transition-colors"
              >
                + {label}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">ชื่อรุ่น *</span>
            <input
              required
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              placeholder="เช่น ชายคู่ มือ P"
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ประเภท</span>
              <select
                value={catForm.kind}
                onChange={(e) => setCatForm({ ...catForm, kind: e.target.value as CategoryKind })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="singles">เดี่ยว</option>
                <option value="doubles">คู่</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">เพศ</span>
              <select
                value={catForm.gender}
                onChange={(e) => setCatForm({ ...catForm, gender: e.target.value as CategoryGender })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
                <option value="mixed">ผสม</option>
                <option value="open">ทั่วไป</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ค่าลูกแบด (฿) เช่น 600</span>
              <input type="number" min={0} value={catForm.shuttle_fee} onChange={(e) => setCatForm({ ...catForm, shuttle_fee: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">จำนวนลูกแบด (ลูก) เช่น 10</span>
              <input type="number" min={0} value={catForm.shuttle_qty} onChange={(e) => setCatForm({ ...catForm, shuttle_qty: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ค่าสมัคร (฿)</span>
              <input
                type="number"
                min={0}
                value={catForm.fee}
                onChange={(e) => setCatForm({ ...catForm, fee: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">รับสูงสุด (ทีม)</span>
              <input
                type="number"
                min={2}
                value={catForm.max_teams}
                onChange={(e) => setCatForm({ ...catForm, max_teams: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ระบบสาย</span>
              <select
                value={catForm.format}
                onChange={(e) => setCatForm({ ...catForm, format: e.target.value as BracketFormat })}
                className="w-full min-h-[44px] px-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="knockout">แพ้คัดออก</option>
                <option value="round_robin">พบกันหมด</option>
                <option value="group_stage">แบ่งกลุ่ม</option>
                <option value="group_knockout">แบ่งกลุ่ม+ไขว้สาย</option>
                <option value="swiss">Swiss</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editingCatId && (
              <button
                type="button"
                onClick={() => setEditingCatId(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
              >
                ยกเลิกแก้ไข
              </button>
            )}
            <button
              type="submit"
              className="flex-1 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              {editingCatId ? 'บันทึกการแก้ไขรุ่น' : '+ เพิ่มรุ่นนี้'}
            </button>
          </div>
        </form>
      </ResponsiveSheet>
    </div>
  );
}
