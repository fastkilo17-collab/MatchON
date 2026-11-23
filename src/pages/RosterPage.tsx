import React, { useState } from 'react';
import type { Registration } from '../types/matchon';
import { useMatchON } from '../context/MatchONContext';
import { AthleteCard, AthleteSheet } from '../components/AthleteSheet';
import { REG_STATUS_TH, teamFullName, byRegTime, regSeqMap } from '../utils/bracket';

export function RosterPage() {
  const { activeTournament: t, tCategories, tRegistrations } = useMatchON();
  const [cat, setCat] = useState('');
  const [st, setSt] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Registration | null>(null);
  if (!t) return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">ยังไม่มีรายการแข่งขัน</div>;

  const regs = [...tRegistrations].sort(byRegTime).filter((r) => (!st || r.status === st) && (!q || teamFullName(r).toLowerCase().includes(q.toLowerCase()) || (r.club || '').toLowerCase().includes(q.toLowerCase())));
  const cats = tCategories.filter((c) => !cat || c.id === cat);
  const statusCount = (s: string) => tRegistrations.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">รายชื่อนักกีฬาที่สมัคร</h2>
        <p className="text-xs text-slate-500 mt-0.5">{t.name} · ทั้งหมด {tRegistrations.length} ใบสมัคร แยกตามรุ่น/มือ</p>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / ชมรม" className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm bg-white" />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button type="button" onClick={() => setCat('')} className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-semibold ${!cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>ทุกรุ่น ({tRegistrations.length})</button>
        {tCategories.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap ${cat === c.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {c.name} ({tRegistrations.filter((r) => r.category_id === c.id).length})
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button type="button" onClick={() => setSt('')} className={`shrink-0 min-h-[34px] px-3 rounded-lg text-xs font-semibold ${!st ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>ทุกสถานะ</button>
        {Object.entries(REG_STATUS_TH).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSt(k)} className={`shrink-0 min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap ${st === k ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {label} ({statusCount(k)})
          </button>
        ))}
      </div>

      {cats.map((c) => {
        const rows = regs.filter((r) => r.category_id === c.id);
        if (!rows.length && (cat || st || q)) return null;
        return (
          <section key={c.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <header className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
              <span className="text-xs text-slate-500 tabular-nums">{rows.length} ทีม / รับ {c.max_teams}</span>
            </header>
            {rows.length ? (
              <ul className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <li key={r.id}><AthleteCard r={r} cat={c} seq={i + 1} onOpen={() => setOpen(r)} /></li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center">ยังไม่มีผู้สมัคร</div>
            )}
          </section>
        );
      })}
      <AthleteSheet reg={open} onClose={() => setOpen(null)} seq={open ? regSeqMap(tRegistrations)[open.id] : undefined} />
    </div>
  );
}
