import { finishLineLogin } from '../lib/line';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BracketFormat,
  BracketMeta,
  Category,
  Court,
  Match,
  MatchONState,
  NavRoute,
  PayStatus,
  Referee,
  Registration,
  RulePreset,
  Tournament,
} from '../types/matchon';
import {
  buildKnockout,
  buildRoundRobin,
  clubGroups,
  computeStandings,
  standingPtsFor,
  eligibleForBracket,
  bracketSize,
  avoidSameGroupFirstRound,
  type StandingRow,
  matchResult,
  matchWinner,
  planAutoSchedule,
  ruleForMatch,
  setWinner,
  shuffle,
  uuid,
} from '../utils/bracket';
import { avatarDataUri, sb } from '../lib/supabase';
import {
  EMPTY_DATA,
  loadAll,
  loadProfile,
  deleteRegistrationDb,
  pushDiff,
  rpcAdminAdd,
  rpcRegister,
  type Data,
  type Profile,
  setTournamentFeatured,
} from '../lib/db';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'ok' | 'err' | 'info';
}

interface MatchONContextValue {
  state: MatchONState;
  loading: boolean;
  profile: Profile | null;
  canCreate: boolean;
  isAdmin: boolean;
  isManagerOf: (tid: string) => boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  route: NavRoute;
  navigate: (next: NavRoute, opts?: { regTid?: string; filter?: string }) => void;
  routeParam: string | null;
  activeTournament: Tournament | null;
  setActiveTid: (id: string) => void;
  clearActiveTid: () => void;
  toast: (text: string, tone?: 'ok' | 'err' | 'info') => void;
  toasts: ToastMessage[];

  // Derived collections for active tournament
  tCategories: Category[];
  tRegistrations: Registration[];
  tMatches: Match[];
  tCourts: Court[];
  tBrackets: BracketMeta[];
  tRules: RulePreset[];
  tReferees: Referee[];
  regMap: Record<string, Registration>;
  catMap: Record<string, Category>;

  // Actions
  saveTournament: (data: Omit<Tournament, 'id' | 'slug'> & { id?: string }) => string;
  toggleFeatured: (id: string) => void;
  toggleTournamentStatus: (id: string) => void;
  deleteTournament: (id: string) => void;
  saveCategory: (data: Omit<Category, 'id'> & { id?: string }) => void;
  deleteCategory: (id: string) => void;
  addRegistration: (
    data: Omit<Registration, 'id' | 'created_at' | 'status' | 'pay_status' | 'seed'>,
    opts?: { autoConfirm?: boolean; payStatus?: PayStatus },
  ) => Promise<{ id: string; token?: string } | null>;
  simulateRegistrations: (categoryId: string, count?: number) => void;
  updateRegistration: (id: string, patch: Partial<Registration>) => void;
  deleteRegistration: (id: string) => Promise<boolean>;
  generateBracket: (
    categoryId: string,
    opts: { format: BracketFormat; groups: number; advance: number; seeded: boolean; hasLower?: boolean; manualGroups?: string[][] },
  ) => void;
  toggleBracketLock: (categoryId: string) => void;
  clearBracket: (categoryId: string) => void;
  generateGroupKnockoutStage: (categoryId: string, opts?: { fill?: boolean }) => void;
  generateNextSwissRound: (categoryId: string) => void;
  setGroupTeams: (categoryId: string, groupNo: number, teamIds: string[]) => boolean;
  recordMatchSets: (matchId: string, sets: [number, number][], liveCur?: [number, number] | null, silent?: boolean, force?: boolean) => void;
  adjustLivePoint: (matchId: string, side: 'a' | 'b', delta: 1 | -1) => void;
  returnMatchToQueue: (matchId: string) => void;
  updateMatchMeta: (matchId: string, patch: Partial<Match>) => void;
  runAutoSchedule: (startIso: string, courtNos: number[], timeOnly?: boolean, setTime?: boolean, catStarts?: Record<string, string>, opts?: { order?: string[]; matchMin?: number; restMin?: number }) => number;
  clearSchedule: () => number;
  callMatchToCourt: (matchId: string, courtNo: number) => void;
  cancelCourtCall: (matchId: string) => void;
  toggleCourtMaintenance: (courtId: string) => void;
  addCourt: () => void;
  deleteCourt: (courtId: string) => void;
  setCourtQueue: (courtId: string, ids: string[]) => void;
  restoreBackup: (bk: any) => { ok: boolean; msg: string };
  addRulePreset: (rule: Omit<RulePreset, 'id'>) => void;
  deleteRulePreset: (id: string) => void;
  updateRulePreset: (id: string, patch: Partial<RulePreset>) => void;
  assignCategoryRule: (catId: string, kind: 'group' | 'ko', ruleId: string | null) => void;
  addReferee: (ref: Omit<Referee, 'id'>) => void;
  updateReferee: (id: string, patch: Partial<Referee>) => void;
  assignReferee: (refId: string | null, courtNo: number) => void;
  addStandardRules: () => void;
  deleteReferee: (id: string) => void;
}

const MatchONContext = createContext<MatchONContextValue | null>(null);

const dataOf = (s: MatchONState): Data => ({
  tournaments: s.tournaments,
  categories: s.categories,
  registrations: s.registrations,
  matches: s.matches,
  courts: s.courts,
  brackets: s.brackets,
  rules: s.rules,
  referees: s.referees,
  notifications: s.notifications,
});

const ACTIVE_KEY = 'matchon.activeTid';
const ROUTE_KEY = 'matchon.route';
// หน้าที่จำตอนรีเฟรชได้ (ไม่รวมหน้าที่ต้องมีข้อมูลประกอบ)
const ROUTES_OK: NavRoute[] = ['site', 'me', 'tournaments', 'home', 'my', 'athletes', 'roster', 'brackets', 'schedule', 'courts', 'live', 'rules', 'staff', 'results', 'reports', 'settings', 'mine', 'cats', 'info', 'dashboard', 'register', 'admin'];
const DEFAULT_REF_PHONE = '0801234567';
// one referee per court, created automatically; the organizer edits names / phones later
function withAutoReferees(referees: Referee[], tid: string, courtCount: number): Referee[] {
  const have = referees.filter((r) => r.tournament_id === tid).length;
  if (have >= courtCount) return referees;
  const add: Referee[] = [];
  for (let k = have + 1; k <= courtCount; k++) {
    add.push({ id: uuid(), tournament_id: tid, name: `กรรมการ${k}`, phone: DEFAULT_REF_PHONE, court_no: null });
  }
  return [...referees, ...add];
}
const INITIAL_STATE: MatchONState = { role: 'player', activeTid: '', ...EMPTY_DATA };

export function MatchONProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MatchONState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [route, setRoute] = useState<NavRoute>(() => {
    try {
      // ลิงก์แชร์: ?t=<id รายการ>&p=<หน้า>
      const qs = new URLSearchParams(window.location.search);
      const sharedT = qs.get('t');
      if (sharedT) {
        localStorage.setItem(ACTIVE_KEY, sharedT);
        const sp = qs.get('p') as NavRoute | null;
        window.history.replaceState(null, '', window.location.pathname);
        return sp && ROUTES_OK.includes(sp) ? sp : 'home';
      }
      const saved = localStorage.getItem(ROUTE_KEY) as NavRoute | null;
      return saved && ROUTES_OK.includes(saved) ? saved : 'tournaments';
    } catch {
      return 'tournaments';
    }
  });
  const [routeParam, setRouteParam] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const manageable = useRef<Set<string>>(new Set());
  const synced = useRef<Data>(EMPTY_DATA);
  const latest = useRef<Data>(EMPTY_DATA);
  const profileRef = useRef<Profile | null>(null);
  const timer = useRef<number | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const ready = useRef(false);

  const toast = useCallback((text: string, tone: 'ok' | 'err' | 'info' = 'ok') => {
    const id = uuid();
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  // role is derived from the signed in account, never chosen by hand
  const canCreate = !!profile && ['organizer', 'staff', 'super_admin'].includes(profile.role || '');
  const isAdmin = profile?.role === 'super_admin';
  const role = canCreate || manageable.current.size > 0 ? 'organizer' : 'player';

  const firstLoad = useRef(true);
  const applyLoaded = useCallback((l: Awaited<ReturnType<typeof loadAll>>) => {
    manageable.current = l.manageable;
    profileRef.current = l.profile;
    // every court gets a referee automatically (managers only)
    let referees = l.data.referees;
    for (const t of l.data.tournaments) {
      if (l.manageable.has(t.id)) {
        referees = withAutoReferees(referees, t.id, l.data.courts.filter((c) => c.tournament_id === t.id).length);
      }
    }
    const data2 = referees === l.data.referees ? l.data : { ...l.data, referees };
    synced.current = l.data;
    latest.current = data2;
    setProfile(l.profile);
    setState((prev) => {
      let activeTid = prev.activeTid;
      const first = firstLoad.current;
      firstLoad.current = false;
      if (!activeTid && first) {
        try {
          activeTid = localStorage.getItem(ACTIVE_KEY) || '';
        } catch {
          /* ignore */
        }
      }
      // หลังโหลดครั้งแรก ถ้าผู้ใช้ล้างการเลือกไว้ (activeTid ว่าง) ให้คงว่างไว้
      if ((first || activeTid) && !l.data.tournaments.some((t) => t.id === activeTid)) activeTid = l.data.tournaments[0]?.id || '';
      return { ...prev, ...data2, activeTid };
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const p = await loadProfile();
      applyLoaded(await loadAll(p));
    } catch (e) {
      console.error(e);
    }
  }, [applyLoaded]);

  // first load + react to sign in / sign out
  useEffect(() => {
    let alive = true;
    (async () => {
      try { await finishLineLogin(); } catch (e: any) { setTimeout(() => toast(`ล็อกอิน LINE ไม่สำเร็จ: ${e?.message || e}`, 'err'), 500); }
      await reload();
      if (alive) {
        ready.current = true;
        setLoading(false);
      }
    })();
    const { data: sub } = sb.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') {
        setTimeout(() => void reload(), 0);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [reload]);

  // write-behind sync: only accounts that can manage something ever write
  const flush = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    const p = profileRef.current;
    if (!p) return;
    busy.current = true;
    try {
      do {
        again.current = false;
        const cur = latest.current;
        await pushDiff(synced.current, cur, p.id, manageable.current);
        synced.current = cur;
      } while (again.current);
    } catch (e: any) {
      console.error(e);
      toast(`บันทึกไม่สำเร็จ: ${e?.message || 'ไม่ทราบสาเหตุ'}`, 'err');
      await reload();
    } finally {
      busy.current = false;
    }
  }, [reload, toast]);

  useEffect(() => {
    latest.current = dataOf(state);
    if (!ready.current || !profileRef.current) return;
    if (latest.current === synced.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 500);
  }, [state, flush]);

  // keep scores fresh for everyone (skip while there are unsaved local edits)
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (document.hidden || busy.current || timer.current) return;
      if (latest.current !== synced.current && JSON.stringify(latest.current) !== JSON.stringify(synced.current)) return;
      void reload();
    }, 20000);
    return () => window.clearInterval(iv);
  }, [reload]);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    toast('ออกจากระบบแล้ว', 'info');
  }, [toast]);

  const isManagerOf = useCallback((id: string) => manageable.current.has(id), [state.tournaments]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback(
    (next: NavRoute, opts?: { regTid?: string; filter?: string }) => {
      if (opts?.regTid) {
        setState((prev) => ({ ...prev, activeTid: opts.regTid! }));
      }
      // ไปหน้าที่ต้องใช้รายการแข่ง แต่ยังไม่ได้เลือก -> เลือกรายการแรกให้
      if (!opts?.regTid && next !== 'site' && next !== 'tournaments' && next !== 'me') {
        setState((prev) => (prev.activeTid || !prev.tournaments.length ? prev : { ...prev, activeTid: prev.tournaments[0].id }));
      }
      setRouteParam(opts?.filter ?? null);
      setRoute(next);
      try { localStorage.setItem(ROUTE_KEY, next); } catch { /* ignore */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const setActiveTid = useCallback((id: string) => {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
    setState((prev) => ({ ...prev, activeTid: id }));
  }, []);

  // กดโลโก้ MatchON -> หน้าเว็บหลัก และล้างรายการแข่งที่เลือกอยู่
  const clearActiveTid = useCallback(() => {
    try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
    setState((prev) => (prev.activeTid ? { ...prev, activeTid: '' } : prev));
  }, []);

  const activeTournament = useMemo(
    () => (state.activeTid ? state.tournaments.find((t) => t.id === state.activeTid) || state.tournaments[0] || null : null),
    [state.tournaments, state.activeTid],
  );

  const tid = activeTournament?.id || '';

  const tCategories = useMemo(
    () => state.categories.filter((c) => c.tournament_id === tid),
    [state.categories, tid],
  );
  const tRegistrations = useMemo(
    () => state.registrations.filter((r) => r.tournament_id === tid),
    [state.registrations, tid],
  );
  const tMatches = useMemo(
    () => state.matches.filter((m) => m.tournament_id === tid),
    [state.matches, tid],
  );
  const tCourts = useMemo(
    () => state.courts.filter((c) => c.tournament_id === tid).sort((a, b) => a.no - b.no),
    [state.courts, tid],
  );
  const tBrackets = useMemo(
    () => state.brackets.filter((b) => b.tournament_id === tid),
    [state.brackets, tid],
  );
  const tRules = useMemo(
    () => state.rules.filter((r) => r.tournament_id === tid),
    [state.rules, tid],
  );
  const tReferees = useMemo(
    () => state.referees.filter((r) => r.tournament_id === tid),
    [state.referees, tid],
  );

  const regMap = useMemo(
    () => Object.fromEntries(tRegistrations.map((r) => [r.id, r])),
    [tRegistrations],
  );
  const catMap = useMemo(
    () => Object.fromEntries(tCategories.map((c) => [c.id, c])),
    [tCategories],
  );

  // ติดดาวรายการแนะนำ (เฉพาะผู้ดูแลเว็บ)
  const toggleFeatured = useCallback(
    (id: string) => {
      const cur = stateRef.current.tournaments.find((t) => t.id === id);
      if (!cur) return;
      const next = !cur.featured;
      const apply = (v: boolean) => setState((prev) => ({ ...prev, tournaments: prev.tournaments.map((t) => (t.id === id ? { ...t, featured: v } : t)) }));
      apply(next);
      setTournamentFeatured(id, next)
        .then(() => toast(next ? 'ตั้งเป็นรายการแนะนำแล้ว' : 'เอาออกจากรายการแนะนำแล้ว'))
        .catch((e) => { apply(!next); toast(e?.message || 'ตั้งรายการแนะนำไม่สำเร็จ', 'err'); });
    },
    [toast],
  );

  const saveTournament = useCallback(
    (data: Omit<Tournament, 'id' | 'slug'> & { id?: string }): string => {
      const id = data.id || uuid();
      const slug =
        data.name
          .toLowerCase()
          .replace(/[^a-z0-9ก-๙]+/g, '-')
          .replace(/(^-|-$)/g, '') || id.slice(0, 8);
      setState((prev) => {
        const exists = prev.tournaments.some((t) => t.id === id);
        const nextT: Tournament = { ...data, id, slug };
        const tournaments = exists
          ? prev.tournaments.map((t) => (t.id === id ? nextT : t))
          : [nextT, ...prev.tournaments];

        // Sync courts count
        const curCourts = prev.courts.filter((c) => c.tournament_id === id);
        let otherCourts = prev.courts.filter((c) => c.tournament_id !== id);
        const desired = Math.min(20, Math.max(1, data.courts || 4));
        const synced: Court[] = [];
        for (let no = 1; no <= desired; no++) {
          const found = curCourts.find((c) => c.no === no);
          synced.push(found || { id: uuid(), tournament_id: id, no, name: `สนาม ${no}`, status: 'available' });
        }
        return {
          ...prev,
          activeTid: id,
          tournaments,
          courts: [...otherCourts, ...synced],
          referees: withAutoReferees(prev.referees, id, desired),
        };
      });
      toast(data.id ? 'บันทึกรายการแข่งขันแล้ว' : 'สร้างรายการแข่งขันใหม่แล้ว');
      return id;
    },
    [toast],
  );

  const toggleTournamentStatus = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        tournaments: prev.tournaments.map((t) =>
          t.id === id ? { ...t, status: t.status === 'open' ? 'closed' : 'open' } : t,
        ),
      }));
      toast('อัปเดตสถานะการรับสมัครแล้ว');
    },
    [toast],
  );

  const deleteTournament = useCallback(
    (id: string) => {
      setState((prev) => {
        const tournaments = prev.tournaments.filter((t) => t.id !== id);
        return {
          ...prev,
          tournaments,
          activeTid: prev.activeTid === id ? tournaments[0]?.id || '' : prev.activeTid,
          categories: prev.categories.filter((c) => c.tournament_id !== id),
          registrations: prev.registrations.filter((r) => r.tournament_id !== id),
          matches: prev.matches.filter((m) => m.tournament_id !== id),
          courts: prev.courts.filter((c) => c.tournament_id !== id),
          brackets: prev.brackets.filter((b) => b.tournament_id !== id),
        };
      });
      toast('ลบรายการแข่งขันแล้ว');
    },
    [toast],
  );

  const saveCategory = useCallback(
    (data: Omit<Category, 'id'> & { id?: string }) => {
      const id = data.id || uuid();
      setState((prev) => {
        const exists = prev.categories.some((c) => c.id === id);
        const nextCat: Category = { ...data, id };
        return {
          ...prev,
          categories: exists
            ? prev.categories.map((c) => (c.id === id ? nextCat : c))
            : [...prev.categories, nextCat],
        };
      });
      toast(data.id ? 'แก้ไขรุ่นแข่งขันแล้ว' : 'เพิ่มรุ่นแข่งขันแล้ว');
    },
    [toast],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        registrations: prev.registrations.filter((r) => r.category_id !== id),
        matches: prev.matches.filter((m) => m.category_id !== id),
        brackets: prev.brackets.filter((b) => b.category_id !== id),
      }));
      toast('ลบรุ่นแข่งขันแล้ว');
    },
    [toast],
  );

  const addRegistration = useCallback(
    async (
      data: Omit<Registration, 'id' | 'created_at' | 'status' | 'pay_status' | 'seed'>,
      opts?: { autoConfirm?: boolean; payStatus?: PayStatus },
    ): Promise<{ id: string; token?: string } | null> => {
      const p1 = { name: data.p1_name, nick: data.p1_nick, phone: data.p1_phone, year: data.p1_year, photo: data.p1_photo, history: data.p1_history };
      const p2 = data.p2_name
        ? { name: data.p2_name, nick: data.p2_nick, phone: data.p2_phone, year: data.p2_year, photo: data.p2_photo, history: data.p2_history }
        : undefined;
      try {
        let out: { id: string; token?: string } | null = null;
        if (manageable.current.has(data.tournament_id)) {
          await rpcAdminAdd({
            tournamentId: data.tournament_id,
            categoryId: data.category_id,
            club: data.club,
            p1,
            p2,
            status: opts?.autoConfirm ? 'confirmed' : 'pending',
            paid: (opts?.payStatus ?? 'unpaid') === 'paid',
          });
        } else {
          out = await rpcRegister({ tournamentId: data.tournament_id, categoryId: data.category_id, club: data.club, p1, p2, video: data.video_url });
        }
        await reload();
        return out || { id: '' };
      } catch (e: any) {
        toast(e?.message || 'สมัครไม่สำเร็จ', 'err');
        return null;
      }
    },
    [reload, toast],
  );

  const simulateRegistrations = useCallback(
    (categoryId: string, count = 4) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat || !manageable.current.has(cat.tournament_id)) return;
      const sampleFirst = ['ก้อง', 'เบสท์', 'ไนท์', 'มิว', 'เจตน์', 'ออม', 'ฟ้า', 'ซัน', 'นิว', 'ตูน'];
      const sampleClubs = ['Smash Club', 'ก๊วนเจอแน่', 'Rama 9 Shuttle', 'Ari BC', 'Sathorn Smash'];
      void (async () => {
        try {
          for (let i = 0; i < count; i++) {
            const n1 = sampleFirst[Math.floor(Math.random() * sampleFirst.length)];
            const n2 = sampleFirst[Math.floor(Math.random() * sampleFirst.length)];
            const num = Math.floor(100 + Math.random() * 899);
            await rpcAdminAdd({
              tournamentId: cat.tournament_id,
              categoryId: cat.id,
              club: sampleClubs[Math.floor(Math.random() * sampleClubs.length)],
              p1: { name: `นักกีฬา ${n1} ทดสอบ ${num}`, nick: `${n1}${num % 10}`, phone: `089${num}1234`, photo: avatarDataUri(`${n1}${num}`) },
              p2: cat.kind === 'doubles' ? { name: `นักกีฬา ${n2} คู่`, nick: `${n2}${num % 7}`, photo: avatarDataUri(`${n2}${num}b`) } : undefined,
              status: 'confirmed',
              paid: true,
            });
          }
          await reload();
          toast(`เพิ่มนักกีฬาจำลอง ${count} ทีมในรุ่น ${cat.name} แล้ว`);
        } catch (e: any) {
          toast(e?.message || 'เพิ่มนักกีฬาจำลองไม่สำเร็จ', 'err');
        }
      })();
    },
    [state.categories, reload, toast],
  );

  const deleteRegistration = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await deleteRegistrationDb(id);
        setState((prev) => ({
          ...prev,
          registrations: prev.registrations.filter((r) => r.id !== id),
          matches: prev.matches.map((m) => ({
            ...m,
            reg_a: m.reg_a === id ? null : m.reg_a,
            reg_b: m.reg_b === id ? null : m.reg_b,
            winner: m.winner === id ? null : m.winner,
          })),
        }));
        toast('ลบใบสมัครแล้ว');
        return true;
      } catch (e: any) {
        toast(e?.message || 'ลบใบสมัครไม่สำเร็จ (ต้องเป็นเจ้าของรายการ)', 'err');
        return false;
      }
    },
    [toast],
  );

  const updateRegistration = useCallback(
    (id: string, patch: Partial<Registration>) => {
      setState((prev) => {
        const target = prev.registrations.find((r) => r.id === id);
        const updatedRegs = prev.registrations.map((r) => (r.id === id ? { ...r, ...patch } : r));
        const newNotes = [...prev.notifications];
        if (target && patch.status === 'confirmed' && target.status !== 'confirmed') {
          newNotes.unshift({
            id: uuid(),
            tournament_id: target.tournament_id,
            registration_id: target.id,
            kind: 'approval',
            title: 'ยืนยันสิทธิ์เข้าแข่งขันแล้ว',
            body: 'ผู้จัดอนุมัติใบสมัครของคุณเรียบร้อยแล้ว',
            created_at: new Date().toISOString(),
            read: false,
          });
        }
        return { ...prev, registrations: updatedRegs, notifications: newNotes };
      });
      toast('อัปเดตข้อมูลนักกีฬาแล้ว');
    },
    [toast],
  );

  const generateBracket = useCallback(
    (categoryId: string, opts: { format: BracketFormat; groups: number; advance: number; seeded: boolean; hasLower?: boolean; manualGroups?: string[][] }) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const teams = state.registrations.filter(
        (r) => r.category_id === categoryId && eligibleForBracket(r, cat),
      );
      if (teams.length < 2) {
        toast('ต้องมีทีมที่ผ่านและชำระแล้วอย่างน้อย 2 ทีม', 'err');
        return;
      }

      let order: Registration[];
      if (opts.seeded) {
        const seededList = teams.filter((r) => r.seed != null).sort((a, b) => (a.seed || 99) - (b.seed || 99));
        const rest = shuffle(teams.filter((r) => r.seed == null));
        order = [...seededList, ...rest];
      } else {
        order = shuffle(teams);
      }

      const ids = order.map((r) => r.id);
      const existingMaxNo = Math.max(
        0,
        ...state.matches
          .filter((m) => m.tournament_id === cat.tournament_id && m.category_id !== categoryId)
          .map((m) => m.match_no || 0),
      );
      let nextNo = existingMaxNo + 1;
      let rows: Match[] = [];

      if (opts.format === 'knockout') {
        rows = buildKnockout(ids, {
          tournamentId: cat.tournament_id,
          categoryId,
          startMatchNo: nextNo,
          stage: 'main',
        });
      } else if (opts.format === 'round_robin') {
        rows = buildRoundRobin(ids, {
          tournamentId: cat.tournament_id,
          categoryId,
          startMatchNo: nextNo,
          stage: 'main',
        });
      } else if (opts.format === 'group_stage' || opts.format === 'group_knockout') {
        const G = Math.max(1, opts.manualGroups ? opts.manualGroups.length : opts.groups || 2);
        if (opts.manualGroups ? opts.manualGroups.some((g) => g.length < 2) : ids.length < G * 2) {
          toast('จำนวนทีมน้อยเกินไปสำหรับจำนวนกลุ่มนี้ (อย่างน้อยกลุ่มละ 2 ทีม)', 'err');
          return;
        }
        const groups: string[][] = opts.manualGroups ? opts.manualGroups.map((g) => [...g]) : clubGroups(order, G);
        groups.forEach((g, gi) => {
          const gm = buildRoundRobin(g, {
            tournamentId: cat.tournament_id,
            categoryId,
            startMatchNo: nextNo,
            stage: 'group',
            groupNo: gi,
          });
          nextNo += gm.length;
          rows.push(...gm);
        });
      } else if (opts.format === 'swiss') {
        const half = Math.floor(ids.length / 2);
        for (let i = 0; i < half; i++) {
          rows.push({
            id: uuid(),
            tournament_id: cat.tournament_id,
            category_id: categoryId,
            match_no: null,
            round: 1,
            round_label: 'รอบที่ 1',
            slot: i,
            stage: 'swiss',
            reg_a: ids[i],
            reg_b: ids[i + half],
            status: 'scheduled',
            court: null,
            scheduled_at: null,
            sets: [],
            cur_a: 0,
            cur_b: 0,
            winner: null,
            next_match: null,
            next_slot: null,
            updated_at: new Date().toISOString(),
          });
        }
      }

      setState((prev) => ({
        ...prev,
        matches: [...prev.matches.filter((m) => m.category_id !== categoryId), ...rows],
        brackets: [
          ...prev.brackets.filter((b) => b.category_id !== categoryId),
          {
            tournament_id: cat.tournament_id,
            category_id: categoryId,
            format: opts.format,
            groups: opts.groups,
            advance: opts.advance,
            seeded: opts.seeded,
            locked: false,
            has_lower: !!opts.hasLower && opts.format === 'group_knockout',
          },
        ],
      }));
      toast(`จัดสาย ${cat.name} เรียบร้อย (${rows.length} แมตช์)`);
    },
    [state.categories, state.registrations, state.matches, toast],
  );

  const toggleBracketLock = useCallback(
    (categoryId: string) => {
      setState((prev) => ({
        ...prev,
        brackets: prev.brackets.map((b) =>
          b.category_id === categoryId ? { ...b, locked: !b.locked } : b,
        ),
      }));
      toast('อัปเดตสถานะล็อกสายแล้ว');
    },
    [toast],
  );

  const clearBracket = useCallback(
    (categoryId: string) => {
      setState((prev) => ({
        ...prev,
        matches: prev.matches.filter((m) => m.category_id !== categoryId),
        brackets: prev.brackets.filter((b) => b.category_id !== categoryId),
      }));
      toast('ล้างสายการแข่งขันรุ่นนี้แล้ว');
    },
    [toast],
  );

  const generateGroupKnockoutStage = useCallback(
    (categoryId: string, gopts?: { fill?: boolean }) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      const b = state.brackets.find((x) => x.category_id === categoryId);
      if (!cat) return;
      const grp = state.matches.filter((m) => m.category_id === categoryId && m.stage === 'group');
      if (grp.some((m) => m.status !== 'finished')) {
        toast('กรุณากรอกผลรอบแบ่งกลุ่มให้ครบทุกคู่ก่อน', 'err');
        return;
      }
      const groupNos = [...new Set(grp.map((m) => m.group_no ?? 0))].sort((a, c) => a - c);
      const stPts = standingPtsFor(categoryId, state.categories, state.rules);
      const groupOf: Record<string, number> = {};
      const tops = groupNos.map((g) => {
        const gm = grp.filter((m) => (m.group_no ?? 0) === g);
        const ids = [...new Set(gm.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])];
        ids.forEach((id) => { groupOf[id] = g; });
        return computeStandings(ids, gm, stPts);
      });
      const adv = b?.advance || 2;
      const hasLower = !!b?.has_lower;
      const fill = !!gopts?.fill;
      // ผลงานเฉลี่ยต่อแมตช์ (เทียบข้ามกลุ่มที่จำนวนทีมไม่เท่ากัน)
      const perf = (r: StandingRow) => {
        const p = Math.max(1, r.played);
        return [r.pts / p, (r.pf - r.pa) / p, (r.gf - r.ga) / p];
      };
      const byPerf = (x: StandingRow, y: StandingRow) => {
        const a = perf(x), c = perf(y);
        for (let i = 0; i < 3; i++) if (c[i] !== a[i]) return c[i] - a[i];
        return 0;
      };
      const level = (k: number) => {
        const rows = tops.map((g) => g[k]).filter(Boolean) as StandingRow[];
        return (fill ? [...rows].sort(byPerf) : rows).map((r) => r.id);
      };
      let order: string[] = [];
      for (let k = 0; k < adv; k++) order.push(...level(k));
      let usedLevels = adv;
      const maxLen = Math.max(0, ...tops.map((g) => g.length));
      let filled = 0;
      if (fill && order.length >= 2) {
        const size = bracketSize(order.length);
        // เติมทีมอันดับถัดไปที่ดีที่สุด (เช่น ที่ 3 ดีที่สุด แล้วที่ 4 ดีที่สุด) จนครบสายไม่มีบาย
        while (order.length < size && usedLevels < maxLen) {
          const cand = level(usedLevels);
          const need = size - order.length;
          const take = cand.slice(0, need);
          order.push(...take);
          filled += take.length;
          if (take.length < cand.length) {
            // เติมไม่หมดทั้งระดับ: ทีมที่เหลือของระดับนี้ไปสายล่าง
            break;
          }
          usedLevels++;
        }
        order = avoidSameGroupFirstRound(order, groupOf);
      }
      const lowerOrder: string[] = [];
      if (hasLower) {
        const inUpper = new Set(order);
        for (let k = adv; k < maxLen; k++) {
          lowerOrder.push(...level(k).filter((id) => !inUpper.has(id)));
        }
      }
      const lowerFinal = fill && lowerOrder.length >= 4 ? avoidSameGroupFirstRound(lowerOrder, groupOf) : lowerOrder;
      if (order.length < 2) {
        toast('มีผู้เข้ารอบน้อยเกินไป', 'err');
        return;
      }
      const tag = (rows: Match[], label: string) => (hasLower ? rows.map((m) => ({ ...m, round_label: `${label} · ${m.round_label}` })) : rows);
      const ko = tag(buildKnockout(order, { tournamentId: cat.tournament_id, categoryId, startMatchNo: 1, stage: 'knockout' }), 'สายบน');
      const low = hasLower && lowerFinal.length >= 2
        ? tag(buildKnockout(lowerFinal, { tournamentId: cat.tournament_id, categoryId, startMatchNo: 1, stage: 'lower' }), 'สายล่าง')
        : [];
      setState((prev) => ({
        ...prev,
        matches: [
          ...prev.matches.filter((m) => !(m.category_id === categoryId && (m.stage === 'knockout' || m.stage === 'lower'))),
          ...ko,
          ...low,
        ],
      }));
      toast(fill ? `สร้างรอบน็อคเอาท์ เรียบร้อย (${order.length} ทีม${filled ? ` · เติมทีมอันดับถัดไป ${filled} ทีม` : ''})` : 'สร้างรอบน็อคเอาท์ เรียบร้อย');
    },
    [state.categories, state.brackets, state.matches, state.rules, toast],
  );

  /** แก้ทีมในกลุ่มหลังจัดสาย: สร้างแมตช์พบกันหมดของกลุ่มนั้นใหม่ (ทำได้เมื่อกลุ่มนั้นยังไม่มีผลแข่ง) */
  const setGroupTeams = useCallback(
    (categoryId: string, groupNo: number, teamIds: string[]): boolean => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return false;
      const old = state.matches.filter((m) => m.category_id === categoryId && m.stage === 'group' && (m.group_no ?? 0) === groupNo);
      if (old.some((m) => m.status !== 'scheduled' || m.sets.length || m.cur_a || m.cur_b)) {
        toast('กลุ่มนี้เริ่มแข่งหรือมีผลแล้ว แก้ทีมไม่ได้', 'err');
        return false;
      }
      if (teamIds.length < 2) {
        toast('กลุ่มต้องมีอย่างน้อย 2 ทีม', 'err');
        return false;
      }
      const rows = buildRoundRobin(teamIds, { tournamentId: cat.tournament_id, categoryId, startMatchNo: 1, stage: 'group', groupNo });
      setState((prev) => ({
        ...prev,
        matches: [...prev.matches.filter((m) => !(m.category_id === categoryId && m.stage === 'group' && (m.group_no ?? 0) === groupNo)), ...rows],
      }));
      toast('แก้ทีมในกลุ่มแล้ว');
      return true;
    },
    [state.categories, state.matches, toast],
  );

  const generateNextSwissRound = useCallback(
    (categoryId: string) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const sw = state.matches.filter((m) => m.category_id === categoryId && m.stage === 'swiss');
      if (!sw.length) return;
      const last = Math.max(...sw.map((m) => m.round));
      if (sw.some((m) => m.round === last && m.status !== 'finished')) {
        toast('กรุณากรอกผลรอบล่าสุดให้ครบก่อน', 'err');
        return;
      }
      const ids = [...new Set(sw.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])];
      const rank = computeStandings(ids, sw, standingPtsFor(categoryId, state.categories, state.rules)).map((r) => r.id);
      const met = new Set(sw.flatMap((m) => [`${m.reg_a}:${m.reg_b}`, `${m.reg_b}:${m.reg_a}`]));
      const pool = [...rank];
      const pairs: Array<[string, string]> = [];
      while (pool.length > 1) {
        const a = pool.shift()!;
        const idx = pool.findIndex((x) => !met.has(`${a}:${x}`));
        const [b] = pool.splice(idx >= 0 ? idx : 0, 1);
        pairs.push([a, b]);
      }
      let maxNo = Math.max(0, ...state.matches.map((m) => m.match_no || 0)) + 1;
      const rows: Match[] = pairs.map(([a, b], i) => ({
        id: uuid(),
        tournament_id: cat.tournament_id,
        category_id: categoryId,
        match_no: null,
        round: last + 1,
        round_label: `รอบที่ ${last + 1}`,
        slot: i,
        stage: 'swiss',
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
        updated_at: new Date().toISOString(),
      }));
      setState((prev) => ({ ...prev, matches: [...prev.matches, ...rows] }));
      toast(`สร้างรอบที่ ${last + 1} (Swiss) แล้ว`);
    },
    [state.categories, state.matches, toast],
  );

  const recordMatchSets = useCallback(
    (matchId: string, sets: [number, number][], liveCur?: [number, number] | null, silent?: boolean, force?: boolean) => {
      setState((prev) => {
        const target = prev.matches.find((m) => m.id === matchId);
        if (!target) return prev;
        const rule = ruleForMatch(target, prev.categories, prev.rules);
        const res = matchResult(sets, rule);
        let mw = res.winner;
        let finished = res.done;
        if (force && !finished && sets.length) {
          // the referee ended the match early: decide by sets won, then by points
          let wa = 0, wb = 0, pa = 0, pb = 0;
          for (const [x, y] of sets) { if (x > y) wa++; else if (y > x) wb++; pa += x; pb += y; }
          mw = wa !== wb ? (wa > wb ? 'a' : 'b') : pa !== pb ? (pa > pb ? 'a' : 'b') : null;
          finished = true;
        }
        const winnerId = mw ? (mw === 'a' ? target.reg_a : target.reg_b) : null;
        const now = new Date().toISOString();

        const updatedMatches = prev.matches.map((m) => {
          if (m.id === matchId) {
            return {
              ...m,
              sets,
              cur_a: finished ? 0 : liveCur?.[0] ?? 0,
              cur_b: finished ? 0 : liveCur?.[1] ?? 0,
              winner: winnerId,
              status: finished ? ('finished' as const) : ('live' as const),
              updated_at: now,
            };
          }
          if (winnerId && target.next_match && m.id === target.next_match) {
            return {
              ...m,
              reg_a: target.next_slot === 'a' ? winnerId : m.reg_a,
              reg_b: target.next_slot === 'b' ? winnerId : m.reg_b,
              updated_at: now,
            };
          }
          return m;
        });
        return { ...prev, matches: updatedMatches };
      });
      if (!silent) toast('บันทึกคะแนนแข่งขันแล้ว');
    },
    [toast],
  );

  const adjustLivePoint = useCallback(
    (matchId: string, side: 'a' | 'b', delta: 1 | -1) => {
      setState((prev) => {
        const m = prev.matches.find((x) => x.id === matchId);
        if (!m || m.status === 'finished') return prev;
        const rule = ruleForMatch(m, prev.categories, prev.rules);
        const nextA = Math.max(0, side === 'a' ? m.cur_a + delta : m.cur_a);
        const nextB = Math.max(0, side === 'b' ? m.cur_b + delta : m.cur_b);
        const sw = setWinner(nextA, nextB, rule);
        const now = new Date().toISOString();

        let nextSets = m.sets;
        let curA = nextA;
        let curB = nextB;
        let winnerId = m.winner;
        let status = 'live' as Match['status'];

        if (sw) {
          nextSets = [...m.sets, [nextA, nextB]];
          curA = 0;
          curB = 0;
          const res = matchResult(nextSets, rule);
          if (res.done) {
            winnerId = res.winner === 'a' ? m.reg_a : res.winner === 'b' ? m.reg_b : null;
            status = 'finished';
          }
        }

        const updatedMatches = prev.matches.map((item) => {
          if (item.id === matchId) {
            return {
              ...item,
              sets: nextSets,
              cur_a: curA,
              cur_b: curB,
              winner: winnerId,
              status,
              updated_at: now,
            };
          }
          if (status === 'finished' && winnerId && m.next_match && item.id === m.next_match) {
            return {
              ...item,
              reg_a: m.next_slot === 'a' ? winnerId : item.reg_a,
              reg_b: m.next_slot === 'b' ? winnerId : item.reg_b,
              updated_at: now,
            };
          }
          return item;
        });
        return { ...prev, matches: updatedMatches };
      });
    },
    [],
  );

  const updateMatchMeta = useCallback(
    (matchId: string, patch: Partial<Match>) => {
      setState((prev) => ({
        ...prev,
        matches: prev.matches.map((m) =>
          m.id === matchId ? { ...m, ...patch, updated_at: new Date().toISOString() } : m,
        ),
      }));
      toast('อัปเดตข้อมูลแมตช์แล้ว');
    },
    [toast],
  );

  const returnMatchToQueue = useCallback(
    (matchId: string) => {
      setState((prev) => {
        const t = prev.matches.find((x) => x.id === matchId);
        const now = new Date().toISOString();
        return {
          ...prev,
          matches: prev.matches.map((m) => {
            if (m.id === matchId) return { ...m, status: 'scheduled' as const, court: null, sets: [], cur_a: 0, cur_b: 0, winner: null, updated_at: now };
            // แมตช์อื่นที่ยังค้างชื่อสนามนี้ (รอเริ่ม) ต้องไม่โผล่ขึ้นการ์ดสนามแทน
            if (t && t.court != null && m.tournament_id === t.tournament_id && m.court === t.court && m.status === 'scheduled') return { ...m, court: null, updated_at: now };
            return m;
          }),
        };
      });
      toast('ส่งกลับคิวแล้ว (ล้างคะแนนและสนามของแมตช์นี้)');
    },
    [toast],
  );

  // ยกเลิกการเรียกลงสนาม: ล้างสนามของแมตช์นี้ และของทุกแมตช์ที่ยังรอเริ่มในสนามเดียวกัน
  const cancelCourtCall = useCallback(
    (matchId: string) => {
      setState((prev) => {
        const t = prev.matches.find((x) => x.id === matchId);
        if (!t || t.court == null) return prev;
        const now = new Date().toISOString();
        return {
          ...prev,
          matches: prev.matches.map((m) =>
            m.tournament_id === t.tournament_id && m.court === t.court && m.status === 'scheduled' ? { ...m, court: null, updated_at: now } : m,
          ),
        };
      });
      toast('ยกเลิกการเรียกแล้ว');
    },
    [toast],
  );

  const runAutoSchedule = useCallback(
    (startIso: string, courtNos: number[], timeOnly = false, setTime = true, catStarts: Record<string, string> = {}, opts: { order?: string[]; matchMin?: number; restMin?: number } = {}): number => {
      const setCourt = !timeOnly;
      if (!activeTournament) return 0;
      const tt = { ...activeTournament, match_minutes: opts.matchMin ?? activeTournament.match_minutes, rest_minutes: opts.restMin ?? activeTournament.rest_minutes };
      const plan = planAutoSchedule(tMatches, tt, startIso, courtNos, timeOnly, catStarts, opts.order || []);
      if (!plan.length) {
        toast('ไม่มีแมตช์ที่รอจัดตาราง (หรือจัดครบแล้ว)', 'info');
        return 0;
      }
      const map = Object.fromEntries(plan.map((p) => [p.id, p]));
      setState((prev) => {
        // ใส่เลขแมตช์ตามลำดับเวลาที่จัดได้ ต่อจากเลขสูงสุดของรายการ
        let next = Math.max(0, ...prev.matches.filter((m) => m.tournament_id === activeTournament.id).map((m) => m.match_no || 0)) + 1;
        const order = [...plan].sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
        const noOf: Record<string, number> = {};
        for (const p of order) {
          const cur = prev.matches.find((x) => x.id === p.id);
          if (cur && !cur.match_no) noOf[p.id] = next++;
        }
        return {
          ...prev,
          matches: prev.matches.map((m) =>
            map[m.id]
              ? {
                  ...m,
                  court: setCourt ? map[m.id].court : m.court,
                  scheduled_at: setTime ? map[m.id].scheduled_at : m.scheduled_at,
                  match_no: m.match_no || noOf[m.id] || null,
                }
              : m,
          ),
        };
      });
      toast(`จัดตารางอัตโนมัติแล้ว ${plan.length} แมตช์`);
      return plan.length;
    },
    [activeTournament, tMatches, toast],
  );

  const clearSchedule = useCallback((): number => {
    if (!activeTournament) return 0;
    const ids = new Set(
      tMatches.filter((m) => m.status === 'scheduled' && (m.scheduled_at || m.court || m.match_no)).map((m) => m.id),
    );
    if (!ids.size) {
      toast('ไม่มีแมตช์ที่ต้องยกเลิกตาราง', 'info');
      return 0;
    }
    setState((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        ids.has(m.id) ? { ...m, scheduled_at: null, court: null, match_no: null, updated_at: new Date().toISOString() } : m,
      ),
    }));
    toast(`ยกเลิกตารางแข่ง ${ids.size} แมตช์แล้ว`);
    return ids.size;
  }, [activeTournament, tMatches, toast]);

  const callMatchToCourt = useCallback(
    (matchId: string, courtNo: number) => {
      setState((prev) => {
        const target = prev.matches.find((m) => m.id === matchId);
        if (!target) return prev;
        const now = new Date().toISOString();
        const nextMatches = prev.matches.map((m) => {
          if (m.id === matchId) {
            return { ...m, court: courtNo, scheduled_at: m.scheduled_at || now, match_no: m.match_no || Math.max(0, ...prev.matches.filter((x) => x.tournament_id === m.tournament_id).map((x) => x.match_no || 0)) + 1, status: 'scheduled' as const };
          }
          if (m.tournament_id === target.tournament_id && m.court === courtNo && m.status === 'scheduled') {
            return { ...m, court: null };
          }
          return m;
        });

        const newNotes = [...prev.notifications];
        const calledNo = nextMatches.find((x) => x.id === matchId)?.match_no ?? target.match_no;
        [target.reg_a, target.reg_b].filter(Boolean).forEach((regId) => {
          newNotes.unshift({
            id: uuid(),
            tournament_id: target.tournament_id,
            registration_id: regId!,
            kind: 'schedule',
            title: `เรียกลงสนาม ${courtNo}`,
            body: `แมตช์ #${calledNo ?? '-'} (${target.round_label}) กรุณาเตรียมตัวที่สนาม ${courtNo}`,
            created_at: now,
            read: false,
          });
        });

        return { ...prev, matches: nextMatches, notifications: newNotes };
      });
      toast(`เรียกแมตช์ลงสนาม ${courtNo} แล้ว`);
    },
    [toast],
  );

  const toggleCourtMaintenance = useCallback(
    (courtId: string) => {
      setState((prev) => ({
        ...prev,
        courts: prev.courts.map((c) =>
          c.id === courtId
            ? { ...c, status: c.status === 'maintenance' ? 'available' : 'maintenance' }
            : c,
        ),
      }));
      toast('อัปเดตสถานะสนามแล้ว');
    },
    [toast],
  );

  // กู้คืนจากไฟล์สำรอง: รวมเข้ากับข้อมูลปัจจุบันตาม id (แถวเดิมถูกแทนที่ แถวใหม่ถูกเพิ่ม) แล้วระบบซิงก์ขึ้นฐานข้อมูลเอง
  const restoreBackup = useCallback(
    (bk: any) => {
      const uid = profileRef.current?.id;
      if (!uid) return { ok: false, msg: 'ต้องเข้าสู่ระบบก่อน' };
      if (!bk || bk.app !== 'MatchON' || !Array.isArray(bk.tournaments)) return { ok: false, msg: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของ MatchON' };
      const okT = new Set<string>();
      const tours: any[] = [];
      for (const t of bk.tournaments) {
        const ex = state.tournaments.find((x) => x.id === t.id) as any;
        if (ex && ex.organizer_id !== uid && !state.tournaments.some((x) => x.id === t.id && isManagerOf(x.id))) continue;
        okT.add(t.id);
        tours.push(ex ? { ...t, organizer_id: ex.organizer_id } : { ...t, organizer_id: uid });
      }
      if (!okT.size) return { ok: false, msg: 'ไม่มีรายการที่คุณมีสิทธิ์กู้คืน' };
      const keep = (a: any) => (Array.isArray(a) ? a.filter((x) => okT.has(x.tournament_id)) : []);
      const merge = (cur: any[], inc: any[]) => {
        const ids = new Set(inc.map((x) => x.id));
        return [...cur.filter((x) => !ids.has(x.id)), ...inc];
      };
      const inc = {
        categories: keep(bk.categories), registrations: keep(bk.registrations), matches: keep(bk.matches),
        courts: keep(bk.courts), brackets: keep(bk.brackets), rules: keep(bk.rules), referees: keep(bk.referees),
      };
      setState((prev: any) => ({
        ...prev,
        tournaments: merge(prev.tournaments, tours),
        categories: merge(prev.categories, inc.categories),
        registrations: merge(prev.registrations, inc.registrations),
        matches: merge(prev.matches, inc.matches),
        courts: merge(prev.courts, inc.courts),
        brackets: merge(prev.brackets, inc.brackets),
        rules: merge(prev.rules, inc.rules),
        referees: merge(prev.referees, inc.referees),
      }));
      return { ok: true, msg: `กู้คืนแล้ว: ${tours.length} รายการ, ${inc.registrations.length} ใบสมัคร, ${inc.matches.length} แมตช์` };
    },
    [state.tournaments, isManagerOf],
  );

  const setCourtQueue = useCallback((courtId: string, ids: string[]) => {
    setState((prev) => ({ ...prev, courts: prev.courts.map((c) => (c.id === courtId ? { ...c, queue: ids } : c)) }));
  }, []);

  // คิวแมตช์ถัดไป: เมื่อสนามไม่มีแมตช์กำลังแข่ง เรียกแมตช์แรกในคิวลงสนามอัตโนมัติ (ใช้ขั้นตอนเดียวกับปุ่ม "เรียกแมตช์")
  useEffect(() => {
    if (!activeTournament || !isManagerOf(activeTournament.id)) return;
    const tid = activeTournament.id;
    const ms = state.matches.filter((m) => m.tournament_id === tid);
    const patches: { court: Court; keep: string[]; call?: string }[] = [];
    const liveTeams = new Set(ms.filter((m) => m.status === 'live').flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[]);
    const claimed = new Set<string>();
    for (const c of state.courts.filter((x) => x.tournament_id === tid)) {
      const q = c.queue || [];
      if (!q.length) continue;
      // ตัดรายการที่ใช้ไม่ได้แล้ว (จบ/กำลังแข่ง/ถูกลบ)
      const valid = q.filter((id) => {
        const m = ms.find((x) => x.id === id);
        return !!m && m.status === 'scheduled' && !!m.reg_a && !!m.reg_b;
      });
      let call: string | undefined;
      const hasLive = ms.some((m) => m.court === c.no && m.status === 'live');
      if (c.status === 'available' && !hasLive && valid.length) {
        const first = ms.find((x) => x.id === valid[0])!;
        const teams = [first.reg_a, first.reg_b].filter(Boolean) as string[];
        if (!teams.some((t) => liveTeams.has(t)) && !claimed.has(first.id)) {
          call = first.id;
          claimed.add(first.id);
          teams.forEach((t) => liveTeams.add(t));
        }
      }
      const keep = call ? valid.slice(1) : valid;
      if (call || keep.length !== q.length) patches.push({ court: c, keep, call });
    }
    if (!patches.length) return;
    setState((prev) => ({
      ...prev,
      courts: prev.courts.map((c) => {
        const p = patches.find((x) => x.court.id === c.id);
        return p ? { ...c, queue: p.keep } : c;
      }),
    }));
    patches.filter((p) => p.call).forEach((p) => callMatchToCourt(p.call!, p.court.no));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.matches, state.courts, activeTournament?.id]);

  const deleteCourt = useCallback(
    (courtId: string) => {
      const court = state.courts.find((c) => c.id === courtId);
      if (!court) return;
      if (state.matches.some((m) => m.tournament_id === court.tournament_id && m.court === court.no && m.status === 'live')) {
        toast('สนามนี้กำลังแข่งอยู่ ลบไม่ได้', 'err');
        return;
      }
      setState((prev) => ({
        ...prev,
        courts: prev.courts.filter((c) => c.id !== courtId),
        // แมตช์ที่ยังไม่แข่งที่ลงสนามนี้ → กลับเป็นไม่กำหนดสนาม, กรรมการประจำสนามนี้ → ว่าง
        matches: prev.matches.map((m) =>
          m.tournament_id === court.tournament_id && m.court === court.no && m.status !== 'finished' ? { ...m, court: null } : m,
        ),
        referees: prev.referees.map((r) => (r.tournament_id === court.tournament_id && r.court_no === court.no ? { ...r, court_no: null } : r)),
      }));
      toast(`ลบ ${court.name} แล้ว`);
    },
    [state.courts, state.matches, toast],
  );

  const addCourt = useCallback(() => {
    if (!activeTournament) return;
    setState((prev) => {
      const current = prev.courts.filter((c) => c.tournament_id === activeTournament.id);
      const nextNo = Math.max(0, ...current.map((c) => c.no)) + 1;
      if (nextNo > 24) return prev;
      return {
        ...prev,
        courts: [
          ...prev.courts,
          { id: uuid(), tournament_id: activeTournament.id, no: nextNo, name: `สนาม ${nextNo}`, status: 'available' },
        ],
        referees: withAutoReferees(prev.referees, activeTournament.id, current.length + 1),
      };
    });
    toast('เพิ่มสนามใหม่แล้ว');
  }, [activeTournament, toast]);

  const addRulePreset = useCallback(
    (rule: Omit<RulePreset, 'id'>) => {
      setState((prev) => ({
        ...prev,
        rules: [...prev.rules, { ...rule, id: uuid() }],
      }));
      toast('เพิ่มชุดกติกาแล้ว');
    },
    [toast],
  );

  const updateRulePreset = useCallback(
    (id: string, patch: Partial<RulePreset>) => {
      setState((prev) => ({ ...prev, rules: prev.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      toast('แก้ไขชุดกติกาแล้ว');
    },
    [toast],
  );

  const deleteRulePreset = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        rules: prev.rules.filter((r) => r.id !== id),
      }));
      toast('ลบชุดกติกาแล้ว');
    },
    [toast],
  );

  const assignCategoryRule = useCallback(
    (catId: string, kind: 'group' | 'ko', ruleId: string | null) => {
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === catId
            ? kind === 'group'
              ? { ...c, rule_group: ruleId }
              : { ...c, rule_ko: ruleId }
            : c,
        ),
      }));
      toast('บันทึกกติกาประจำรุ่นแล้ว');
    },
    [toast],
  );

  const addReferee = useCallback(
    (ref: Omit<Referee, 'id'>) => {
      setState((prev) => ({
        ...prev,
        referees: [...prev.referees, { ...ref, id: uuid() }],
      }));
      toast('เพิ่มกรรมการเรียบร้อย');
    },
    [toast],
  );

  const updateReferee = useCallback((id: string, patch: Partial<Referee>) => {
    setState((prev) => ({ ...prev, referees: prev.referees.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);

  // a referee takes a court when the organizer picks them for that court's QR (null = special referee, nobody is booked)
  const assignReferee = useCallback((refId: string | null, courtNo: number) => {
    setState((prev) => {
      const tid = prev.activeTid;
      return {
        ...prev,
        referees: prev.referees.map((r) =>
          r.tournament_id !== tid
            ? r
            : r.id === refId
              ? { ...r, court_no: courtNo }
              : r.court_no === courtNo
                ? { ...r, court_no: null }
                : r,
        ),
      };
    });
  }, []);

  const addStandardRules = useCallback(() => {
    if (!activeTournament) return;
    const tid = activeTournament.id;
    setState((prev) => {
      const have = new Set(prev.rules.filter((r) => r.tournament_id === tid).map((r) => r.name));
      const std: Array<Omit<RulePreset, 'id'>> = [
        { tournament_id: tid, name: '1 เซต 21 แต้ม', best_of: 1, points: 21, deuce: true, cap: 30 },
        { tournament_id: tid, name: '2 ใน 3 เซต 21 แต้ม', best_of: 3, points: 21, deuce: true, cap: 30 },
        { tournament_id: tid, name: '3 ใน 5 เซต 21 แต้ม', best_of: 5, points: 21, deuce: true, cap: 30 },
        { tournament_id: tid, name: '2 เซต 21 แต้ม (2-0=2, 1-1=1)', best_of: 3, points: 21, deuce: true, cap: 30, play_two: true },
      ];
      const add = std.filter((r) => !have.has(r.name)).map((r) => ({ ...r, id: uuid() }));
      return add.length ? { ...prev, rules: [...prev.rules, ...add] } : prev;
    });
    toast('เพิ่มชุดกติกามาตรฐานแล้ว');
  }, [activeTournament, toast]);

  const deleteReferee = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        referees: prev.referees.filter((r) => r.id !== id),
      }));
      toast('ลบกรรมการแล้ว');
    },
    [toast],
  );

  const value: MatchONContextValue = {
    state: { ...state, role: role as MatchONState['role'] },
    loading,
    profile,
    canCreate,
    isAdmin,
    isManagerOf,
    reload,
    signOut,
    route,
    navigate,
    routeParam,
    activeTournament,
    setActiveTid,
    clearActiveTid,
    toast,
    toasts,
    tCategories,
    tRegistrations,
    tMatches,
    tCourts,
    tBrackets,
    tRules,
    tReferees,
    regMap,
    catMap,
    saveTournament,
    toggleFeatured,
    toggleTournamentStatus,
    deleteTournament,
    saveCategory,
    deleteCategory,
    addRegistration,
    simulateRegistrations,
    updateRegistration,
    deleteRegistration,
    generateBracket,
    toggleBracketLock,
    clearBracket,
    generateGroupKnockoutStage,
    generateNextSwissRound,
    setGroupTeams,
    recordMatchSets,
    adjustLivePoint,
    updateMatchMeta,
    returnMatchToQueue,
    runAutoSchedule,
    clearSchedule,
    callMatchToCourt,
    cancelCourtCall,
    toggleCourtMaintenance,
    addCourt,
    deleteCourt,
    setCourtQueue,
    restoreBackup,
    addRulePreset,
    deleteRulePreset,
    updateRulePreset,
    assignCategoryRule,
    addReferee,
    updateReferee,
    assignReferee,
    addStandardRules,
    deleteReferee,
  };

  return <MatchONContext.Provider value={value}>{children}</MatchONContext.Provider>;
}

export function useMatchON() {
  const ctx = useContext(MatchONContext);
  if (!ctx) throw new Error('useMatchON must be used inside MatchONProvider');
  return ctx;
}
