import type {
  BracketFormat,
  Category,
  CategoryGender,
  CategoryKind,
  Match,
  MatchStatus,
  PayStatus,
  RegStatus,
  Registration,
  RulePreset,
  Tournament,
  TournamentStatus,
} from '../types/matchon';

export const STATUS_TH: Record<TournamentStatus, string> = {
  open: 'เปิดรับสมัคร',
  live: 'กำลังแข่งขัน',
  closed: 'ปิดรับสมัคร',
  draft: 'ฉบับร่าง',
};

export const KIND_TH: Record<CategoryKind, string> = {
  singles: 'เดี่ยว',
  doubles: 'คู่',
};

export const GENDER_TH: Record<CategoryGender, string> = {
  male: 'ชาย',
  female: 'หญิง',
  mixed: 'ผสม',
  open: 'ทั่วไป',
};

export const FORMAT_TH: Record<BracketFormat, string> = {
  knockout: 'แพ้คัดออก',
  round_robin: 'พบกันหมด',
  group_stage: 'แบ่งกลุ่ม',
  group_knockout: 'แบ่งกลุ่ม+น็อคเอาท์',
  swiss: 'Swiss',
};

export const MATCH_TH: Record<MatchStatus, string> = {
  scheduled: 'รอแข่ง',
  live: 'กำลังแข่ง',
  finished: 'จบแล้ว',
};

export const REG_STATUS_TH: Record<RegStatus, string> = {
  pending: 'รอประเมิน',
  confirmed: 'ผ่าน',
  waitlist: 'สำรอง',
  rejected: 'ไม่ผ่าน',
  cancelled: 'ยกเลิก',
};

export const PAY_TH: Record<PayStatus, string> = {
  unpaid: 'ยังไม่ชำระ',
  slip_sent: 'รอตรวจสลิป',
  paid: 'ชำระแล้ว',
  rejected: 'ไม่ผ่าน',
};

export const CATEGORY_PRESETS: Array<[string, Partial<Category>]> = [
  ['ชายเดี่ยว มือ S', { kind: 'singles', gender: 'male', level: 'S', fee: 450, best_of: 3, points: 21, cap: 30 }],
  ['ชายเดี่ยว มือ P', { kind: 'singles', gender: 'male', level: 'P', fee: 400, best_of: 3, points: 21, cap: 30 }],
  ['ชายคู่ มือ P', { kind: 'doubles', gender: 'male', level: 'P', fee: 800, best_of: 3, points: 21, cap: 30 }],
  ['ชายคู่ มือ N', { kind: 'doubles', gender: 'male', level: 'N', fee: 700, best_of: 3, points: 21, cap: 30 }],
  ['หญิงเดี่ยว', { kind: 'singles', gender: 'female', fee: 400, best_of: 3, points: 21, cap: 30 }],
  ['หญิงคู่', { kind: 'doubles', gender: 'female', fee: 750, best_of: 3, points: 21, cap: 30 }],
  ['คู่ผสม', { kind: 'doubles', gender: 'mixed', fee: 800, best_of: 3, points: 21, cap: 30 }],
  ['รุ่นอายุ 40+', { kind: 'singles', gender: 'open', age_min: 40, fee: 450, best_of: 3, points: 21, cap: 30 }],
  ['รุ่นอายุ 50+', { kind: 'singles', gender: 'open', age_min: 50, fee: 450, best_of: 3, points: 21, cap: 30 }],
];

export const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export function baht(amount: number): string {
  return `฿${Number(amount || 0).toLocaleString('th-TH')}`;
}

/** ชื่อนักกีฬาแบบชื่อเล่น เช่น "ชาย / โอ๊ต" */
export function playersNick(r?: Registration | null): string {
  if (!r) return '';
  const a = r.p1_nick || r.p1_name;
  const b = r.p2_nick || r.p2_name;
  return b ? `${a} / ${b}` : a;
}

/** ชื่อที่แสดงทั่วระบบ: ทีมขึ้นก่อน แล้วตามด้วยนักกีฬา เช่น "ก็วนเจอแน่ · ชาย / โอ๊ต" */
export function teamName(r?: Registration | null): string {
  if (!r) return 'รอผลการแข่ง';
  const p = playersNick(r);
  return r.club ? `${r.club} · ${p}` : p;
}

export function teamFullName(r?: Registration | null): string {
  if (!r) return 'รอผลการแข่ง';
  return r.p2_name ? `${r.p1_name} / ${r.p2_name}` : r.p1_name;
}

export function peopleCount(r: Registration): number {
  return r.p2_name ? 2 : 1;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function fmtRange(start?: string | null, end?: string | null): string {
  if (!start) return '';
  if (!end || start === end) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export function scoreText(m: Match): string {
  const done = (m.sets || []).map(([a, b]) => `${a}-${b}`).join('  ');
  if (m.status === 'live') {
    return `${done}${done ? '  ' : ''}${m.cur_a}-${m.cur_b}`;
  }
  return done;
}

export function ruleForMatch(
  match: Match,
  categories: Category[],
  rules: RulePreset[],
): { best_of: number; points: number; deuce: boolean; cap: number; play_two: boolean } {
  const cat = categories.find((c) => c.id === match.category_id);
  const ruleId = match.stage === 'group' || match.stage === 'swiss' ? cat?.rule_group : cat?.rule_ko;
  const preset = ruleId ? rules.find((r) => r.id === ruleId) : undefined;
  return {
    best_of: preset?.best_of ?? cat?.best_of ?? 3,
    points: preset?.points ?? cat?.points ?? 21,
    deuce: preset?.deuce ?? cat?.deuce ?? true,
    cap: preset?.cap ?? cat?.cap ?? 30,
    // a fixed 2-set game can end 1-1, so it only applies where draws make sense (groups / round robin / swiss)
    play_two:
      !!(preset ? preset.play_two : cat?.play_two) &&
      (match.stage === 'group' || match.stage === 'swiss' || cat?.format === 'round_robin' || cat?.format === 'group_stage'),
  };
}

export function ruleText(r: { best_of: number; points: number; deuce: boolean; cap: number; play_two?: boolean; win_pts?: number; draw_pts?: number; loss_pts?: number }): string {
  const pt = ` · ชนะ ${r.win_pts ?? 2} เสมอ ${r.draw_pts ?? 1} แพ้ ${r.loss_pts ?? 0} คะแนน`;
  const setLabel = r.play_two
    ? '2 เซต (2-0 ชนะ · 1-1 เสมอ)'
    : r.best_of === 1
      ? '1 เซต'
      : `${Math.floor(r.best_of / 2) + 1} ใน ${r.best_of} เซต`;
  return `${setLabel} · ${r.points} แต้ม${r.deuce ? ` (ดิวสูงสุด ${r.cap})` : ' (ไม่ดิว)'}${pt}`;
}

export function setWinner(
  a: number,
  b: number,
  rule: { points: number; deuce: boolean; cap: number },
): 'a' | 'b' | null {
  const { points, deuce, cap } = rule;
  if (a < 0 || b < 0) return null;
  if (!deuce) {
    if (a >= points && a > b) return 'a';
    if (b >= points && b > a) return 'b';
    return null;
  }
  if (a >= cap && a > b) return 'a';
  if (b >= cap && b > a) return 'b';
  if (a >= points && a - b >= 2) return 'a';
  if (b >= points && b - a >= 2) return 'b';
  return null;
}

export function matchWinner(sets: [number, number][], rule: { best_of: number }): 'a' | 'b' | null {
  const need = Math.floor((rule.best_of || 3) / 2) + 1;
  let wa = 0;
  let wb = 0;
  for (const [sa, sb] of sets) {
    if (sa > sb) wa++;
    else if (sb > sa) wb++;
  }
  if (wa >= need) return 'a';
  if (wb >= need) return 'b';
  return null;
}

// How a match ends: normal (first to win enough sets) or "2 sets" (always 2 sets, 1-1 is a draw).
export function matchResult(
  sets: [number, number][],
  rule: { best_of: number; play_two?: boolean },
): { done: boolean; winner: 'a' | 'b' | null; draw: boolean } {
  if (rule.play_two) {
    if (sets.length < 2) return { done: false, winner: null, draw: false };
    let wa = 0;
    let wb = 0;
    for (const [sa, sb] of sets.slice(0, 2)) {
      if (sa > sb) wa++;
      else if (sb > sa) wb++;
    }
    return { done: true, winner: wa > wb ? 'a' : wb > wa ? 'b' : null, draw: wa === wb };
  }
  const w = matchWinner(sets, rule);
  return { done: !!w, winner: w, draw: false };
}

export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const len = order.length * 2;
    order = order.flatMap((s) => [s, len + 1 - s]);
  }
  return order;
}

export function roundLabel(teamsInRound: number): string {
  if (teamsInRound === 2) return 'ชิงชนะเลิศ';
  if (teamsInRound === 4) return 'รองชนะเลิศ';
  return `รอบ ${teamsInRound} ทีม`;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildKnockout(
  teams: string[],
  opts: { tournamentId: string; categoryId: string; startMatchNo: number; stage?: 'main' | 'knockout' | 'lower' },
): Match[] {
  const n = teams.length;
  if (n < 2) throw new Error('ต้องมีอย่างน้อย 2 ทีมเพื่อจัดสาย');
  const size = 2 ** Math.ceil(Math.log2(n));
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const grid: Match[][] = [];
  const now = new Date().toISOString();

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const teamsInRound = size / 2 ** (r - 1);
    grid.push(
      Array.from({ length: count }, (_, i) => ({
        id: uuid(),
        tournament_id: opts.tournamentId,
        category_id: opts.categoryId,
        match_no: null,
        round: r,
        round_label: roundLabel(teamsInRound),
        slot: i,
        stage: opts.stage || 'main',
        reg_a: null,
        reg_b: null,
        status: 'scheduled',
        court: null,
        scheduled_at: null,
        sets: [],
        cur_a: 0,
        cur_b: 0,
        winner: null,
        next_match: null,
        next_slot: null,
        updated_at: now,
      })),
    );
  }

  for (let r = 0; r < rounds - 1; r++) {
    grid[r].forEach((m, i) => {
      m.next_match = grid[r + 1][Math.floor(i / 2)].id;
      m.next_slot = i % 2 === 0 ? 'a' : 'b';
    });
  }

  const seat = (s: number) => (s <= n ? teams[s - 1] : null);
  grid[0].forEach((m, i) => {
    m.reg_a = seat(order[2 * i]);
    m.reg_b = seat(order[2 * i + 1]);
  });

  const slotOf: Record<string, Match> = {};
  grid.flat().forEach((m) => {
    slotOf[m.id] = m;
  });

  grid[0].forEach((m) => {
    if ((m.reg_a && !m.reg_b) || (!m.reg_a && m.reg_b)) {
      m.status = 'finished';
      m.winner = m.reg_a || m.reg_b;
      if (m.next_match && slotOf[m.next_match]) {
        const nx = slotOf[m.next_match];
        if (m.next_slot === 'a') nx.reg_a = m.winner;
        else nx.reg_b = m.winner;
      }
    }
  });

  const flat = grid.flat();
  flat.forEach((m) => {
    // เลขแมตช์ยังไม่กำหนดตอนจัดสาย — จะใส่ตอนจัดตารางแข่ง/เรียกลงสนาม
    m.match_no = null;
  });
  return flat;
}

export function buildRoundRobin(
  teams: string[],
  opts: {
    tournamentId: string;
    categoryId: string;
    startMatchNo: number;
    stage?: 'main' | 'group';
    groupNo?: number;
  },
): Match[] {
  if (teams.length < 2) throw new Error('ต้องมีอย่างน้อย 2 ทีม');
  const list: Array<string | null> = [...teams];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rows: Match[] = [];
  let no = opts.startMatchNo;
  const now = new Date().toISOString();
  const groupLetter = opts.groupNo != null ? String.fromCharCode(65 + opts.groupNo) : null;

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) {
        rows.push({
          id: uuid(),
          tournament_id: opts.tournamentId,
          category_id: opts.categoryId,
          match_no: null,
          round: r + 1,
          round_label: groupLetter ? `กลุ่ม ${groupLetter} · นัดที่ ${r + 1}` : `นัดที่ ${r + 1}`,
          slot: i,
          stage: opts.stage || 'main',
          group_no: opts.groupNo,
          reg_a: a,
          reg_b: b,
          status: 'scheduled',
          court: null,
          scheduled_at: null,
          sets: [],
          cur_a: 0,
          cur_b: 0,
          winner: null,
          next_match: null,
          next_slot: null,
          updated_at: now,
        });
      }
    }
    const popped = list.pop()!;
    list.splice(1, 0, popped);
  }
  return rows;
}

export interface StandingRow {
  id: string;
  played: number;
  won: number;
  lost: number;
  gf: number;
  ga: number;
  pf: number;
  pa: number;
  drawn: number;
  pts: number;
}

export type StandingPts = { win: number; draw: number; loss: number };
export const DEFAULT_PTS: StandingPts = { win: 2, draw: 1, loss: 0 };
/** คะแนนชนะ/เสมอ/แพ้ ของรุ่น (จากชุดกติการอบแบ่งกลุ่มที่ผูกกับรุ่น) */
export function standingPtsFor(categoryId: string, categories: Category[], rules: RulePreset[]): StandingPts {
  const cat = categories.find((c) => c.id === categoryId);
  const p = cat?.rule_group ? rules.find((r) => r.id === cat.rule_group) : undefined;
  return { win: p?.win_pts ?? 2, draw: p?.draw_pts ?? 1, loss: p?.loss_pts ?? 0 };
}

export function computeStandings(teamIds: string[], matches: Match[], pts: StandingPts = DEFAULT_PTS): StandingRow[] {
  const row: Record<string, StandingRow> = {};
  teamIds.forEach((id) => {
    row[id] = { id, played: 0, won: 0, lost: 0, gf: 0, ga: 0, pf: 0, pa: 0, drawn: 0, pts: 0 };
  });

  for (const m of matches) {
    if (m.status !== 'finished' || !m.reg_a || !m.reg_b || !row[m.reg_a] || !row[m.reg_b]) continue;
    const ra = row[m.reg_a];
    const rb = row[m.reg_b];
    ra.played++;
    rb.played++;
    if (!m.winner) {
      ra.drawn++;
      rb.drawn++;
    } else if (m.winner === m.reg_a) {
      ra.won++;
      rb.lost++;
    } else if (m.winner === m.reg_b) {
      rb.won++;
      ra.lost++;
    }
    for (const [sa, sb] of m.sets || []) {
      ra.pf += sa;
      ra.pa += sb;
      rb.pf += sb;
      rb.pa += sa;
      if (sa > sb) {
        ra.gf++;
        rb.ga++;
      } else if (sb > sa) {
        rb.gf++;
        ra.ga++;
      }
    }
  }

  Object.values(row).forEach((r) => {
    r.pts = r.won * pts.win + r.drawn * pts.draw + r.lost * pts.loss;
  });
  return Object.values(row).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const pd = b.pf - b.pa - (a.pf - a.pa); // equal points: points scored minus conceded
    if (pd !== 0) return pd;
    const gd = b.gf - b.ga - (a.gf - a.ga);
    if (gd !== 0) return gd;
    return b.pf - b.pa - (a.pf - a.pa);
  });
}

const MIN = 60000;

export function findScheduleConflicts(
  matches: Match[],
  t: Tournament,
  regMap: Record<string, Registration>,
): string[] {
  const dur = (t.match_minutes || 30) * MIN;
  const rest = (t.rest_minutes || 0) * MIN;
  const sch = matches
    .filter((m) => m.court && m.scheduled_at && m.status !== 'finished')
    .map((m) => ({ m, s: +new Date(m.scheduled_at!) }))
    .sort((a, b) => a.s - b.s);

  const out: string[] = [];
  for (let i = 0; i < sch.length; i++) {
    for (let j = i + 1; j < sch.length; j++) {
      const A = sch[i];
      const B = sch[j];
      if (B.s - A.s >= dur + rest) break;
      const label = `แมตช์ #${A.m.match_no ?? '?'} และ #${B.m.match_no ?? '?'}`;
      if (A.m.court === B.m.court && B.s < A.s + dur) {
        out.push(`${label}: สนาม ${A.m.court} เวลาชนกัน`);
      }
      const ta = [A.m.reg_a, A.m.reg_b].filter(Boolean) as string[];
      const tb = [B.m.reg_a, B.m.reg_b].filter(Boolean) as string[];
      for (const id of ta) {
        if (!tb.includes(id)) continue;
        const player = teamName(regMap[id]);
        out.push(
          B.s < A.s + dur
            ? `${label}: ${player} แข่งสองสนามพร้อมกัน`
            : `${label}: ${player} พักไม่ถึง ${t.rest_minutes} นาที`,
        );
      }
    }
  }
  return out;
}

export function planAutoSchedule(
  matches: Match[],
  t: Tournament,
  startIso: string,
  courts: number[],
  timeOnly = false,
  catStarts: Record<string, string> = {},
): Array<{ id: string; court: number | null; scheduled_at: string }> {
  const dur = (t.match_minutes || 30) * MIN;
  const rest = (t.rest_minutes || 0) * MIN;
  const start = +new Date(startIso);
  const catStart = (cid: string) => (catStarts[cid] ? +new Date(catStarts[cid]) : start);
  const earliest = Math.min(start, ...Object.values(catStarts).filter(Boolean).map((x) => +new Date(x)));
  const courtFree: Record<number, number> = Object.fromEntries(courts.map((c) => [c, earliest]));
  const teamFree: Record<string, number> = {};
  const ends: Record<string, number> = {};

  const existing = matches.filter((m) => m.court && m.scheduled_at && m.status !== 'finished');
  for (const m of existing) {
    const e = +new Date(m.scheduled_at!) + dur;
    if (m.court != null && courtFree[m.court] != null) {
      courtFree[m.court] = Math.max(courtFree[m.court], e);
    }
    for (const id of [m.reg_a, m.reg_b]) {
      if (id) teamFree[id] = Math.max(teamFree[id] || 0, e + rest);
    }
    ends[m.id] = e;
  }

  const feeders: Record<string, string[]> = {};
  matches.forEach((m) => {
    if (m.next_match) {
      (feeders[m.next_match] = feeders[m.next_match] || []).push(m.id);
    }
  });

  const todo = matches
    .filter((m) => m.status === 'scheduled' && (timeOnly ? !m.scheduled_at : !m.court || !m.scheduled_at) && (m.reg_a || m.reg_b || feeders[m.id]))
    .sort((a, b) => catStart(a.category_id) - catStart(b.category_id) || a.round - b.round || (a.match_no || 0) - (b.match_no || 0) || a.slot - b.slot);

  const plan: Array<{ id: string; court: number | null; scheduled_at: string }> = [];
  for (const m of todo) {
    let ready = catStart(m.category_id);
    for (const id of [m.reg_a, m.reg_b]) {
      if (id) ready = Math.max(ready, teamFree[id] || 0);
    }
    for (const f of feeders[m.id] || []) {
      if (ends[f] != null) ready = Math.max(ready, ends[f] + rest);
    }
    let best: { c: number; s: number } | null = null;
    for (const c of courts) {
      const s = Math.max(courtFree[c], ready);
      if (!best || s < best.s) best = { c, s };
    }
    if (!best) continue;
    courtFree[best.c] = best.s + dur;
    ends[m.id] = best.s + dur;
    for (const id of [m.reg_a, m.reg_b]) {
      if (id) teamFree[id] = best.s + dur + rest;
    }
    // time-only: the slot number only limits how many matches run at once; the court is chosen when the match is called
    plan.push({ id: m.id, court: timeOnly ? null : best.c, scheduled_at: new Date(best.s).toISOString() });
  }
  return plan;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const csvContent = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Deterministic visual matrix SVG for PromptPay & Referee QR display
export function buildQrMatrix(seedStr: string, size = 21): boolean[][] {
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const nextBit = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) % 2 === 0;
  };
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = border || center;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
      if (!inFinder) {
        grid[r][c] = nextBit();
      }
    }
  }
  return grid;
}

/** ยอดที่ต้องจ่ายต่อรุ่น = ค่าสมัคร + ค่าลูกแบด */
export const catTotal = (c?: { fee?: number; shuttle_fee?: number } | null): number => (c?.fee || 0) + (c?.shuttle_fee || 0);
/** ข้อความอธิบายค่าลูกแบด เช่น "ค่าลูกแบด ฿600 (10 ลูก)" */
export const shuttleText = (c: { shuttle_fee?: number; shuttle_qty?: number }): string =>
  c.shuttle_fee ? `ค่าลูกแบด ฿${c.shuttle_fee.toLocaleString('th-TH')}${c.shuttle_qty ? ` (${c.shuttle_qty} ลูก)` : ''}` : '';

const REG_ORDER: Record<string, number> = { pending: 0, confirmed: 1, waitlist: 2, rejected: 3, cancelled: 4 };
const PAY_ORDER: Record<string, number> = { unpaid: 0, slip_sent: 1, paid: 2, rejected: 3 };
/** เลขลำดับสมัคร (1 = สมัครก่อนสุด) ต่อรายการ */
export function regSeqMap(regs: Registration[]): Record<string, number> {
  const out: Record<string, number> = {};
  [...regs]
    .sort((a, b) => +new Date(a.created_at || 0) - +new Date(b.created_at || 0))
    .forEach((r, i) => { out[r.id] = i + 1; });
  return out;
}
/** เรียงตามลำดับสมัคร เก่า → ใหม่ (สมัครล่าสุดอยู่ท้าย) */
export const byRegTime = (a: Registration, b: Registration) => +new Date(a.created_at || 0) - +new Date(b.created_at || 0);
/** เรียงตามสถานะประเมิน แล้วสถานะชำระเงิน แล้วลำดับสมัคร */
export const byStatusThenPay = (a: Registration, b: Registration) =>
  (REG_ORDER[a.status] ?? 9) - (REG_ORDER[b.status] ?? 9) || (PAY_ORDER[a.pay_status] ?? 9) - (PAY_ORDER[b.pay_status] ?? 9) || byRegTime(a, b);
/** ชื่อจริงพร้อมชื่อเล่นในวงเล็บ เช่น "สมชาย ใจดี (ชาย) / ..." */
export function teamRealWithNick(r: Registration): string {
  const one = (n?: string, k?: string) => (n ? (k && k !== n ? `${n} (${k})` : n) : '');
  return [one(r.p1_name, r.p1_nick), one(r.p2_name, r.p2_nick)].filter(Boolean).join(' / ');
}

/** กติกาแบบสั้น เช่น "กติกา : 2 ใน 3 เซต 21 แต้ม ดิวถึง 30" */
export function ruleShort(r: { best_of: number; points: number; deuce: boolean; cap: number; play_two?: boolean }): string {
  const sets = r.play_two ? 'แข่ง 2 เซต' : r.best_of === 1 ? '1 เซต' : `${Math.floor(r.best_of / 2) + 1} ใน ${r.best_of} เซต`;
  return `กติกา : ${sets} ${r.points} แต้ม ${r.deuce ? `ดิวถึง ${r.cap}` : 'ไม่ดิว'}`;
}

/** คำนวณกลุ่ม/ทีมต่อกลุ่มอัตโนมัติ */
export function groupPlan(n: number, mode: 'groups' | 'perGroup', value: number): { groups: number; perGroup: number } {
  const v = Math.max(1, Math.floor(value) || 1);
  if (mode === 'groups') {
    const g = Math.min(v, Math.max(1, Math.floor(n / 2)));
    return { groups: g, perGroup: Math.ceil(n / g) };
  }
  const per = Math.max(2, v);
  const g = Math.max(1, Math.round(n / per));
  return { groups: g, perGroup: Math.ceil(n / g) };
}

/** แบ่งทีมลงกลุ่มแบบงู (snake) ตามลำดับที่ให้มา */
export function snakeGroups(ids: string[], G: number): string[][] {
  const groups: string[][] = Array.from({ length: G }, () => []);
  ids.forEach((id, i) => {
    const r = Math.floor(i / G);
    groups[r % 2 === 0 ? i % G : G - 1 - (i % G)].push(id);
  });
  return groups;
}

export const sumPrizes = (c?: { prizes?: { u?: number[]; l?: number[] } } | null): number =>
  [...(c?.prizes?.u || []), ...(c?.prizes?.l || [])].reduce((s, x) => s + (x || 0), 0);
export function prizeText(c?: { prizes?: { u?: number[]; l?: number[] } } | null): string {
  const f = (a?: number[]) => (a || []).map((x, i) => (x ? `${i + 1}:฿${x.toLocaleString('th-TH')}` : '')).filter(Boolean).join(' ');
  const u = f(c?.prizes?.u), l = f(c?.prizes?.l);
  return [u && `รางวัล${l ? 'สายบน' : ''} ${u}`, l && `สายล่าง ${l}`].filter(Boolean).join(' · ');
}
