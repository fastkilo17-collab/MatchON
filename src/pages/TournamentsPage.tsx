import React, { useState } from 'react';
import {
  CalendarDays,
  Check,
  Edit3,
  MapPin,
  Plus,
  Star,
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
  prizeText,
  prizeLines,
} from '../utils/bracket';
import { tourStage, byNearestDate } from '../utils/bracket';
import { StageBadge, DateChip, RegMeter, TourButtons, VenueLine, CatLine } from '../components/TourCard';
import { ResponsiveSheet, ShareButton } from '../components/UiKit';
import { resizeImage } from '../lib/supabase';

export type TournamentsMode = 'list' | 'mine' | 'cats' | 'info';

export function TournamentsPage({ mode = 'list' }: { mode?: TournamentsMode } = {}) {
  const {
    state,
    profile,
    isAdmin,
    isManagerOf,
    toggleFeatured,
    activeTournament,
    setActiveTid,
    navigate,
    saveTournament,
    toggleTournamentStatus,
    deleteTournament,
    saveCategory,
    deleteCategory,
    toast,
  } = useMatchON();

  const isOrganizer = state.role === 'organizer';
  const [q, setQ] = useState('');
  const [ruleCat, setRuleCat] = useState<Category | null>(null);
  const [ruleForm, setRuleForm] = useState({ best_of: 3, points: 21, cap: 30, deuce: true });
  const [stFilter, setStFilter] = useState<'all' | TournamentStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | CategoryKind>('all');

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
    shuttle: '',
    contact: '',
    poster: '' as string,
    posters: [] as string[],
    format_text: '',
    rules_text: '',
    notice: '',
  });

  // Category modal state
  const [catManagerTid, setCatManagerTid] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catFormOpen, setCatFormOpen] = useState(false);
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
    pu: ['', '', '', ''] as string[],
    pl: ['', '', '', ''] as string[],
    format: 'knockout' as BracketFormat,
    best_of: 3,
    points: 21,
    cap: 30,
    deuce: true,
  });

  const myList = state.tournaments.filter((t) => isAdmin || (t as any).organizer_id === profile?.id || isManagerOf(t.id));
  const baseList = [...(mode === 'list' ? state.tournaments : myList)].sort(byNearestDate);
  const shownTournaments = baseList.filter((t) => {
    if (stFilter !== 'all' && tourStage(t, state.matches) !== stFilter) return false;
    if (kindFilter !== 'all' && !state.categories.some((c) => c.tournament_id === t.id && c.kind === kindFilter)) return false;
    const kw = q.trim().toLowerCase();
    if (kw && !`${t.name} ${t.venue || ''} ${t.description || ''}`.toLowerCase().includes(kw)) return false;
    return true;
  });
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
      shuttle: '',
      contact: '',
      poster: '',
      posters: [],
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
      shuttle: t.shuttle || '',
      contact: t.contact || '',
      poster: t.poster || '',
      posters: t.posters && t.posters.length ? t.posters : t.poster ? [t.poster] : [],
      format_text: t.format_text || '',
      rules_text: t.rules_text || '',
      notice: t.notice || '',
    });
    setTSheetOpen(true);
  };

  const pickPosters = async (files?: FileList | null) => {
    if (!files || !files.length) return;
    const out: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const blob = await resizeImage(f, 1100, 0.78);
        out.push(
          await new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.onerror = () => rej(new Error('อ่านรูปไม่สำเร็จ'));
            fr.readAsDataURL(blob);
          }),
        );
      } catch {
        /* ignore */
      }
    }
    setTForm((x) => ({ ...x, posters: [...x.posters, ...out].slice(0, 8) }));
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
      poster: tForm.posters[0] || null,
      posters: tForm.posters,
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
      pu: ['', '', '', ''],
      pl: ['', '', '', ''],
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
      pu: ['', '', '', ''],
      pl: ['', '', '', ''],
      best_of: opts.best_of ?? 3,
      points: opts.points ?? 21,
      cap: opts.cap ?? 30,
    }));
  };

  const loadCatForEdit = (c: Category) => {
    setCatFormOpen(true);
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
      pu: [0, 1, 2, 3].map((i) => String(c.prizes?.u?.[i] || '')),
      pl: [0, 1, 2, 3].map((i) => String(c.prizes?.l?.[i] || '')),
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
      prizes: { u: catForm.pu.map((x: string) => Number(x) || 0), l: catForm.pl.map((x: string) => Number(x) || 0) },
      format: catForm.format,
      best_of: Number(catForm.best_of) || 3,
      points: Number(catForm.points) || 21,
      cap: Number(catForm.cap) || 30,
      deuce: catForm.deuce,
    });
    setEditingCatId(null);
    setCatForm((p) => ({ ...p, name: '', level: '', age_min: '', age_max: '' }));
    setCatFormOpen(false);
  };

  const managedCategories = catManagerTid
    ? state.categories.filter((c) => c.tournament_id === catManagerTid)
    : [];

  return (
    <div className="space-y-6">
      {mode !== 'list' && (
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            {mode === 'mine' ? 'รายการของฉัน' : mode === 'cats' ? 'จัดการรุ่นการแข่งขัน' : 'ข้อมูลรายการ'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'mine' ? 'รายการที่คุณเป็นผู้จัดหรือทีมงาน กดการ์ดเพื่อเข้าหน้าหลักของรายการ' : 'เลือกรายการที่ต้องการจัดการ'}
          </p>
        </div>
      )}
      {/* Bright Airy Arena Hero Banner */}


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

        <div className="space-y-2.5">
          <div className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อรายการ / สนาม"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-4 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([['all', 'ทั้งหมด'], ['open', 'เปิดรับสมัคร'], ['closed', 'ปิดรับสมัคร'], ['announced', 'ประกาศสายแข่ง'], ['live', 'กำลังแข่งขัน'], ['finished', 'จบรายการ']] as Array<['all' | TournamentStatus, string]>).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setStFilter(k)} className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border transition-colors ${stFilter === k ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'}`}>{l}</button>
            ))}
            <span className="w-px bg-slate-200 mx-1" aria-hidden="true" />
            {([['all', 'ทุกประเภท'], ['singles', 'เดี่ยว'], ['doubles', 'คู่']] as Array<['all' | CategoryKind, string]>).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKindFilter(k)} className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border transition-colors ${kindFilter === k ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shownTournaments.map((t) => {
            const cats = state.categories.filter((c) => c.tournament_id === t.id);
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
                className={`bg-white rounded-2xl border overflow-hidden flex flex-col justify-between transition-colors cursor-pointer hover:border-blue-300 ${
                  isSelected ? 'border-blue-300 shadow-sm' : 'border-slate-200/80'
                }`}
              >
                <div className="h-40 w-full bg-gradient-to-br from-blue-600 to-blue-800 relative">
                  {(t.posters?.[0] || t.poster) ? (
                    <img src={(t.posters?.[0] || t.poster) as string} alt={t.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-white/80 font-display font-extrabold text-2xl tracking-tight px-4 text-center">{t.name}</div>
                  )}
                  <DateChip t={t} className="absolute left-3 top-3" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-display text-lg font-bold text-slate-900 min-w-0">{t.name}</h4>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        กำลังดูอยู่
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div><StageBadge t={t} /></div>
                    <VenueLine t={t} />
                    <CatLine t={t} />
                  </div>

                  {t.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{t.description}</p>
                  )}
                  <RegMeter t={t} />
                </div>

                {/* Action Row */}
                <div className="mx-5 mb-5 pt-3 border-t border-slate-100 space-y-2">
                  <TourButtons t={t} />
                  <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <ShareButton tid={t.id} name={t.name} compact onDone={(m) => toast(m)} />
                    {isAdmin && (
                      <button type="button" onClick={() => toggleFeatured(t.id)} aria-label={t.featured ? 'เอาออกจากรายการแนะนำ' : 'ตั้งเป็นรายการแนะนำ'} aria-pressed={!!t.featured} className={`min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border transition-colors ${t.featured ? 'bg-amber-50 border-amber-300 text-amber-500' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                        <Star className={`w-4 h-4 ${t.featured ? 'fill-amber-400' : ''}`} />
                      </button>
                    )}
                    {isOrganizer && (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditT(t)}
                          aria-label={`แก้ไข ${t.name}`}
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openCategoryManager(t.id)}
                          className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          รุ่น ({cats.length})
                        </button>
                      </div>
                    )}
                  </div>
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
                  if (!window.confirm(`ลบรายการ "${editingT.name}" ? ข้อมูลทั้งหมดของรายการนี้จะถูกลบ กู้คืนไม่ได้`)) return;
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
              <span className="text-xs font-semibold text-slate-700">รันแมตช์ (ทุกกี่นาที)</span>
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
              <span className="text-xs font-semibold text-slate-700">เวลาพักเหนื่อย (นาที)</span>
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
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">ลูกที่ใช้แข่ง</span>
            <input
              value={tForm.shuttle}
              onChange={(e) => setTForm({ ...tForm, shuttle: e.target.value })}
              placeholder="เช่น ลูกขนไก่ RSL Classic / Yonex AS-50"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">สถานะรายการ</span>
              <select
                value={tForm.status}
                onChange={(e) => setTForm({ ...tForm, status: e.target.value as TournamentStatus })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="open">เปิดรับสมัคร</option>
                <option value="closed">ปิดรับสมัคร (เป็น "ประกาศสายแข่ง" อัตโนมัติเมื่อสร้างสายแล้ว)</option>
                <option value="live">กำลังแข่งขัน</option>
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
            <span className="text-xs font-semibold text-slate-700">ช่องทางติดต่อสอบถาม</span>
            <input
              value={tForm.contact}
              onChange={(e) => setTForm({ ...tForm, contact: e.target.value })}
              placeholder="เช่น โทร 081-xxx-xxxx / LINE @matchon / Facebook"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">รายละเอียดเพิ่มเติม</span>
            <textarea
              rows={2}
              value={tForm.description}
              onChange={(e) => setTForm({ ...tForm, description: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">รูปโปสเตอร์ (เลือกได้หลายรูป แสดงแบบเลื่อนสไลด์)</span>
            {tForm.posters.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {tForm.posters.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden bg-slate-100 aspect-[3/4]">
                    <img src={src} alt={`โปสเตอร์ ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      aria-label="ลบรูป"
                      onClick={() => { if (window.confirm('ลบรูปนี้?')) setTForm({ ...tForm, posters: tForm.posters.filter((_, k) => k !== i) }); }}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                    {i > 0 && (
                      <button
                        type="button"
                        aria-label="เลื่อนไปก่อน"
                        onClick={() => { const a2 = [...tForm.posters]; [a2[i - 1], a2[i]] = [a2[i], a2[i - 1]]; setTForm({ ...tForm, posters: a2 }); }}
                        className="absolute bottom-1 left-1 w-7 h-7 rounded-full bg-black/60 text-white text-xs"
                      >
                        ◀
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <label className="w-full min-h-[44px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer">
              + เพิ่มรูปโปสเตอร์
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void pickPosters(e.target.files); e.target.value = ''; }} />
            </label>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-500">รุ่นที่เปิดแข่ง ({managedCategories.length})</div>
            <button
              type="button"
              onClick={() => { if (catManagerTid) openCategoryManager(catManagerTid); setCatFormOpen(true); }}
              className="min-h-[40px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              + เพิ่มรุ่น
            </button>
          </div>
          {managedCategories.length ? (
            <div className="space-y-2.5">
              {managedCategories.map((c) => (
                <div key={c.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-bold text-slate-900">{c.name} <span className="text-xs font-semibold text-blue-700">· รับ {c.max_teams} ทีม</span></div>
                    <div className="text-xs text-slate-600">{KIND_TH[c.kind]} · {GENDER_TH[c.gender]}</div>
                    <div className="text-xs text-slate-600">ระบบสาย: {FORMAT_TH[c.format]}</div>
                    <div className="text-xs text-slate-600 tabular-nums">กติกา: {c.best_of === 1 ? '1 เซต' : `${Math.ceil(c.best_of / 2)} ใน ${c.best_of} เซต`} · {c.points} แต้ม{c.deuce ? ` · ดิวซ์ (สูงสุด ${c.cap})` : ' · ไม่มีดิวซ์'}</div>
                    <button
                      type="button"
                      onClick={() => { setRuleCat(c); setRuleForm({ best_of: c.best_of, points: c.points, cap: c.cap, deuce: c.deuce }); }}
                      className="mt-1.5 min-h-[36px] px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold"
                    >
                      ตั้งค่ากติกาประจำรุ่น
                    </button>
                    <div className="text-xs text-slate-600 tabular-nums">
                      ค่าสมัคร {c.fee ? baht(c.fee) : 'ฟรี'}
                      {c.shuttle_fee ? ` · ค่าลูก ${baht(c.shuttle_fee)}` : ''}
                      {c.shuttle_qty ? ` · ${c.shuttle_qty} ลูก` : ''}
                    </div>
                    {prizeLines(c).map((ln) => (
                      <div key={ln} className="text-xs font-semibold text-amber-700 tabular-nums">🏆 {ln}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => loadCatForEdit(c)} className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => { if (window.confirm(`ลบรุ่น "${c.name}" ? ใบสมัครและแมตช์ของรุ่นนี้จะถูกลบด้วย`)) deleteCategory(c.id); }} className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 text-center">
              ยังไม่มีรุ่นการแข่งขัน กดปุ่ม "เพิ่มรุ่น" ได้เลย
            </div>
          )}
        </div>
      </ResponsiveSheet>

      {/* Add / Edit category popup */}
      <ResponsiveSheet
        open={catFormOpen}
        onClose={() => { setCatFormOpen(false); setEditingCatId(null); }}
        title={editingCatId ? 'แก้ไขรุ่น' : 'เพิ่มรุ่น'}
        subtitle={state.tournaments.find((t) => t.id === catManagerTid)?.name}
      >
        <form onSubmit={handleSaveCategory} className="space-y-3.5">
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
              <span className="text-xs font-medium text-slate-600">รับสูงสุด (ทีม)</span>
              <input type="number" min={2} value={catForm.max_teams} onChange={(e) => setCatForm({ ...catForm, max_teams: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ระบบสาย</span>
              <select
                value={catForm.format}
                onChange={(e) => setCatForm({ ...catForm, format: e.target.value as BracketFormat })}
                className="w-full min-h-[44px] px-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="knockout">น็อคเอาท์</option>
                <option value="round_robin">พบกันหมด</option>
                <option value="group_stage">แบ่งกลุ่ม</option>
                <option value="group_knockout">แบ่งกลุ่ม+น็อคเอาท์</option>
                <option value="swiss">Swiss</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ค่าสมัคร (฿)</span>
              <input type="number" min={0} value={catForm.fee} onChange={(e) => setCatForm({ ...catForm, fee: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ค่าลูกแบด (฿)</span>
              <input type="number" min={0} placeholder="เช่น 600" value={catForm.shuttle_fee} onChange={(e) => setCatForm({ ...catForm, shuttle_fee: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">จำนวนลูก</span>
              <input type="number" min={0} placeholder="เช่น 10" value={catForm.shuttle_qty} onChange={(e) => setCatForm({ ...catForm, shuttle_qty: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm tabular-nums" />
            </label>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold text-slate-700">เงินรางวัล (บาท) อันดับ 1 – 4</div>
            {([['pu', 'สายบน / รุ่นนี้'], ['pl', 'สายล่าง (ถ้ามี)']] as const).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder={`อันดับ ${i + 1}`}
                      value={(catForm as any)[k][i]}
                      onChange={(e) => {
                        const arr = [...(catForm as any)[k]];
                        arr[i] = e.target.value;
                        setCatForm({ ...catForm, [k]: arr } as any);
                      }}
                      className="w-full min-h-[40px] px-2 rounded-lg border border-slate-200 text-xs tabular-nums"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {catFormOpen && (
              <button
                type="button"
                onClick={() => { setEditingCatId(null); setCatFormOpen(false); }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
              >
                ยกเลิก
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

      {/* Per-category rules */}
      <ResponsiveSheet
        open={!!ruleCat}
        onClose={() => setRuleCat(null)}
        title={`กติกา ${ruleCat?.name || ''}`}
        subtitle="ใช้กับทุกแมตช์ของรุ่นนี้"
        footer={
          <button
            type="button"
            onClick={() => {
              if (!ruleCat) return;
              saveCategory({ ...ruleCat, best_of: ruleForm.best_of, points: Number(ruleForm.points) || 21, cap: Number(ruleForm.cap) || 30, deuce: ruleForm.deuce });
              setRuleCat(null);
            }}
            className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            บันทึกกติกา
          </button>
        }
      >
        <div className="space-y-4">
          {state.rules.filter((r) => r.tournament_id === catManagerTid).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-500">เลือกจากชุดกติกาที่มี</div>
              <div className="flex flex-wrap gap-1.5">
                {state.rules.filter((r) => r.tournament_id === catManagerTid).map((r) => (
                  <button key={r.id} type="button" onClick={() => setRuleForm({ best_of: r.best_of, points: r.points, cap: r.cap, deuce: r.deuce })} className="min-h-[36px] px-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 text-xs font-semibold text-slate-700">{r.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500">จำนวนเซต</div>
            <div className="flex gap-1.5">
              {[1, 3, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRuleForm({ ...ruleForm, best_of: n })} className={`flex-1 min-h-[42px] rounded-xl text-xs font-semibold border ${ruleForm.best_of === n ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>{n === 1 ? '1 เซต' : `${Math.ceil(n / 2)} ใน ${n} เซต`}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-slate-500">แต้มต่อเซต</span>
              <input type="number" inputMode="numeric" value={ruleForm.points} onChange={(e) => setRuleForm({ ...ruleForm, points: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white" />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-slate-500">แต้มสูงสุด (Cap)</span>
              <input type="number" inputMode="numeric" value={ruleForm.cap} onChange={(e) => setRuleForm({ ...ruleForm, cap: Number(e.target.value) })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white" />
            </label>
          </div>
          <label className="flex items-center gap-2.5 min-h-[44px] text-sm font-semibold text-slate-800">
            <input type="checkbox" checked={ruleForm.deuce} onChange={(e) => setRuleForm({ ...ruleForm, deuce: e.target.checked })} className="w-5 h-5" />
            มีดิวซ์ (ต้องนำ 2 แต้ม)
          </label>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
