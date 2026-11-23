import React, { useEffect, useState } from 'react';
import { Camera, ExternalLink, Film, Lock, MessageSquare, Pencil, Phone, ReceiptText, Trash2, Trophy, Users } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import { ResponsiveSheet, PhotoThumb, PhotoLightbox, TeamAvatars } from './UiKit';
import { rpcUpdateRegistration, slipSignedUrl } from '../lib/db';
import { uploadPhoto } from '../lib/supabase';
import { PAY_TH, REG_STATUS_TH, baht, catTotal, fmtDate, shuttleText, teamName } from '../utils/bracket';
import type { Category, PayStatus, Registration, RegStatus } from '../types/matchon';

/** สถานะชำระเงินที่ถูกต้อง: รุ่นฟรีไม่ต้องชำระ */
export function payInfo(r: Registration, cat?: Category | null): { label: string; tone: string } {
  if (r.pay_status === 'paid') return { label: PAY_TH.paid, tone: 'bg-emerald-50 text-emerald-700' };
  if (r.pay_status === 'slip_sent') return { label: PAY_TH.slip_sent, tone: 'bg-blue-50 text-blue-700' };
  if (r.pay_status === 'rejected') return { label: PAY_TH.rejected, tone: 'bg-red-50 text-red-600' };
  if (cat && catTotal(cat) === 0) return { label: 'ไม่มีค่าสมัคร', tone: 'bg-slate-100 text-slate-500' };
  return { label: PAY_TH.unpaid, tone: 'bg-amber-50 text-amber-700' };
}

export const REG_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  waitlist: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

/** ชื่อนักกีฬาแยกบรรทัดละคน (เดี่ยว: ชื่อจริง / ชื่อเล่น) */
export function PlayerLines({ r, className = '' }: { r: Registration; className?: string }) {
  const one = (n?: string, k?: string) => (n ? (k && k !== n ? `${n} (${k})` : n) : '');
  const lines = r.p2_name ? [one(r.p1_name, r.p1_nick), one(r.p2_name, r.p2_nick)] : [r.p1_name, r.p1_nick && r.p1_nick !== r.p1_name ? `ชื่อเล่น ${r.p1_nick}` : ''];
  return (
    <div className={className}>
      {lines.filter(Boolean).map((l, i) => (
        <div key={i} className={i === 0 ? 'text-sm font-bold text-slate-900 truncate' : 'text-xs text-slate-600 truncate'}>{l}</div>
      ))}
    </div>
  );
}

const inp = 'w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500';

function Section({ icon: Icon, title, children, aside }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
      <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 tracking-wide"><Icon className="w-4 h-4 text-blue-600" />{title}</h4>
        {aside}
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500 shrink-0 pt-0.5">{label}</span>
      <span className="text-right font-semibold text-slate-900 min-w-0 break-words">{children}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

type Draft = {
  category_id: string; club: string; status: RegStatus; pay_status: PayStatus; note: string; seed: string; video_url: string;
  p1_name: string; p1_nick: string; p1_phone: string; p1_year: string; p1_photo: string;
  p2_name: string; p2_nick: string; p2_phone: string; p2_year: string; p2_photo: string;
};

const toDraft = (r: Registration): Draft => ({
  category_id: r.category_id, club: r.club || '', status: r.status, pay_status: r.pay_status, note: r.note || '', seed: r.seed != null ? String(r.seed) : '', video_url: r.video_url || '',
  p1_name: r.p1_name, p1_nick: r.p1_nick || '', p1_phone: r.p1_phone || '', p1_year: r.p1_year ? String(r.p1_year) : '', p1_photo: r.p1_photo || '',
  p2_name: r.p2_name || '', p2_nick: r.p2_nick || '', p2_phone: r.p2_phone || '', p2_year: r.p2_year ? String(r.p2_year) : '', p2_photo: r.p2_photo || '',
});

/**
 * Popup ข้อมูลนักกีฬา — ผู้จัดแก้ได้ทุกช่อง, เจ้าของใบสมัครแก้ข้อมูลส่วนตัว/คลิปได้ (ตอนเปิดรับสมัคร),
 * คนอื่นดูได้อย่างเดียว (ไม่เห็นเบอร์โทร/สลิป)
 */
export function AthleteSheet({ reg, onClose, seq, startEdit }: { reg: Registration | null; onClose: () => void; seq?: number; startEdit?: boolean }) {
  const { state, isManagerOf, updateRegistration, deleteRegistration, toast, reload } = useMatchON();
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [slipSrc, setSlipSrc] = useState<string | null>(null);

  useEffect(() => {
    setEdit(!!startEdit);
    setD(reg ? toDraft(reg) : null);
  }, [reg?.id]);

  if (!reg) return <ResponsiveSheet open={false} onClose={onClose} title="">{null}</ResponsiveSheet>;
  const live = state.registrations.find((x) => x.id === reg.id) || reg;
  const cat = state.categories.find((c) => c.id === live.category_id);
  const isMgr = isManagerOf(live.tournament_id);
  const isOwner = !isMgr && !!live.is_mine && !!live.edit_token && live.reg_open !== false;
  const canSee = isMgr || !!live.is_mine; // เบอร์โทร/การเงินเห็นเฉพาะผู้จัดและเจ้าของ
  const canEdit = isMgr || isOwner;
  const doubles = !!live.p2_name || cat?.kind === 'doubles';
  const pay = payInfo(live, cat);
  const tournament = state.tournaments.find((t) => t.id === live.tournament_id);

  const set = (patch: Partial<Draft>) => setD((p) => (p ? { ...p, ...patch } : p));
  const pickPhoto = async (who: 1 | 2, file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadPhoto('photos', live.tournament_id, file);
      set(who === 1 ? { p1_photo: path } : { p2_photo: path });
    } catch (e: any) {
      toast(e?.message || 'อัปโหลดรูปไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };
  const openSlip = async () => {
    if (!live.slip_path) return;
    try { setSlipSrc(await slipSignedUrl(live.slip_path)); } catch (e: any) { toast(e?.message || 'เปิดสลิปไม่ได้', 'err'); }
  };

  const save = async () => {
    if (!d) return;
    if (!d.p1_name.trim()) return toast('กรอกชื่อนักกีฬา', 'err');
    if (d.video_url.trim() && !/^https?:\/\//i.test(d.video_url.trim())) return toast('ลิงก์คลิปต้องขึ้นต้นด้วย http:// หรือ https://', 'err');
    const yr = (s: string) => (s.trim() ? Number(s) : null);
    if (isMgr) {
      updateRegistration(live.id, {
        category_id: d.category_id, club: d.club.trim(), status: d.status, pay_status: d.pay_status, note: d.note.trim(),
        seed: d.seed === '' ? null : Number(d.seed), video_url: d.video_url.trim(),
        p1_name: d.p1_name.trim(), p1_nick: d.p1_nick.trim(), p1_phone: d.p1_phone.trim(), p1_year: yr(d.p1_year), p1_photo: d.p1_photo || null,
        ...(doubles ? { p2_name: d.p2_name.trim(), p2_nick: d.p2_nick.trim(), p2_phone: d.p2_phone.trim(), p2_year: yr(d.p2_year), p2_photo: d.p2_photo || null } : {}),
      });
      setEdit(false);
      return;
    }
    setBusy(true);
    try {
      await rpcUpdateRegistration({
        id: live.id, token: live.edit_token!, club: d.club.trim(), video: d.video_url.trim(),
        p1: { name: d.p1_name, nick: d.p1_nick, phone: d.p1_phone, year: yr(d.p1_year), photo: d.p1_photo || null },
        p2: doubles ? { name: d.p2_name, nick: d.p2_nick, phone: d.p2_phone, year: yr(d.p2_year), photo: d.p2_photo || null } : undefined,
      });
      toast('บันทึกข้อมูลแล้ว');
      setEdit(false);
      await reload();
    } catch (e: any) {
      toast(e?.message || 'บันทึกไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!window.confirm(`ลบใบสมัคร "${teamName(live)}" ? ลบแล้วกู้คืนไม่ได้`)) return;
    if (await deleteRegistration(live.id)) onClose();
  };

  const playerCard = (n: 1 | 2) => {
    const nm = n === 1 ? live.p1_name : live.p2_name;
    const nk = n === 1 ? live.p1_nick : live.p2_nick;
    const ph = n === 1 ? live.p1_phone : live.p2_phone;
    const yr = n === 1 ? live.p1_year : live.p2_year;
    const photo = n === 1 ? live.p1_photo : live.p2_photo;
    const dn = (k: 'name' | 'nick' | 'phone' | 'year' | 'photo') => (d as any)[`p${n}_${k}`] as string;
    const sk = (k: 'name' | 'nick' | 'phone' | 'year') => (v: string) => set({ [`p${n}_${k}`]: v } as Partial<Draft>);
    return (
      <Section icon={Users} title={doubles ? `นักกีฬาคนที่ ${n}` : 'นักกีฬา'}>
        {edit && d ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <PhotoThumb photo={dn('photo')} name={dn('name')} size={64} />
              <label className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer">
                <Camera className="w-4 h-4" /> {busy ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => void pickPhoto(n, e.target.files?.[0])} />
              </label>
            </div>
            <Field label="ชื่อ-นามสกุล"><input className={inp} value={dn('name')} onChange={(e) => sk('name')(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ชื่อเล่น"><input className={inp} value={dn('nick')} onChange={(e) => sk('nick')(e.target.value)} /></Field>
              <Field label="ปีเกิด (พ.ศ.)"><input className={inp} inputMode="numeric" maxLength={4} value={dn('year')} onChange={(e) => sk('year')(e.target.value.replace(/\D/g, ''))} /></Field>
            </div>
            <Field label="เบอร์โทร"><input className={inp} inputMode="tel" value={dn('phone')} onChange={(e) => sk('phone')(e.target.value)} /></Field>
          </div>
        ) : (
          <div className="flex items-center gap-3.5">
            <PhotoThumb photo={photo} name={nm} size={64} />
            <div className="min-w-0 space-y-0.5">
              <div className="text-base font-bold text-slate-900 break-words">{nm}</div>
              {nk && nk !== nm && <div className="text-xs text-slate-500">ชื่อเล่น {nk}</div>}
              {canSee && ph ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3.5 h-3.5" /> {ph}</div>
              ) : !canSee ? (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><Lock className="w-3 h-3" /> เบอร์โทรเห็นเฉพาะผู้จัด</div>
              ) : null}
              {yr ? <div className="text-xs text-slate-500">ปีเกิด {yr}</div> : null}
            </div>
          </div>
        )}
      </Section>
    );
  };

  const videoHref = live.video_url && /^https?:\/\//i.test(live.video_url) ? live.video_url : '';

  return (
    <>
      <ResponsiveSheet
        open
        onClose={onClose}
        title={teamName(live)}
        subtitle={`${seq ? `#${seq} · ` : ''}${cat?.name || ''}${live.club ? ` · ${live.club}` : ''}`}
        footer={
          edit ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => { setD(toDraft(live)); setEdit(false); }} className="min-h-[46px] rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700">ยกเลิก</button>
              <button type="button" disabled={busy} onClick={() => void save()} className="min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">บันทึก</button>
            </div>
          ) : canEdit ? (
            <div className="flex gap-2.5">
              {isMgr && (
                <button type="button" onClick={() => void del()} className="min-h-[46px] px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold inline-flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> ลบ
                </button>
              )}
              <button type="button" onClick={() => { setD(toDraft(live)); setEdit(true); }} className="flex-1 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                <Pencil className="w-4 h-4" /> แก้ไขข้อมูล
              </button>
            </div>
          ) : undefined
        }
      >
        {d && (
          <div className="space-y-3.5">
            {/* สถานะ */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${REG_TONE[live.status]}`}>{REG_STATUS_TH[live.status]}</span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${pay.tone}`}>{pay.label}</span>
              {live.seed != null && <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">มือวาง {live.seed}</span>}
            </div>

            {playerCard(1)}
            {doubles && playerCard(2)}

            <Section icon={Trophy} title="ข้อมูลการสมัคร">
              {edit && isMgr ? (
                <div className="space-y-3">
                  <Field label="รุ่นที่สมัคร">
                    <select className={inp} value={d.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                      {state.categories.filter((c) => c.tournament_id === live.tournament_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  {d.category_id !== live.category_id && <div className="text-[11px] text-amber-700">ย้ายรุ่น: ถ้าจัดสายไปแล้วควรล้าง/จัดสายใหม่ และค่าสมัครเปลี่ยนตามรุ่นใหม่</div>}
                  <Field label="ทีม / ก๊วน"><input className={inp} value={d.club} onChange={(e) => set({ club: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="สถานะใบสมัคร">
                      <select className={inp} value={d.status} onChange={(e) => set({ status: e.target.value as RegStatus })}>
                        {Object.entries(REG_STATUS_TH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="มือวาง (Seed)"><input className={inp} type="number" min={1} value={d.seed} onChange={(e) => set({ seed: e.target.value })} placeholder="ไม่ใช่มือวาง" /></Field>
                  </div>
                </div>
              ) : edit && isOwner ? (
                <Field label="ทีม / ก๊วน"><input className={inp} value={d.club} onChange={(e) => set({ club: e.target.value })} /></Field>
              ) : (
                <div className="space-y-2">
                  <Row label="รุ่น">{cat?.name || '-'}</Row>
                  <Row label="ทีม / ก๊วน">{live.club || '-'}</Row>
                  <Row label="สมัครเมื่อ">{fmtDate(live.created_at)}</Row>
                  {tournament && <Row label="รายการ">{tournament.name}</Row>}
                </div>
              )}
            </Section>

            {canSee && (
              <Section icon={ReceiptText} title="การชำระเงิน">
                {edit && isMgr ? (
                  <Field label="สถานะการชำระเงิน">
                    <select className={inp} value={d.pay_status} onChange={(e) => set({ pay_status: e.target.value as PayStatus })}>
                      {Object.entries(PAY_TH).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </Field>
                ) : (
                  <div className="space-y-2">
                    <Row label="สถานะ"><span className={`text-xs font-bold px-2 py-0.5 rounded-md ${pay.tone}`}>{pay.label}</span></Row>
                    <Row label="ค่าสมัคร">{catTotal(cat) ? `${baht(catTotal(cat))}${cat?.shuttle_fee ? ` (รวม ${shuttleText(cat)})` : ''}` : 'ฟรี'}</Row>
                  </div>
                )}
                {live.slip_path && isMgr && (
                  <button type="button" onClick={() => void openSlip()} className="w-full min-h-[40px] rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold">ดูสลิปโอนเงิน</button>
                )}
              </Section>
            )}

            <Section icon={Film} title="คลิปการแข่ง">
              {edit && d ? (
                <Field label="ลิงก์คลิปวิดีโอ (YouTube / Facebook / TikTok …)">
                  <input className={inp} inputMode="url" placeholder="https://" value={d.video_url} onChange={(e) => set({ video_url: e.target.value })} />
                </Field>
              ) : videoHref ? (
                <a href={videoHref} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 min-h-[44px] px-3.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold">
                  <span className="truncate">{live.video_url}</span>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
              ) : (
                <div className="text-xs text-slate-400">ยังไม่มีคลิป</div>
              )}
            </Section>

            <Section icon={MessageSquare} title="หมายเหตุ">
              {edit && isMgr ? (
                <textarea rows={3} maxLength={300} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="เช่น เหตุผลที่ไม่ผ่าน / สิ่งที่ต้องแก้ไข (ทุกคนเห็น)" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
              ) : live.note ? (
                <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">{live.note}</div>
              ) : (
                <div className="text-xs text-slate-400">ไม่มีหมายเหตุ</div>
              )}
            </Section>
          </div>
        )}
      </ResponsiveSheet>
      <PhotoLightbox src={slipSrc} caption="สลิปโอนเงิน" onClose={() => setSlipSrc(null)} />
    </>
  );
}

/** การ์ดนักกีฬาในรายการ (ใช้ร่วมกันทุกบทบาท) */
export function AthleteCard({ r, cat, seq, onOpen, extra }: { r: Registration; cat?: Category | null; seq?: number; onOpen: () => void; extra?: React.ReactNode }) {
  const pay = payInfo(r, cat);
  const clip = r.video_url && /^https?:\/\//i.test(r.video_url) ? r.video_url : '';
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/70 transition-colors cursor-pointer">
      {seq != null && <span className="w-6 shrink-0 pt-1 text-center font-mono text-xs font-bold text-slate-400 tabular-nums">{seq}</span>}
      <TeamAvatars reg={r} size={42} />
      <div className="min-w-0 flex-1 space-y-1">
        <PlayerLines r={r} />
        {(r.club || cat) && (
          <div className="text-[11px] text-slate-500 truncate">{[r.club, cat?.name].filter(Boolean).join(' • ')}{r.seed != null ? ` • มือวาง ${r.seed}` : ''}</div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${REG_TONE[r.status]}`}>{REG_STATUS_TH[r.status]}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${pay.tone}`}>{pay.label}</span>
          {clip && (
            <a href={clip} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-600">
              <Film className="w-3 h-3" /> คลิป
            </a>
          )}
          {extra}
        </div>
        {r.note && <div className="text-[11px] text-slate-600 bg-amber-50/70 rounded-md px-2 py-1 break-words">📝 {r.note}</div>}
      </div>
    </div>
  );
}
