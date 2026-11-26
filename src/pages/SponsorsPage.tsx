import React from 'react';
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { useCanEditModels } from '../components/ModelsView';
import { photoUrl } from '../lib/supabase';
import { deleteSponsor, saveSponsor, uploadSponsorImage, useSponsors, type Sponsor } from '../lib/sponsors';

export function SponsorsPage() {
  const { activeTournament: t, toast } = useMatchON();
  const canEdit = useCanEditModels(t);
  const { items, loading, reload } = useSponsors(t?.id);
  const [form, setForm] = React.useState<Partial<Sponsor> | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (!t) return <div className="p-8 text-center text-sm text-slate-500">เลือกรายการแข่งขันก่อน</div>;

  const submit = async () => {
    if (!form || !form.name?.trim()) { toast('กรอกชื่อสปอนเซอร์', 'err'); return; }
    if (!form.image) { toast('เลือกรูปป้ายสปอนเซอร์', 'err'); return; }
    setBusy(true);
    try { await saveSponsor({ ...form, tournament_id: t.id, name: form.name, sort: form.sort ?? items.length }); setForm(null); await reload(); toast('บันทึกแล้ว'); }
    catch (e: any) { toast(e?.message || 'บันทึกไม่สำเร็จ', 'err'); }
    setBusy(false);
  };
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const url = await uploadSponsorImage(t.id, f); setForm((p) => (p ? { ...p, image: url } : p)); }
    catch (e: any) { toast(e?.message || 'อัปโหลดรูปไม่สำเร็จ', 'err'); }
    setBusy(false);
  };
  const remove = async (s: Sponsor) => {
    if (!window.confirm(`ลบ "${s.name}" ?`)) return;
    try { await deleteSponsor(s.id); await reload(); } catch (e: any) { toast(e?.message || 'ลบไม่สำเร็จ', 'err'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">สปอนเซอร์</h2>
          <p className="text-sm text-slate-500 mt-1">{t.name} — ป้ายสปอนเซอร์จะวิ่งในแถบด้านล่างของหน้าคะแนนสดจอใหญ่ (ถ้าไม่มี จะใช้รูปโปสเตอร์รายการแทน)</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setForm({ name: '', image: null })} className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> เพิ่ม
          </button>
        )}
      </div>
      {loading && <div className="text-sm text-slate-400">กำลังโหลด…</div>}
      {!loading && !items.length && <div className="py-10 text-center text-sm text-slate-400">ยังไม่มีสปอนเซอร์</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="aspect-[16/9] bg-slate-100 grid place-items-center">
              {s.image && <img src={photoUrl(s.image)} alt={s.name} loading="lazy" className="w-full h-full object-contain" />}
            </div>
            <div className="p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold text-slate-900 truncate">{s.name}</div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <button type="button" aria-label="แก้ไข" onClick={() => setForm(s)} className="w-8 h-8 grid place-items-center rounded-lg bg-slate-100 text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label="ลบ" onClick={() => void remove(s)} className="w-8 h-8 grid place-items-center rounded-lg bg-slate-100 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && form && (
        <div className="fixed inset-0 z-[80] bg-black/50 grid place-items-end sm:place-items-center" onClick={() => setForm(null)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-display font-bold text-lg">{form.id ? 'แก้ไขสปอนเซอร์' : 'เพิ่มสปอนเซอร์'}</h4>
            <div className="aspect-[16/9] rounded-xl bg-slate-100 grid place-items-center overflow-hidden">
              {form.image ? <img src={photoUrl(form.image)} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-slate-400">ยังไม่มีรูป</span>}
            </div>
            <label className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-slate-100 text-sm font-semibold cursor-pointer">
              <Camera className="w-4 h-4" /> {busy ? 'กำลังอัปโหลด…' : 'เลือกรูปป้าย'}
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-slate-700">ชื่อสปอนเซอร์</span>
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm" /></label>
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
