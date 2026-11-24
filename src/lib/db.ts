import type {
  BracketMeta,
  Category,
  Court,
  Match,
  NotificationItem,
  Referee,
  Registration,
  RulePreset,
  Tournament,
} from '../types/matchon';
import { sb } from './supabase';

export interface Data {
  tournaments: Tournament[];
  categories: Category[];
  registrations: Registration[];
  matches: Match[];
  courts: Court[];
  brackets: BracketMeta[];
  rules: RulePreset[];
  referees: Referee[];
  notifications: NotificationItem[];
}

export const EMPTY_DATA: Data = {
  tournaments: [],
  categories: [],
  registrations: [],
  matches: [],
  courts: [],
  brackets: [],
  rules: [],
  referees: [],
  notifications: [],
};

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: 'player' | 'organizer' | 'staff' | 'referee' | 'super_admin' | null;
}

// ---------- tokens of registrations made without logging in ----------
const TOKEN_KEY = 'matchon.regTokens';
export type RegTokens = Record<string, string>;
export function loadTokens(): RegTokens {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}') as RegTokens;
  } catch {
    return {};
  }
}
export function saveToken(regId: string, token: string): void {
  try {
    const t = loadTokens();
    t[regId] = token;
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  } catch {
    /* private mode */
  }
}

// ---------- mappers ----------
const bangkokDay = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }) : '';
const bangkokDT = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T').slice(0, 16) : '';
const toCE = (y?: number | null): number | null => (y ? (y > 2400 ? y - 543 : y) : null);
const toBE = (y?: number | null): number | null => (y ? y + 543 : null);
const digits = (s?: string | null): string | null => {
  const d = (s || '').replace(/\D/g, '');
  return d.length === 10 || d.length === 13 || d.length === 15 ? d : null;
};
const NOTE_OUT: Record<string, string> = { approval: 'approved' };
const NOTE_IN: Record<string, NotificationItem['kind']> = { approved: 'approval', info: 'approval' };

export const tournamentFromDb = (r: any): Tournament & { organizer_id: string; live_id: string | null } => ({
  id: r.id,
  slug: r.slug || r.id.slice(0, 8),
  name: r.name,
  venue: r.venue || '',
  description: r.description || '',
  start_date: r.start_date || '',
  end_date: r.end_date || r.start_date || '',
  reg_deadline: bangkokDT(r.reg_deadline),
  courts: r.courts || 4,
  status: r.status === 'draft' || r.status === 'live' || r.status === 'finished' ? 'closed' : r.status,
  promptpay_id: r.promptpay_id || '',
  match_minutes: r.match_minutes || 30,
  rest_minutes: r.rest_minutes ?? 15,
  organizer_id: r.organizer_id,
  live_id: r.live_id || null,
  poster: (Array.isArray(r.posters) && r.posters[0]) || r.poster || null,
  posters: Array.isArray(r.posters) && r.posters.length ? r.posters : r.poster ? [r.poster] : [],
  format_text: r.format_text || '',
  rules_text: r.rules_text || '',
  notice: r.notice || '',
});

const tournamentToDb = (t: Tournament & { organizer_id?: string }, uid: string) => ({
  id: t.id,
  organizer_id: t.organizer_id || uid,
  slug: `${(t.slug || 'event').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'event'}-${t.id.slice(0, 5)}`,
  name: t.name.length < 3 ? `${t.name}   `.slice(0, 3).padEnd(3, '_') : t.name.slice(0, 120),
  venue: t.venue || null,
  description: t.description || null,
  start_date: t.start_date || null,
  end_date: t.end_date || t.start_date || null,
  reg_deadline: t.reg_deadline ? (t.reg_deadline.length > 10 ? `${t.reg_deadline.slice(0, 16)}:00+07:00` : `${t.reg_deadline}T23:59:59+07:00`) : null,
  courts: Math.min(40, Math.max(1, t.courts || 1)),
  status: t.status === 'open' ? 'open' : 'closed',
  promptpay_id: digits(t.promptpay_id),
  match_minutes: Math.min(180, Math.max(5, t.match_minutes || 30)),
  rest_minutes: Math.min(120, Math.max(0, t.rest_minutes ?? 15)),
  poster: (t.posters && t.posters[0]) || t.poster || null,
  posters: t.posters && t.posters.length ? t.posters : t.poster ? [t.poster] : [],
  format_text: t.format_text || null,
  rules_text: t.rules_text || null,
  notice: t.notice || null,
});

const categoryFromDb = (r: any): Category => ({
  id: r.id,
  tournament_id: r.tournament_id,
  name: r.name,
  kind: r.kind,
  gender: r.gender || 'open',
  level: r.level || null,
  age_min: r.age_min ?? null,
  age_max: r.age_max ?? null,
  max_teams: r.max_teams || 16,
  fee: r.fee || 0,
  shuttle_fee: r.shuttle_fee || 0,
  shuttle_qty: r.shuttle_qty || 0,
  prizes: r.prizes && typeof r.prizes === 'object' ? r.prizes : {},
  format: r.format || 'knockout',
  best_of: r.best_of || 3,
  points: r.points || 21,
  cap: r.cap || 30,
  deuce: r.deuce !== false,
  play_two: !!r.play_two,
  rule_group: r.rule_group || null,
  rule_ko: r.rule_ko || null,
});

const categoryToDb = (c: Category, ruleIds: Set<string>) => ({
  id: c.id,
  tournament_id: c.tournament_id,
  name: c.name.slice(0, 80),
  kind: c.kind,
  gender: c.gender,
  level: c.level || null,
  age_min: c.age_min ?? null,
  age_max: c.age_max ?? null,
  max_teams: Math.min(512, Math.max(2, c.max_teams || 16)),
  fee: Math.max(0, c.fee || 0),
  shuttle_fee: Math.max(0, c.shuttle_fee || 0),
  shuttle_qty: Math.max(0, c.shuttle_qty || 0),
  prizes: c.prizes || {},
  format: c.format,
  best_of: [1, 3, 5].includes(c.best_of) ? c.best_of : 3,
  points: Math.min(50, Math.max(5, c.points || 21)),
  cap: Math.min(99, Math.max(5, c.cap || 30)),
  deuce: c.deuce !== false,
  play_two: !!c.play_two,
  rule_group: c.rule_group && ruleIds.has(c.rule_group) ? c.rule_group : null,
  rule_ko: c.rule_ko && ruleIds.has(c.rule_ko) ? c.rule_ko : null,
});

export const registrationFromDb = (r: any): Registration => ({
  id: r.id,
  tournament_id: r.tournament_id,
  category_id: r.category_id,
  club: r.club || '',
  p1_name: r.p1_name || '',
  p1_nick: r.p1_nick || '',
  p1_phone: r.p1_phone || '',
  p1_year: toBE(r.p1_birth_year),
  p1_photo: r.p1_photo || null,
  p1_history: r.p1_history || '',
  p2_name: r.p2_name || undefined,
  p2_nick: r.p2_nick || undefined,
  p2_phone: r.p2_phone || undefined,
  p2_year: toBE(r.p2_birth_year),
  p2_photo: r.p2_photo || null,
  p2_history: r.p2_history || '',
  status: r.status || 'pending',
  pay_status: r.pay_status || 'unpaid',
  note: r.note || '',
  video_url: r.video_url || '',
  seed: r.seed ?? null,
  slip_path: r.slip_path || null,
  created_at: r.created_at,
});

const registrationToDb = (r: Registration) => ({
  category_id: r.category_id,
  club: r.club || null,
  p1_name: r.p1_name,
  p1_nick: r.p1_nick || null,
  p1_phone: r.p1_phone || null,
  p1_birth_year: toCE(r.p1_year),
  p1_photo: r.p1_photo || null,
  p1_history: r.p1_history || null,
  p2_name: r.p2_name || null,
  p2_nick: r.p2_nick || null,
  p2_phone: r.p2_phone || null,
  p2_birth_year: toCE(r.p2_year),
  p2_photo: r.p2_photo || null,
  p2_history: r.p2_history || null,
  status: r.status,
  pay_status: r.pay_status,
  note: r.note || null,
  video_url: r.video_url || null,
  seed: r.seed ?? null,
});

const matchFromDb = (r: any): Match => ({
  id: r.id,
  tournament_id: r.tournament_id,
  category_id: r.category_id,
  match_no: r.match_no ?? null,
  round: r.round,
  round_label: r.round_label || '',
  slot: r.slot ?? 0,
  stage: r.stage || 'main',
  group_no: r.group_no ?? undefined,
  reg_a: r.reg_a,
  reg_b: r.reg_b,
  status: r.status || 'scheduled',
  court: r.court ?? null,
  scheduled_at: r.scheduled_at,
  sets: Array.isArray(r.sets) ? r.sets : [],
  cur_a: r.cur_a || 0,
  cur_b: r.cur_b || 0,
  winner: r.winner,
  next_match: r.next_match,
  next_slot: r.next_slot,
  updated_at: r.updated_at || new Date().toISOString(),
});

const matchToDb = (m: Match) => ({
  id: m.id,
  tournament_id: m.tournament_id,
  category_id: m.category_id,
  match_no: m.match_no,
  round: m.round,
  round_label: m.round_label,
  slot: m.slot,
  stage: m.stage,
  group_no: m.group_no ?? null,
  reg_a: m.reg_a,
  reg_b: m.reg_b,
  status: m.status,
  court: m.court,
  scheduled_at: m.scheduled_at,
  sets: m.sets,
  cur_a: m.cur_a,
  cur_b: m.cur_b,
  winner: m.winner,
  next_match: m.next_match,
  next_slot: m.next_slot,
  updated_at: m.updated_at,
});

// ---------- loading ----------
export interface Loaded {
  data: Data;
  profile: Profile | null;
  manageable: Set<string>;
}

export async function loadProfile(): Promise<Profile | null> {
  const { data: s } = await sb.auth.getSession();
  const u = s.session?.user;
  if (!u) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
  const meta: any = u.user_metadata || {};
  const pic: string | null = meta.picture || meta.avatar_url || null;
  let avatar: string | null = data?.avatar_url || null;
  // first LINE login: copy the LINE profile picture / name into the profile
  if (!avatar && pic) {
    avatar = pic;
    void sb.rpc('update_my_profile', { p_name: data?.display_name ? null : meta.name || null, p_phone: null, p_avatar: pic });
  }
  return {
    id: u.id,
    email: u.email || '',
    display_name: data?.display_name || meta.name || null,
    avatar_url: avatar,
    phone: data?.phone || null,
    role: (data?.role as Profile['role']) || 'player',
  };
}

export async function rpcUpdateProfile(name: string, phone: string, avatar?: string | null): Promise<void> {
  const { error } = await sb.rpc('update_my_profile', { p_name: name, p_phone: phone, p_avatar: avatar || null });
  if (error) throw error;
}

export interface StaffRow {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export async function loadAll(profile: Profile | null): Promise<Loaded> {
  const [tr, cr, mr, kr, br, rr] = await Promise.all([
    sb.from('tournaments').select('*').order('created_at', { ascending: false }),
    sb.from('categories').select('*').order('sort').order('created_at'),
    sb.from('matches').select('*').order('match_no'),
    sb.from('courts').select('*').order('no'),
    sb.from('brackets').select('*'),
    sb.from('tournament_rules').select('*').order('created_at'),
  ]);
  const tournaments = (tr.data || []).map(tournamentFromDb);

  // which tournaments can this user write to? (owner, staff, or super admin)
  const manageable = new Set<string>();
  if (profile) {
    if (profile.role === 'super_admin') tournaments.forEach((t) => manageable.add(t.id));
    tournaments.filter((t) => t.organizer_id === profile.id).forEach((t) => manageable.add(t.id));
    const st = await sb.from('tournament_staff').select('tournament_id').eq('user_id', profile.id);
    (st.data || []).forEach((x: any) => manageable.add(x.tournament_id));
  }

  // registrations: full rows for managers, public listing for everyone else
  const regs = new Map<string, Registration>();
  const mine = new Set<string>();
  if (manageable.size) {
    const rg = await sb.from('registrations').select('*').order('created_at', { ascending: false });
    (rg.data || []).forEach((r: any) => regs.set(r.id, registrationFromDb(r)));
  }
  const publicTs = tournaments.filter((t) => !manageable.has(t.id));
  await Promise.all(
    publicTs.map(async (t) => {
      const { data } = await sb.rpc('public_entries', { p_tournament: t.id });
      (data || []).forEach((r: any) => {
        if (!regs.has(r.id)) {
          regs.set(r.id, registrationFromDb({ ...r, tournament_id: t.id, p1_phone: '' }));
        }
      });
    }),
  );
  if (profile) {
    const own = await sb.from('registrations').select('*').eq('user_id', profile.id);
    (own.data || []).forEach((r: any) => {
      regs.set(r.id, registrationFromDb(r));
      mine.add(r.id);
    });
  }
  const tokens = loadTokens();
  await Promise.all(
    Object.entries(tokens).map(async ([id, token]) => {
      if (mine.has(id)) return;
      const { data } = await sb.rpc('my_registration', { p_reg: id, p_token: token });
      if (!data) return;
      const base = regs.get(id);
      regs.set(id, {
        ...(base || registrationFromDb({ id, tournament_id: data.tournament_id, category_id: '', p1_name: data.p1_name })),
        id,
        tournament_id: data.tournament_id,
        club: data.club || base?.club || '',
        p1_name: data.p1_name,
        p1_nick: data.p1_nick || '',
        p1_phone: data.p1_phone || '',
        p1_year: toBE(data.p1_birth_year),
        p1_photo: data.p1_photo || null,
        p1_history: data.p1_history || '',
        p2_name: data.p2_name || undefined,
        p2_nick: data.p2_nick || undefined,
        p2_phone: data.p2_phone || undefined,
        p2_year: toBE(data.p2_birth_year),
        p2_photo: data.p2_photo || null,
        p2_history: data.p2_history || '',
        status: data.status,
        pay_status: data.pay_status,
        note: data.note || '',
        video_url: data.video_url || '',
        category_id: base?.category_id || '',
        created_at: base?.created_at || new Date().toISOString(),
        edit_token: token,
        reg_open: !!data.open,
      } as Registration);
      mine.add(id);
    }),
  );
  const registrations = [...regs.values()].map((r) => (mine.has(r.id) ? { ...r, is_mine: true } : r));
  // attach tokens to my own rows (needed for the edit/slip RPCs)
  registrations.forEach((r: any) => {
    if (r.is_mine && !r.edit_token && tokens[r.id]) r.edit_token = tokens[r.id];
  });

  // notifications + referees
  let notifications: NotificationItem[] = [];
  let referees: Referee[] = [];
  if (manageable.size) {
    const [nr, rf] = await Promise.all([
      sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('referees').select('*').order('court_no'),
    ]);
    notifications = (nr.data || []).map(noteFromDb);
    referees = (rf.data || []) as Referee[];
  }
  for (const r of registrations) {
    if (!r.is_mine || manageable.has(r.tournament_id)) continue;
    const tok = (r as any).edit_token;
    if (!tok) continue;
    const { data } = await sb.rpc('my_notifications', { p_reg: r.id, p_token: tok });
    (data || []).forEach((n: any) => notifications.push(noteFromDb(n)));
  }

  const rules = (rr.data || []) as RulePreset[];
  return {
    data: {
      tournaments: tournaments as Tournament[],
      categories: (cr.data || []).map(categoryFromDb),
      registrations,
      matches: (mr.data || []).map(matchFromDb),
      courts: (kr.data || []) as Court[],
      brackets: (br.data || []).map((b: any) => ({
        tournament_id: b.tournament_id,
        category_id: b.category_id,
        format: b.format,
        groups: b.groups || 2,
        advance: b.advance || 2,
        seeded: !!b.seeded,
        locked: !!b.locked,
        has_lower: !!b.has_lower,
      })),
      rules: rules.map((r: any) => ({ id: r.id, tournament_id: r.tournament_id, name: r.name, best_of: r.best_of, points: r.points, deuce: r.deuce, cap: r.cap, play_two: !!r.play_two, win_pts: r.win_pts ?? 2, draw_pts: r.draw_pts ?? 1, loss_pts: r.loss_pts ?? 0 })),
      referees,
      notifications,
    },
    profile,
    manageable,
  };
}

function noteFromDb(n: any): NotificationItem {
  return {
    id: n.id,
    tournament_id: n.tournament_id,
    registration_id: n.registration_id,
    kind: (NOTE_IN[n.kind] || n.kind) as NotificationItem['kind'],
    title: n.title,
    body: n.body || '',
    created_at: n.created_at,
    read: false,
  };
}

// Light refresh used while watching live scores.
export async function loadLive(): Promise<{ matches: Match[]; courts: Court[] }> {
  const [mr, kr] = await Promise.all([sb.from('matches').select('*').order('match_no'), sb.from('courts').select('*').order('no')]);
  return { matches: (mr.data || []).map(matchFromDb), courts: (kr.data || []) as Court[] };
}

// ---------- writing (diff of two states) ----------
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const chunk = <T,>(arr: T[], n = 200): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
async function must(p: PromiseLike<{ error: any }>): Promise<void> {
  const { error } = await p;
  if (error) throw error;
}

function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const pm = new Map(prev.map((x) => [x.id, x]));
  const nm = new Map(next.map((x) => [x.id, x]));
  return {
    added: next.filter((x) => !pm.has(x.id)),
    changed: next.filter((x) => pm.has(x.id) && !same(pm.get(x.id), x)),
    removed: prev.filter((x) => !nm.has(x.id)),
  };
}

export async function pushDiff(prev: Data, next: Data, uid: string, manageable: Set<string>): Promise<void> {
  const ok = (tid: string) => manageable.has(tid);

  // tournaments first (everything else references them)
  const td = diff(prev.tournaments, next.tournaments);
  const tRows = [...td.added, ...td.changed]
    .filter((t) => td.added.includes(t) || ok(t.id))
    .map((t) => tournamentToDb(t as any, uid));
  if (tRows.length) await must(sb.from('tournaments').upsert(tRows, { onConflict: 'id' }));
  td.added.forEach((t) => manageable.add(t.id));

  // rules before categories (categories reference them)
  const rd = diff(prev.rules, next.rules);
  const rRows = [...rd.added, ...rd.changed].filter((r) => ok(r.tournament_id)).map((r) => ({
    id: r.id, tournament_id: r.tournament_id, name: r.name, best_of: r.best_of, points: r.points, deuce: r.deuce, cap: r.cap, play_two: !!r.play_two, win_pts: r.win_pts ?? 2, draw_pts: r.draw_pts ?? 1, loss_pts: r.loss_pts ?? 0,
  }));
  if (rRows.length) await must(sb.from('tournament_rules').upsert(rRows, { onConflict: 'id' }));

  const ruleIds = new Set(next.rules.map((r) => r.id));
  const cd = diff(prev.categories, next.categories);
  const cRows = [...cd.added, ...cd.changed].filter((c) => ok(c.tournament_id)).map((c) => categoryToDb(c, ruleIds));
  if (cRows.length) await must(sb.from('categories').upsert(cRows, { onConflict: 'id' }));

  const ctd = diff(prev.courts, next.courts);
  const kRows = [...ctd.added, ...ctd.changed].filter((c) => ok(c.tournament_id)).map((c) => ({
    id: c.id, tournament_id: c.tournament_id, no: c.no, name: c.name, status: c.status, queue: c.queue || [],
  }));
  if (kRows.length) await must(sb.from('courts').upsert(kRows, { onConflict: 'id' }));
  const kDel = ctd.removed.filter((c) => ok(c.tournament_id)).map((c) => c.id);
  if (kDel.length) await must(sb.from('courts').delete().in('id', kDel));

  const rfd = diff(prev.referees, next.referees);
  const rfRows = [...rfd.added, ...rfd.changed].filter((r) => ok(r.tournament_id)).map((r) => ({
    id: r.id, tournament_id: r.tournament_id, name: r.name, phone: r.phone || null, court_no: r.court_no,
  }));
  if (rfRows.length) await must(sb.from('referees').upsert(rfRows, { onConflict: 'id' }));
  if (rfd.removed.length) await must(sb.from('referees').delete().in('id', rfd.removed.map((r) => r.id)));

  // brackets are keyed by category
  const key = (b: BracketMeta) => ({ ...b, id: b.category_id });
  const bd = diff(prev.brackets.map(key), next.brackets.map(key));
  const bRows = [...bd.added, ...bd.changed].filter((b) => ok(b.tournament_id)).map((b) => ({
    tournament_id: b.tournament_id, category_id: b.category_id, format: b.format,
    groups: Math.min(16, Math.max(1, b.groups || 1)), advance: Math.min(8, Math.max(1, b.advance || 1)), seeded: b.seeded, locked: b.locked, has_lower: !!b.has_lower,
  }));
  if (bRows.length) await must(sb.from('brackets').upsert(bRows, { onConflict: 'category_id' }));

  // registrations: edits only (new ones go through the register RPCs)
  const pr = new Map(prev.registrations.map((r) => [r.id, r]));
  for (const r of next.registrations) {
    const p = pr.get(r.id);
    if (!p || !ok(r.tournament_id)) continue;
    const a = registrationToDb(p), b = registrationToDb(r);
    if (same(a, b)) continue;
    await must(sb.from('registrations').update(b).eq('id', r.id));
  }

  // matches: remove, then insert/update in one batch (self references are checked at statement end)
  const md = diff(prev.matches, next.matches);
  const mDel = md.removed.filter((m) => ok(m.tournament_id));
  for (const part of chunk(mDel.map((m) => m.id))) await must(sb.from('matches').delete().in('id', part));
  const mRows = [...md.added, ...md.changed].filter((m) => ok(m.tournament_id)).map(matchToDb);
  for (const part of chunk(mRows)) await must(sb.from('matches').upsert(part, { onConflict: 'id' }));

  // notifications: insert new only
  const nd = diff(prev.notifications, next.notifications);
  const regIds = new Set(next.registrations.map((r) => r.id));
  const nRows = nd.added.filter((n) => ok(n.tournament_id) && regIds.has(n.registration_id)).map((n) => ({
    id: n.id, tournament_id: n.tournament_id, registration_id: n.registration_id,
    kind: NOTE_OUT[n.kind] || n.kind, title: n.title.slice(0, 120), body: (n.body || '').slice(0, 500),
  }));
  for (const part of chunk(nRows)) await must(sb.from('notifications').insert(part));

  // finally removals of whole tournaments / categories (children cascade in the database)
  const cDel = cd.removed.filter((c) => ok(c.tournament_id)).map((c) => c.id);
  if (cDel.length) await must(sb.from('categories').delete().in('id', cDel));
  const brDel = bd.removed.filter((b) => ok(b.tournament_id)).map((b) => b.category_id);
  if (brDel.length) await must(sb.from('brackets').delete().in('category_id', brDel));
  const rDel = rd.removed.filter((r) => ok(r.tournament_id)).map((r) => r.id);
  if (rDel.length) await must(sb.from('tournament_rules').delete().in('id', rDel));
  const tDel = td.removed.filter((t) => ok(t.id)).map((t) => t.id);
  if (tDel.length) await must(sb.from('tournaments').delete().in('id', tDel));
}

// ---------- registration RPCs ----------
export interface PersonInput {
  name: string;
  nick?: string;
  phone?: string;
  year?: number | null;
  photo?: string | null;
  history?: string;
}

const person = (p: PersonInput | undefined, club?: string) => ({
  name: p?.name || '',
  nick: p?.nick || '',
  phone: p?.phone || '',
  birth_year: toCE(p?.year),
  photo: p?.photo || null,
  history: p?.history || '',
  club: club || '',
});

export async function rpcRegister(args: {
  tournamentId: string;
  categoryId: string;
  club: string;
  p1: PersonInput;
  p2?: PersonInput;
  video?: string;
}): Promise<{ id: string; token: string; status: string }> {
  const { data, error } = await sb.rpc('register_team', {
    p_tournament: args.tournamentId,
    p_category: args.categoryId,
    p_p1: person(args.p1, args.club),
    p_p2: args.p2 ? person(args.p2) : {},
    p_video: args.video?.trim() || null,
  });
  if (error) throw error;
  saveToken(data.id, data.token);
  return data;
}

export async function rpcAdminAdd(args: {
  tournamentId: string;
  categoryId: string;
  club: string;
  p1: PersonInput;
  p2?: PersonInput;
  status: 'pending' | 'confirmed' | 'waitlist';
  paid: boolean;
}): Promise<void> {
  const { error } = await sb.rpc('admin_add_registration', {
    p_tournament: args.tournamentId,
    p_category: args.categoryId,
    p_p1: person(args.p1, args.club),
    p_p2: args.p2 ? person(args.p2) : {},
    p_status: args.status,
    p_paid: args.paid,
  });
  if (error) throw error;
}

export async function rpcUpdateRegistration(args: {
  id: string;
  token: string;
  club: string;
  p1: PersonInput;
  p2?: PersonInput;
  video?: string;
}): Promise<void> {
  const { error } = await sb.rpc('update_registration', {
    p_reg: args.id,
    p_token: args.token,
    p_club: args.club,
    p_p1: person(args.p1),
    p_p2: args.p2 ? person(args.p2) : {},
    p_video: args.video ?? '',
  });
  if (error) throw error;
}

export async function rpcSubmitSlip(id: string, token: string, path: string): Promise<void> {
  const { error } = await sb.rpc('submit_slip', { p_reg: id, p_token: token, p_path: path });
  if (error) throw error;
}

export async function deleteRegistrationDb(id: string): Promise<void> {
  const { error } = await sb.from('registrations').delete().eq('id', id);
  if (error) throw error;
}

export async function slipSignedUrl(path: string): Promise<string> {
  const { data, error } = await sb.storage.from('slips').createSignedUrl(path, 600);
  if (error || !data) throw error || new Error('เปิดสลิปไม่ได้');
  return data.signedUrl;
}

export async function rpcCancelMyRegistration(id: string, token: string): Promise<void> {
  const { error } = await sb.rpc('cancel_my_registration', { p_reg: id, p_token: token });
  if (error) throw error;
}

export async function rpcDeleteMyRegistration(id: string, token: string): Promise<void> {
  const { error } = await sb.rpc('delete_my_registration', { p_reg: id, p_token: token });
  if (error) throw error;
}
