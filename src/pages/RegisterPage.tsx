import React, { useState } from 'react';
import { sb, photoUrl, uploadPhoto } from '../lib/supabase';
import { LineLoginCard } from '../components/AuthDialog';
import { promptPayPayload } from '../utils/promptpay';
import { rpcSubmitSlip, rpcUpdateRegistration } from '../lib/db';
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, QrCode, Ticket } from 'lucide-react';
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
} from '../utils/bracket';
import { PhotoThumb, QrCodeSvg } from '../components/UiKit';

function PhotoPick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  const url = React.useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  return (
    <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 cursor-pointer hover:bg-slate-50">
      {url ? (
        <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-slate-100 grid place-items-center text-slate-400 text-xl">📷</div>
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
  const totalFee = selectedCats.reduce((sum, c) => sum + c.fee, 0);

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
          p2_name: dbl ? p2Name.trim() : undefined,
          p2_nick: dbl ? p2Nick.trim() || p2Name.trim().split(' ')[0] : undefined,
          p2_phone: dbl ? p2Phone.trim() : undefined,
          p2_photo: dbl ? p2Photo : null,
        });
        if (!res) continue;
        ok++;
        if (slipFile && res.token && c.fee > 0) {
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
    <div className="max-w-2xl mx-auto space-y-5">
      {(targetTournament.poster || targetTournament.format_text || targetTournament.rules_text || targetTournament.notice) && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          {targetTournament.poster && (
            <img src={targetTournament.poster} alt="โปสเตอร์" className="w-full max-h-96 object-contain rounded-xl bg-slate-100" />
          )}
          {[
            ['รูปแบบการแข่งขัน', targetTournament.format_text],
            ['รายละเอียดกติกา', targetTournament.rules_text],
            ['เงื่อนไขที่นักกีฬาต้องทราบ', targetTournament.notice],
          ].map(([h, v]) =>
            v ? (
              <div key={h}>
                <div className="text-xs font-bold text-slate-800">{h}</div>
                <p className="text-xs text-slate-600 whitespace-pre-line mt-0.5">{v}</p>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Tournament Picker when multiple open */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-emerald-700">เปิดรับสมัครออนไลน์</div>
            <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
              {targetTournament.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {fmtRange(targetTournament.start_date, targetTournament.end_date)} · {targetTournament.venue}
            </p>
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
            [1, '1. เลือกรุ่น'],
            [2, '2. ข้อมูลนักกีฬา'],
            [3, '3. ชำระและยืนยัน'],
          ].map(([num, label]) => {
            const n = num as number;
            const active = step >= n;
            return (
              <div key={n} className="space-y-1.5">
                <div className={`h-1.5 rounded-full transition-colors ${active ? 'bg-blue-600' : 'bg-slate-200'}`} />
                <div className={`text-[11px] font-semibold ${step === n ? 'text-blue-700' : 'text-slate-500'}`}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Select Categories */}
      {step === 1 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">เลือกรุ่นที่ต้องการสมัคร</h3>
            <p className="text-xs text-slate-500 mt-0.5">สามารถเลือกได้มากกว่า 1 รุ่นในครั้งเดียว</p>
          </div>

          <div className="space-y-2.5">
            {cats.map((c) => {
              const used = usedByCat[c.id] || 0;
              const left = Math.max(0, c.max_teams - used);
              const checked = selectedCatIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center justify-between gap-3 p-4 min-h-[64px] rounded-2xl border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-blue-50/70 border-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCat(c.id)}
                      className="mt-1 w-5 h-5 rounded accent-blue-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {KIND_TH[c.kind]} · {GENDER_TH[c.gender]}
                        {c.level ? ` · มือ ${c.level}` : ''} ·{' '}
                        {left === 0 ? 'เต็ม (ลงสำรอง)' : `ว่าง ${left} ที่`}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold tabular-nums text-blue-700 shrink-0">
                    {c.fee ? baht(c.fee) : 'ฟรี'}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Athlete Form */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900">ข้อมูลทีมและผู้สมัคร</h3>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">ชื่อทีม / ก๊วน / สโมสร (ถ้ามี)</span>
              <input
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="เช่น ก๊วนเจอแน่ / Smash Club"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ชื่อ-นามสกุล ผู้สมัคร *</span>
                <input
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  placeholder="ชื่อจริง นามสกุล"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ชื่อเล่น (แสดงบนบอร์ด/Live Score)</span>
                <input
                  value={p1Nick}
                  onChange={(e) => setP1Nick(e.target.value)}
                  placeholder="เช่น กฤต"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">เบอร์โทรศัพท์ *</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={p1Phone}
                  onChange={(e) => setP1Phone(e.target.value)}
                  placeholder="08x-xxx-xxxx"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">ปีเกิด พ.ศ. (ถ้ามี)</span>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={p1Year}
                  onChange={(e) => setP1Year(e.target.value)}
                  placeholder="เช่น 2538"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm tabular-nums"
                />
              </label>
            </div>
            <PhotoPick label="รูปถ่ายผู้สมัคร" file={p1File} onPick={setP1File} />
          </div>

          {needsDoubles && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-slate-900">ข้อมูลคู่ของคุณ (ประเภทคู่)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">ชื่อ-นามสกุล คู่ *</span>
                  <input
                    value={p2Name}
                    onChange={(e) => setP2Name(e.target.value)}
                    placeholder="ชื่อจริง นามสกุล"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">ชื่อเล่น คู่</span>
                  <input
                    value={p2Nick}
                    onChange={(e) => setP2Nick(e.target.value)}
                    placeholder="เช่น แพร"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-slate-600">เบอร์โทรศัพท์ คู่ (ไม่บังคับ)</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={p2Phone}
                    onChange={(e) => setP2Phone(e.target.value)}
                    placeholder="08x-xxx-xxxx"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </label>
              </div>
              <PhotoPick label="รูปถ่ายคู่" file={p2File} onPick={setP2File} />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Summary & PromptPay QR */}
      {step === 3 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-5">
          <h3 className="font-display text-base font-bold text-slate-900">ตรวจสอบข้อมูลและชำระค่าสมัคร</h3>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2 text-sm">
            {selectedCats.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-slate-700">{c.name}</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {c.fee ? baht(c.fee) : 'ฟรี'}
                </span>
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
        {token && r.reg_open !== false && (
          <button type="button" onClick={() => setEdit((v) => !v)} className="text-xs font-semibold text-slate-600">
            {edit ? 'ยกเลิก' : '✏️ แก้ไขข้อมูล'}
          </button>
        )}
      </div>
      {edit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50">
          <input className={inp} value={f.club} onChange={(e) => setF({ ...f, club: e.target.value })} placeholder="ทีม / ก๊วน" />
          <input className={inp} value={f.ph1} onChange={(e) => setF({ ...f, ph1: e.target.value })} placeholder="เบอร์โทร" />
          <input className={inp} value={f.n1} onChange={(e) => setF({ ...f, n1: e.target.value })} placeholder="ชื่อ-นามสกุล" />
          <input className={inp} value={f.k1} onChange={(e) => setF({ ...f, k1: e.target.value })} placeholder="ชื่อเล่น" />
          {r.p2_name !== undefined && (
            <>
              <input className={inp} value={f.n2} onChange={(e) => setF({ ...f, n2: e.target.value })} placeholder="ชื่อคู่" />
              <input className={inp} value={f.k2} onChange={(e) => setF({ ...f, k2: e.target.value })} placeholder="ชื่อเล่นคู่" />
            </>
          )}
          <button type="button" disabled={busy} onClick={() => void save()} className="min-h-[40px] rounded-xl bg-blue-600 text-white text-xs font-semibold sm:col-span-2">
            บันทึกการแก้ไข
          </button>
        </div>
      )}
    </div>
  );
}

export function MyRegistrationsPage() {
  const { state, navigate } = useMatchON();
  const myRegs = state.registrations.filter((r) => r.is_mine);
  const myRegIds = new Set(myRegs.map((r) => r.id));
  const myNotes = state.notifications.filter((n) => myRegIds.has(n.registration_id));

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

      {/* Notifications */}
      {myNotes.length > 0 && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Bell className="w-4 h-4 text-blue-600" />
            แจ้งเตือนล่าสุด ({myNotes.length})
          </div>
          <div className="divide-y divide-slate-100">
            {myNotes.slice(0, 5).map((n) => (
              <div key={n.id} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{n.body}</div>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {fmtTime(n.created_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

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
                    {cat?.fee ? baht(cat.fee) : 'ฟรี'}
                  </span>
                </div>

                {r.note && (
                  <div className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3">
                    <span className="font-semibold">หมายเหตุจากผู้จัด:</span> {r.note}
                  </div>
                )}

                <RegActions r={r} />

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
