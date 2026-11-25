import React from 'react';
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { PhotoThumb } from './UiKit';
import { deleteModel, saveModel, uploadModelPhoto, useModels, type AthleteModel } from '../lib/models';
import type { Tournament } from '../types/matchon';

/** ผู้จัดของรายการนี้แก้ไขโมเดลได้ (ฐานข้อมูลตรวจสิทธิ์อีกชั้น) */
export function useCanEditModels(t: Tournament | null | undefined): boolean {
  const { state, profile, isAdmin, isManagerOf } = useMatchON();
  if (!t) return false;
  return state.role === 'organizer' && (isAdmin || (t as any).organizer_id === profile?.id || isManagerOf(t.id));
}

/** แสดงโมเดลแยกตามรุ่น (นักกีฬาดูได้อย่างเดียว / ผู้จัดเพิ่ม-แก้ไข-ลบได้) */
export function ModelsView({ tournament, editable }: { tournament: Tournament; editable: boolean }) {
  const { state, toast } = useMatchON();
  const { items, loading, reload } = useModels(tournament.id);
  const cats = state.categories.filter((c) => c.tournament_id === tournament.id);
  const [form, setForm] = React.useState<Partial<AthleteModel> | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!form || !form.name?.trim()) { toast('กรอกชื่อนักกีฬาตัวอย่าง', 'err'); return; }
    setBusy(true);
    try {
      await saveModel({ ...form, tournament_id: tournament.id, name: form.name });
      setForm(null);
      await reload();
      toast('บันทึกแล้ว');
    } catch (e: any) { toast(e?.message || 'บันทึกไม่สำเร็จ', 'err'); }
    setBusy(false);
  };
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const url = await uploadModelPhoto(tournament.id, f); setForm((p) => (p ? { ...p, photo: url } : p)); }
    catch (e: any) { toast(e?.message || 'อัปโหลดรูปไม่สำเร็จ', 'err'); }
    setBusy(false);
  };
  const remove = async (m: AthleteModel) => {
    if (!window.confirm(`ลบ "${m.name}" ?`)) return;
    try { await deleteModel(m.id); await reload(); } catch (e: any) { toast(e?.message || 'ลบไม่สำเร็จ', 'err'); }
  };

  const groups = [...cats.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null as string | null, name: 'ทุกรุ่น / อื่นๆ' }];

  return (
    <div className="space-y-5">
      {loading && <div className="text-sm text-slate-400">กำลังโหลด…</div>}
      {groups.map((g) => {
        const list = items.filter((m) => (m.category_id || null) === g.id);
        if (!list.length && !editable) return null;
        if (!list.length && g.id === null) return null;
        return (
          <section key={g.id || 'none'} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display font-bold text-slate-900">{g.name}</h4>
              {editable && (
                <button type="button" onClick={() => setForm({ category_id: g.id, name: '' })} className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" /> เพิ่ม
                </button>
              )}
            </div>
            {list.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {list.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-slate-200/80 bg-white p-3 flex flex-col items-center text-center gap-1.5 min-w-0">
                    <PhotoThumb photo={m.photo} name={m.name} size={64} />
                    <div className="min-w-0 w-full leading-tight">
                      <div className="text-sm font-semibold text-slate-900 truncate">{m.name}</div>
                      <div className="text-xs text-slate-500 truncate">{m.nick || '-'}</div>
                      {m.note && <div className="text-[11px] text-amber-700 bg-amber-50 rounded-md px-1.5 py-0.5 mt-1 line-clamp-2">{m.note}</div>}
                    </div>
                    {editable && (
                      <div className="flex gap-1.5">
                        <button type="button" aria-label="แก้ไข" onClick={() => setForm(m)} className="min-h-[36px] min-w-[36px] grid place-items-center rounded-lg border border-slate-200 text-slate-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" aria-label="ลบ" onClick={() => void remove(m)} className="min-h-[36px] min-w-[36px] grid place-items-center rounded-lg border border-red-200 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-slate-400">-</div>}
          </section>
        );
      })}

      {editable && form && (
        <div className="fixed inset-0 z-[80] bg-black/50 grid place-items-end sm:place-items-center" onClick={() => setForm(null)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-display font-bold text-lg">{form.id ? 'แก้ไขโมเดลนักกีฬา' : 'เพิ่มโมเดลนักกีฬา'}</h4>
            <div className="flex items-center gap-3">
              <PhotoThumb photo={form.photo} name={form.name} size={64} />
              <label className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-slate-100 text-sm font-semibold cursor-pointer">
                <Camera className="w-4 h-4" /> {busy ? 'กำลังอัปโหลด…' : 'เลือกรูป'}
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">รุ่น</span>
              <select value={form.category_id || ''} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white">
                <option value="">ทุกรุ่น / อื่นๆ</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">ชื่อ</span>
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm" /></label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">ชื่อเล่น</span>
              <input value={form.nick || ''} onChange={(e) => setForm({ ...form, nick: e.target.value })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm" /></label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">หมายเหตุ (เช่น ระดับฝีมือ)</span>
              <input value={form.note || ''} maxLength={120} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm" /></label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="min-h-[46px] rounded-xl bg-slate-100 text-sm font-semibold">ยกเลิก</button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
