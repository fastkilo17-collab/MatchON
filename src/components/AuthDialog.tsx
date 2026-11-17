import React, { useState } from 'react';
import { sb } from '../lib/supabase';
import { useMatchON } from '../context/MatchONContext';
import { ResponsiveSheet } from './UiKit';

export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useMatchON();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const inp = 'w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        toast('เข้าสู่ระบบแล้ว');
        onClose();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password: pw });
        if (error) throw error;
        if (data.session) {
          toast('สมัครสมาชิกแล้ว');
          onClose();
        } else toast('ส่งอีเมลยืนยันแล้ว กรุณากดลิงก์ในอีเมล', 'info');
      }
    } catch (err: any) {
      toast(err?.message || 'ไม่สำเร็จ', 'err');
    } finally {
      setBusy(false);
    }
  };

  const line = async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'custom:line' as any,
      options: { redirectTo: location.origin + import.meta.env.BASE_URL },
    });
    if (error) toast(error.message, 'err');
  };

  return (
    <ResponsiveSheet open={open} onClose={onClose} title={mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'} subtitle="สำหรับผู้จัดการแข่งขันและเจ้าหน้าที่ (นักกีฬาสมัครได้โดยไม่ต้องล็อกอิน)">
      <form onSubmit={submit} className="space-y-3">
        <button type="button" onClick={line} className="w-full min-h-[46px] rounded-xl bg-[#06C755] text-white text-sm font-semibold">
          เข้าสู่ระบบด้วย LINE
        </button>
        <div className="text-center text-[11px] text-slate-400">หรือใช้อีเมล</div>
        <input className={inp} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" autoComplete="email" />
        <input className={inp} type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่าน (6 ตัวขึ้นไป)" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <button disabled={busy} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
          {busy ? 'กำลังดำเนินการ…' : mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="w-full text-xs text-blue-700 font-semibold">
          {mode === 'in' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </form>
    </ResponsiveSheet>
  );
}

export function AccountBox() {
  const { profile, signOut, canCreate, toast, reload } = useMatchON();
  const [open, setOpen] = useState(false);
  const becomeOrganizer = async () => {
    const { error } = await sb.rpc('become_organizer', { p_name: profile?.display_name || '' });
    if (error) toast(error.message, 'err');
    else {
      toast('เปิดสิทธิ์ผู้จัดการแข่งขันแล้ว');
      await reload();
    }
  };
  return (
    <div className="space-y-2">
      {profile ? (
        <>
          <div className="text-xs text-slate-600 truncate">{profile.display_name || profile.email || 'ผู้ใช้'}</div>
          {!canCreate && (
            <button type="button" onClick={becomeOrganizer} className="w-full min-h-[40px] rounded-xl bg-blue-600 text-white text-xs font-semibold">
              เป็นผู้จัดการแข่งขัน
            </button>
          )}
          <button type="button" onClick={() => void signOut()} className="w-full min-h-[40px] rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold">
            ออกจากระบบ
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="w-full min-h-[40px] rounded-xl bg-blue-600 text-white text-xs font-semibold">
          เข้าสู่ระบบ / สมัครสมาชิก
        </button>
      )}
      <AuthDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
