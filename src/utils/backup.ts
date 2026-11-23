import type { Data } from '../lib/db';

/** สำรองข้อมูลรายการแข่งขันลงเครื่องเป็นไฟล์ JSON (ไม่รวมไฟล์รูป/สลิปที่เก็บใน Storage — เก็บเฉพาะ path) */
export function buildBackup(data: Data, tids: string[]) {
  const set = new Set(tids);
  const pick = <T extends { tournament_id: string }>(a: T[]) => a.filter((x) => set.has(x.tournament_id));
  const tournaments = data.tournaments.filter((t) => set.has(t.id));
  const matches = pick(data.matches);
  return {
    app: 'MatchON',
    version: 1,
    exported_at: new Date().toISOString(),
    counts: {
      tournaments: tournaments.length,
      categories: pick(data.categories).length,
      registrations: pick(data.registrations).length,
      matches: matches.length,
    },
    tournaments,
    categories: pick(data.categories),
    registrations: pick(data.registrations),
    matches,
    courts: pick(data.courts),
    brackets: data.brackets.filter((b: any) => set.has(b.tournament_id)),
    rules: pick(data.rules),
    referees: pick(data.referees),
  };
}

export function downloadBackup(data: Data, tids: string[], label: string): number {
  const bk = buildBackup(data, tids);
  const blob = new Blob([JSON.stringify(bk, null, 2)], { type: 'application/json' });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MatchON-backup-${label.replace(/[^\wก-๙-]+/g, '_').slice(0, 40)}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return bk.counts.registrations + bk.counts.matches;
}
