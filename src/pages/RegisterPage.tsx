import React, { useState } from 'react';
import { sb, photoUrl, uploadPhoto } from '../lib/supabase';
import { LineLoginCard } from '../components/AuthDialog';
import { promptPayPayload } from '../utils/promptpay';
import { rpcSubmitSlip, rpcUpdateRegistration, rpcCancelMyRegistration, rpcDeleteMyRegistration } from '../lib/db';
import { Bell, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, QrCode, Ticket } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Registration } from '../types/matchon';
import {
  baht,
  fmtDate,
  fmtRange,
  fmtTime,
  GENDER_TH,
  KIND_TH,
  MATCH_TH,
  PAY_TH,
  REG_STATUS_TH,
  scoreText,
  teamName,
  catTotal,
  shuttleText,
  prizeText,
} from '../utils/bracket';
import { PhotoThumb, PosterSlider, QrCodeSvg } from '../components/UiKit';
import { AthleteSheet } from '../components/AthleteSheet';

function PhotoPick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  const url = React.useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  return (
    <label className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-slate-300 cursor-pointer hover:bg-slate-50">
      {url ? (
        <img src={url} alt="" className="w-12 h-12 rounded-xl object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-slate-100 grid place-items-center text-slate-400 text-xl">📷</div>
      )}
      <div className="text-xs">
        <div className="font-semibold text-slate-800">{label} *</div>
        <div className="text-slate-500">{file ? 'แตะเพื่อเปลี่ยนรูป' : 'ถ่ายรูปหรือเลือกรูปจากเครื่อง'}</div>
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
    </label>
  );
}

function ppValue(id: string, amount: number): string {
  try {
    return promptPayPayload(id, amount);
  } catch {
    return 'MATCHON';
  }
}

function RegisterForm() {
  const { state, activeTournament, setActiveTid, addRegistration, navigate, toast } = useMatchON();
  const openTournaments = state.tournaments.filter((t) => t.status === 'open');
  const targetTournament =
    openTournaments.find((t) => t.id === activeTournament?.id) || openTournaments[0] || null;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [club, setClub] = useState('');
  const [p1Name, setP1Name] = useState('');
  const [p1Nick, setP1Nick] = useState('');
  const [p1Phone, setP1Phone] = useState('');
  const [p1Year, setP1Year] = useState('');
  const [p1Hist, setP1Hist] = useState('');
  const [p2Hist, setP2Hist] = useState('');
  const [video, setVideo] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [p2Nick, setP2Nick] = useState('');
  const [p2Phone, setP2Phone] = useState('');
  const [consent, setConsent] = useState(true);
  const [p1File, setP1File] = useState<File | null>(null);
  const [p2File, setP2File] = useState<File | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!targetTournament) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-3">
        <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="font-display text-lg font-bold text-slate-900">ยังไม่มีรายการที่เปิดรับสมัคร</h2>
        <p className="text-sm text-slate-500">ติดตามรายการแข่งขันที่กำลังจะเปิดรับสมัครได้ที่หน้ารายการแข่งขัน</p>
        <button
          type="button"
          onClick={() => navigate('tournaments')}
          className="min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
        >
          ดูรายการแข่งขันทั้งหมด
        </button>
      </div>
    );
  }

  const cats = state.categories.filter((c) => c.tournament_id === targetTournament.id);
  const regs = state.registrations.filter(
    (r) => r.tournament_id === targetTournament.id && (r.status === 'pending' || r.status === 'confirmed'),
  );
  const usedByCat = regs.reduce<Record<string, number>>((acc, r) => {
    acc[r.category_id] = (acc[r.category_id] || 0) + 1;
    return acc;
  }, {});

  const selectedCats = cats.filter((c) => selectedCatIds.includes(c.id));
  const needsDoubles = selectedCats.some((c) => c.kind === 'doubles');
  const totalFee = selectedCats.reduce((sum, c) => sum + catTotal(c), 0);

  const toggleCat = (id: string) => {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedCatIds.length) {
        toast('กรุณาเลือกอย่างน้อย 1 รุ่นการแข่งขัน', 'err');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!p1Name.trim() || !p1Phone.trim()) {
        toast('กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์ผู้สมัคร', 'err');
        return;
      }
      if (needsDoubles && !p2Name.trim()) {
        toast('รุ่นที่เลือกเป็นประเภทคู่ กรุณากรอกชื่อคู่ของคุณ', 'err');
        return;
      }
      if (video.trim() && !/^https?:\/\//i.test(video.trim())) {
        toast('ลิงก์คลิปต้องขึ้นต้นด้วย http:// หรือ https://', 'err');
        return;
      }
      if (!p1File || (needsDoubles && !p2File)) {
        toast('กรุณาแนบรูปถ่ายผู้เล่นให้ครบ', 'err');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!consent) {
      toast('กรุณายอมรับกติกาการแข่งขันก่อนส่งใบสมัคร', 'err');
      return;
    }
    if (submitting || !p1File) return;
    setSubmitting(true);
    try {
      const tid = targetTournament.id;
      const p1Photo = await uploadPhoto('photos', tid, p1File);
      const p2Photo = needsDoubles && p2File ? await uploadPhoto('photos', tid, p2File) : null;
      let ok = 0;
      for (const c of selectedCats) {
        const dbl = c.kind === 'doubles';
        const res = await addRegistration({
          tournament_id: tid,
          category_id: c.id,
          club: club.trim(),
          p1_name: p1Name.trim(),
          p1_nick: p1Nick.trim() || p1Name.trim().split(' ')[0],
          p1_phone: p1Phone.trim(),
          p1_year: p1Year ? Number(p1Year) : null,
          p1_photo: p1Photo,
          p1_history: p1Hist.trim(),
          p2_name: dbl ? p2Name.trim() : undefined,
          p2_nick: dbl ? p2Nick.trim() || p2Name.trim().split(' ')[0] : undefined,
          p2_phone: dbl ? p2Phone.trim() : undefined,
          p2_photo: dbl ? p2Photo : null,
          p2_history: dbl ? p2Hist.trim() : undefined,
          video_url: video.trim(),
        });
        if (!res) continue;
        ok++;
        if (slipFile && res.token && catTotal(c) > 0) {
          try {
            const path = await uploadPhoto('slips', `${tid}/${res.id}`, slipFile);
            await rpcSubmitSlip(res.id, res.token, path);
          } catch {
            toast('ส่งสลิปไม่สำเร็จ แนบใหม่ได้ที่หน้า "การสมัครของฉัน"', 'err');
          }
        }
      }
      if (ok) {
        toast(`ส่งใบสมัคร ${ok} รุ่นเรียบร้อยแล้ว`);
        setSelectedCatIds([]);
        setP1File(null);
        setP2File(null);
        setSlipFile(null);
        setStep(1);
        await sb.auth.getSession();
        navigate('my');
      }
    } catch (e: any) {
      toast(e?.message || 'ส่งใบสมัครไม่สำเร็จ', 'err');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 min-w-0 overflow-x-hidden">
      {/* Tournament Picker when multiple open */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-emerald-700">เปิดรับสมัครออนไลน์</div>
            <h2 className="font-display text-lg font-bold text-slate-900 leading-snug">
              {targetTournament.name}
            </h2>
            {targetTournament.reg_deadline && (
              <p className="text-xs text-slate-500 mt-0.5">ปิดรับสมัคร {fmtDate(targetTournament.reg_deadline)}</p>
            )}
          </div>
          {openTournaments.length > 1 && (
            <select
              value={targetTournament.id}
              onChange={(e) => {
                setActiveTid(e.target.value);
                setSelectedCatIds([]);
                setStep(1);
              }}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
            >
              {openTournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Clean 3-Step Indicator */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[
            [1, `1. เลือกรุ่น${selectedCats.length ? ' · ' + selectedCats.map((c) => c.name).join(', ') : ''}`],
            [2, '2. ข้อมูลนักกีฬา'],
            [3, '3. ชำระและยืนยัน'],
          ].map(([num, label]) => {
            const n = num as number;
            const active = step >= n;
            return (
              <div key={n} className="space-y-1.5">
                <div className={`h-1.5 rounded-full transition-colors ${active ? 'bg-blue-600' : 'bg-slate-200'}`} />
                <div className={`text-[11px] font-semibold leading-snug break-words ${step === n ? 'text-blue-700' : 'text-slate-500'}`}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Select Categories */}
      {step === 1 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900">เลือกรุ่น <span className="text-xs font-normal text-slate-500">(เลือกได้หลายรุ่น)</span></h3>

          <div className="space-y-2">
            {cats.map((c) => {
              const used = usedByCat[c.id] || 0;
              const left = Math.max(0, c.max_teams - used);
              const checked = selectedCatIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`block min-w-0 p-3.5 rounded-2xl border-2 cursor-pointer transition-colors ${
                    checked ? 'bg-blue-50/70 border-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" checked={checked} onChange={() => toggleCat(c.id)} className="w-5 h-5 rounded accent-blue-600 shrink-0" />
                    <div className="min-w-0 flex-1 text-[15px] font-extrabold text-slate-900 truncate">{c.name}</div>
                    <div className="shrink-0 text-base font-extrabold tabular-nums text-blue-700">{catTotal(c) ? baht(catTotal(c)) : 'ฟรี'}</div>
                  </div>
                  <div className="mt-2 pl-8 flex flex-wrap gap-1.5 min-w-0">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{KIND_TH[c.kind]}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{GENDER_TH[c.gender]}</span>
                    {c.level ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">มือ {c.level}</span> : null}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${left === 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{left === 0 ? 'เต็ม (ลงสำรอง)' : `ว่าง ${left} ที่`}</span>
                  </div>
                  {c.shuttle_fee ? <div className="mt-1.5 pl-8 text-[11px] text-slate-500 break-words">ค่าสมัคร {baht(c.fee)} + {shuttleText(c)}</div> : null}
                  {prizeText(c) ? <div className="mt-1.5 ml-8 text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 break-words leading-relaxed">🏆 {prizeText(c)}</div> : null}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Athlete Form */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900">ทีมและคลิป</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ทีม / ก๊วน / สโมสร (ถ้ามี)</span>
                <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="เช่น ก๊วนเจอแน่" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">คลิปการแข่ง (ลิงก์ ไม่บังคับ)</span>
                <input inputMode="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtube.com/…" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500" />
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900">{needsDoubles ? 'นักกีฬาคนที่ 1 (ผู้สมัคร)' : 'ผู้สมัคร'}</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block space-y-1 col-span-2">
                <span className="text-xs font-medium text-slate-600">ชื่อ-นามสกุล *</span>
                <input value={p1Name} onChange={(e) => setP1Name(e.target.value)} placeholder="ชื่อจริง นามสกุล" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ชื่อเล่น</span>
                <input value={p1Nick} onChange={(e) => setP1Nick(e.target.value)} placeholder="เช่น กฤต" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ปีเกิด พ.ศ.</span>
                <input inputMode="numeric" maxLength={4} value={p1Year} onChange={(e) => setP1Year(e.target.value)} placeholder="2538" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 tabular-nums" />
              </label>
              <label className="block space-y-1 col-span-2">
                <span className="text-xs font-medium text-slate-600">เบอร์โทรศัพท์ *</span>
                <input type="tel" inputMode="tel" value={p1Phone} onChange={(e) => setP1Phone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 tabular-nums" />
              </label>
            </div>
            <PhotoPick label="รูปถ่ายผู้สมัคร" file={p1File} onPick={setP1File} />
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ประวัติการแข่ง (ไม่บังคับ)</span>
              <textarea rows={2} maxLength={500} value={p1Hist} onChange={(e) => setP1Hist(e.target.value)} placeholder="เช่น แชมป์ … ปี 2568 / รองแชมป์ …" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </label>
          </div>

          {needsDoubles && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="font-display text-base font-bold text-slate-900">นักกีฬาคนที่ 2 (คู่)</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block space-y-1 col-span-2">
                  <span className="text-xs font-medium text-slate-600">ชื่อ-นามสกุล *</span>
                  <input value={p2Name} onChange={(e) => setP2Name(e.target.value)} placeholder="ชื่อจริง นามสกุล" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">ชื่อเล่น</span>
                  <input value={p2Nick} onChange={(e) => setP2Nick(e.target.value)} placeholder="เช่น แพร" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">เบอร์โทร (ไม่บังคับ)</span>
                  <input type="tel" inputMode="tel" value={p2Phone} onChange={(e) => setP2Phone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 tabular-nums" />
                </label>
              </div>
              <PhotoPick label="รูปถ่ายคู่" file={p2File} onPick={setP2File} />
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ประวัติการแข่ง (ไม่บังคับ)</span>
                <textarea rows={2} maxLength={500} value={p2Hist} onChange={(e) => setP2Hist(e.target.value)} placeholder="เช่น แชมป์ … ปี 2568 / รองแชมป์ …" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Summary & PromptPay QR */}
      {step === 3 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900">ตรวจสอบและชำระค่าสมัคร</h3>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2 text-sm">
            {selectedCats.map((c) => (
              <div key={c.id} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">{c.name} · ค่าสมัคร</span>
                  <span className="font-mono tabular-nums text-slate-900">{c.fee ? baht(c.fee) : 'ฟรี'}</span>
                </div>
                {c.shuttle_fee ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">{shuttleText(c).replace(/ \(.*\)/, '')}{c.shuttle_qty ? ` (${c.shuttle_qty} ลูก)` : ''}</span>
                    <span className="font-mono tabular-nums text-slate-900">{baht(c.shuttle_fee)}</span>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="h-px bg-slate-200 my-2" />
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>นักกีฬา</span>
              <span className="font-semibold text-slate-900">
                {p1Nick || p1Name}
                {needsDoubles ? ` / ${p2Nick || p2Name}` : ''}
                {club ? ` (${club})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-slate-900">ยอดรวมที่ต้องชำระ</span>
              <span className="font-display text-xl font-bold tabular-nums text-blue-600">
                {totalFee ? baht(totalFee) : 'ฟรี'}
              </span>
            </div>
          </div>

          {totalFee > 0 && (
            <div className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
              <QrCodeSvg value={ppValue(targetTournament.promptpay_id, totalFee)} size={136} />
              <div className="text-center sm:text-left space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <QrCode className="w-4 h-4" />
                  สแกนจ่าย PromptPay
                </div>
                <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {targetTournament.promptpay_id || 'ผู้จัดยังไม่ได้ตั้งค่าพร้อมเพย์'}
                </div>
                <p className="text-xs text-slate-500">
                  โอนแล้วแนบสลิปด้านล่าง (หรือส่งภายหลังที่หน้า “การสมัครของฉัน”)
                </p>
                <input type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} className="text-xs max-w-[220px]" />
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 rounded"
            />
            <span>ข้าพเจ้ายืนยันว่าข้อมูลนักกีฬาถูกต้องและยินยอมปฏิบัติตามกติกาของรายการแข่งขัน</span>
          </label>
        </div>
      )}

      {/* Wizard Footer Navigation */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
            className="inline-flex items-center justify-center gap-1 min-h-[48px] px-5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" />
            ย้อนกลับ
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 inline-flex items-center justify-center gap-1 min-h-[48px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-600/15"
          >
            ถัดไป ({selectedCatIds.length} รุ่น)
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-600/15"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? 'กำลังส่ง…' : 'ยืนยันการสมัครแข่งขัน'}
          </button>
        )}
      </div>
    </div>
  );
}

function RegActions({ r }: { r: Registration }) {
  const { toast, reload } = useMatchON();
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ club: r.club || '', n1: r.p1_name, k1: r.p1_nick || '', ph1: r.p1_phone || '', n2: r.p2_name || '', k2: r.p2_nick || '' });
  const token = r.edit_token;
  const canSlip = !!token && r.pay_status !== 'paid';
  const locked = r.status === 'confirmed'; // ประเมินผ่านแล้ว: แก้ไข/ยกเลิก/ลบได้เฉพาะผู้จัด
  const sendSlip = async (file: File | undefined) => {
    if (!file || !token) return;
    setBusy(true);
    try {
      const path = await uploadPhoto('slips', `${r.tournament_id}/${r.id}`, file);
      await rpcSubmitSlip(r.id, token, path);
      toast('ส่งสลิปแล้ว รอผู้จัดตรวจสอบ');
      await reload();
    } catch (e: any) {
      toast(e?.message || 'ส่งสลิปไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await rpcUpdateRegistration({
        id: r.id,
        token,
        club: f.club,
        p1: { name: f.n1, nick: f.k1, phone: f.ph1, year: r.p1_year, photo: r.p1_photo },
        p2: r.p2_name ? { name: f.n2, nick: f.k2, phone: r.p2_phone, year: r.p2_year, photo: r.p2_photo } : undefined,
      });
      toast('แก้ไขข้อมูลแล้ว');
      setEdit(false);
      await reload();
    } catch (e: any) {
      toast(e?.message || 'แก้ไขไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };
  const cancelReg = async () => {
    if (!token) return;
    if (!window.confirm('ยืนยันยกเลิกใบสมัครนี้? ผู้จัดจะเห็นสถานะ "ยกเลิก"')) return;
    setBusy(true);
    try {
      await rpcCancelMyRegistration(r.id, token);
      toast('ยกเลิกใบสมัครแล้ว');
      await reload();
    } catch (e: any) {
      toast(e?.message || 'ยกเลิกไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };
  const deleteReg = async () => {
    if (!token) return;
    if (!window.confirm('ยืนยันลบใบสมัครนี้ถาวร? ไม่สามารถกู้คืนได้')) return;
    setBusy(true);
    try {
      await rpcDeleteMyRegistration(r.id, token);
      toast('ลบใบสมัครแล้ว');
      await reload();
    } catch (e: any) {
      toast(e?.message || 'ลบไม่สำเร็จ (ถ้าชำระเงินแล้วหรืออยู่ในตารางแข่ง ให้ติดต่อผู้จัด)', 'err');
    } finally {
      setBusy(false);
    }
  };
  const inp = 'w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {r.p1_photo && <PhotoThumb photo={r.p1_photo} name={r.p1_name} size={40} />}
        {r.p2_photo && <PhotoThumb photo={r.p2_photo} name={r.p2_name} size={40} className="-ml-4" />}
        {canSlip && (
          <label className="text-xs font-semibold text-blue-700 cursor-pointer">
            {busy ? 'กำลังส่ง…' : '📎 แนบสลิปโอนเงิน'}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => void sendSlip(e.target.files?.[0])} />
          </label>
        )}
        {token && r.reg_open !== false && !locked && (
          <button type="button" onClick={() => setEdit(true)} className="text-xs font-semibold text-slate-600">
            ✏️ แก้ไขข้อมูล
          </button>
        )}
      </div>
      {token && locked && <div className="text-[11px] text-slate-500">ประเมินผ่านแล้ว — แก้ไข ลบ หรือยกเลิกได้เฉพาะผู้จัด</div>}
      {token && !locked && (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.status !== 'cancelled' && (
            <button type="button" disabled={busy} onClick={() => void cancelReg()} className="min-h-[36px] px-3 rounded-lg border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-50">
              ยกเลิกใบสมัคร
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void deleteReg()} className="min-h-[36px] px-3 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50">
            ลบใบสมัคร
          </button>
        </div>
      )}
      {edit && <AthleteSheet reg={r} startEdit onClose={() => setEdit(false)} />}
    </div>
  );
}

export function MyRegistrationsPage() {
  const { state, navigate } = useMatchON();
  const myRegs = state.registrations.filter((r) => r.is_mine);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">การสมัครของฉัน</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ติดตามสถานะใบสมัคร ตารางลงสนาม และผลการแข่งขันของคุณ
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('register')}
          className="min-h-[42px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
        >
          + สมัครรุ่นเพิ่ม
        </button>
      </div>

      {/* Registration Cards */}
      {myRegs.length ? (
        <div className="space-y-4">
          {myRegs.map((r) => {
            const t = state.tournaments.find((x) => x.id === r.tournament_id);
            const cat = state.categories.find((c) => c.id === r.category_id);
            const myMatches = state.matches.filter((m) => m.reg_a === r.id || m.reg_b === r.id);
            return (
              <div key={r.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">{t?.name || ''}</div>
                    <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                      {cat?.name || ''} · {teamName(r)}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      สถานะ: <span className="font-semibold text-emerald-700">{REG_STATUS_TH[r.status]}</span> ·{' '}
                      การเงิน: <span className="font-semibold text-slate-700">{PAY_TH[r.pay_status]}</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums text-slate-700">
                    {catTotal(cat) ? baht(catTotal(cat)) : 'ฟรี'}
                  </span>
                </div>

                {r.note && (
                  <div className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3">
                    <span className="font-semibold">หมายเหตุจากผู้จัด:</span> {r.note}
                  </div>
                )}

                <RegActions r={r} />

                {(() => {
                  const notes = state.notifications.filter((n) => n.registration_id === r.id);
                  if (!notes.length) return null;
                  const open = !!openNotes[r.id];
                  return (
                    <div className="pt-3 border-t border-slate-100">
                      <button type="button" onClick={() => setOpenNotes((o) => ({ ...o, [r.id]: !o[r.id] }))} className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700 min-h-[36px]">
                        <Bell className="w-4 h-4 text-blue-600" />
                        แจ้งเตือน
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] grid place-items-center tabular-nums">{notes.length}</span>
                        <ChevronDown className={`w-4 h-4 ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <div className="divide-y divide-slate-100">
                          {notes.slice(0, 10).map((n) => (
                            <div key={n.id} className="py-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                                <div className="text-xs text-slate-600 mt-0.5">{n.body}</div>
                              </div>
                              <span className="text-[11px] text-slate-400 tabular-nums shrink-0 text-right">{fmtDate(n.created_at)}<br />{fmtTime(n.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {myMatches.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-xs font-semibold text-slate-500">แมตช์ของคุณ</div>
                    {myMatches.map((m) => {
                      const oppId = m.reg_a === r.id ? m.reg_b : m.reg_a;
                      const opp = state.registrations.find((x) => x.id === oppId);
                      return (
                        <div
                          key={m.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {m.round_label} · พบ {teamName(opp)}
                            </div>
                            <div className="text-slate-500 mt-0.5 tabular-nums">
                              {m.court ? `สนาม ${m.court}` : 'รอจัดสนาม'}
                              {m.scheduled_at ? ` · ${fmtDate(m.scheduled_at)} ${fmtTime(m.scheduled_at)}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono font-bold tabular-nums">
                            {m.status === 'finished' ? (
                              <span className={m.winner === r.id ? 'text-emerald-700' : 'text-slate-500'}>
                                {m.winner === r.id ? 'ชนะ' : 'แพ้'} {scoreText(m)}
                              </span>
                            ) : (
                              <span className={m.status === 'live' ? 'text-red-600' : 'text-blue-700'}>
                                {MATCH_TH[m.status]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-3">
          <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-700">คุณยังไม่มีใบสมัครในระบบ</div>
          <button
            type="button"
            onClick={() => navigate('register')}
            className="min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
          >
            สมัครแข่งขันเลย
          </button>
        </div>
      )}
    </div>
  );
}

export function RegisterPage() {
  const { profile, loading } = useMatchON();
  if (loading) return null;
  if (!profile) {
    return <LineLoginCard why="นักกีฬาต้องล็อกอินด้วย LINE ก่อนสมัครแข่ง เพื่อผูกใบสมัครกับบัญชีของคุณและรับแจ้งเตือนผลการแข่งขัน" />;
  }
  return <RegisterForm />;
}
