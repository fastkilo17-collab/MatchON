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
  computeStandings,
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
  pushDiff,
  rpcAdminAdd,
  rpcRegister,
  type Data,
  type Profile,
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
  isManagerOf: (tid: string) => boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  route: NavRoute;
  navigate: (next: NavRoute, opts?: { regTid?: string; filter?: string }) => void;
  routeParam: string | null;
  activeTournament: Tournament | null;
  setActiveTid: (id: string) => void;
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
  generateBracket: (
    categoryId: string,
    opts: { format: BracketFormat; groups: number; advance: number; seeded: boolean },
  ) => void;
  toggleBracketLock: (categoryId: string) => void;
  clearBracket: (categoryId: string) => void;
  generateGroupKnockoutStage: (categoryId: string) => void;
  generateNextSwissRound: (categoryId: string) => void;
  recordMatchSets: (matchId: string, sets: [number, number][], liveCur?: [number, number] | null, silent?: boolean) => void;
  adjustLivePoint: (matchId: string, side: 'a' | 'b', delta: 1 | -1) => void;
  updateMatchMeta: (matchId: string, patch: Partial<Match>) => void;
  runAutoSchedule: (startIso: string, courtNos: number[]) => number;
  callMatchToCourt: (matchId: string, courtNo: number) => void;
  toggleCourtMaintenance: (courtId: string) => void;
  addCourt: () => void;
  addRulePreset: (rule: Omit<RulePreset, 'id'>) => void;
  deleteRulePreset: (id: string) => void;
  assignCategoryRule: (catId: string, kind: 'group' | 'ko', ruleId: string | null) => void;
  addReferee: (ref: Omit<Referee, 'id'>) => void;
  updateRefereeCourt: (id: string, courtNo: number | null) => void;
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
const INITIAL_STATE: MatchONState = { role: 'player', activeTid: '', ...EMPTY_DATA };

export function MatchONProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MatchONState>(INITIAL_STATE);
  const [route, setRoute] = useState<NavRoute>('tournaments');
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
  const role = canCreate || manageable.current.size > 0 ? 'organizer' : 'player';

  const applyLoaded = useCallback((l: Awaited<ReturnType<typeof loadAll>>) => {
    manageable.current = l.manageable;
    profileRef.current = l.profile;
    synced.current = l.data;
    latest.current = l.data;
    setProfile(l.profile);
    setState((prev) => {
      let activeTid = prev.activeTid;
      if (!activeTid) {
        try {
          activeTid = localStorage.getItem(ACTIVE_KEY) || '';
        } catch {
          /* ignore */
        }
      }
      if (!l.data.tournaments.some((t) => t.id === activeTid)) activeTid = l.data.tournaments[0]?.id || '';
      return { ...prev, ...l.data, activeTid };
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
      setRouteParam(opts?.filter ?? null);
      setRoute(next);
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

  const activeTournament = useMemo(
    () => state.tournaments.find((t) => t.id === state.activeTid) || state.tournaments[0] || null,
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
      const p1 = { name: data.p1_name, nick: data.p1_nick, phone: data.p1_phone, year: data.p1_year, photo: data.p1_photo };
      const p2 = data.p2_name
        ? { name: data.p2_name, nick: data.p2_nick, phone: data.p2_phone, year: data.p2_year, photo: data.p2_photo }
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
          out = await rpcRegister({ tournamentId: data.tournament_id, categoryId: data.category_id, club: data.club, p1, p2 });
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
    (categoryId: string, opts: { format: BracketFormat; groups: number; advance: number; seeded: boolean }) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const teams = state.registrations.filter(
        (r) => r.category_id === categoryId && r.status === 'confirmed',
      );
      if (teams.length < 2) {
        toast('ต้องมีทีมที่ยืนยันแล้วอย่างน้อย 2 ทีม', 'err');
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
        const G = Math.max(1, opts.groups || 2);
        if (ids.length < G * 2) {
          toast('จำนวนทีมน้อยเกินไปสำหรับจำนวนกลุ่มนี้ (อย่างน้อยกลุ่มละ 2 ทีม)', 'err');
          return;
        }
        const groups: string[][] = Array.from({ length: G }, () => []);
        ids.forEach((id, i) => {
          const r = Math.floor(i / G);
          const idx = r % 2 === 0 ? i % G : G - 1 - (i % G);
          groups[idx].push(id);
        });
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
            match_no: nextNo++,
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
    (categoryId: string) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      const b = state.brackets.find((x) => x.category_id === categoryId);
      if (!cat) return;
      const grp = state.matches.filter((m) => m.category_id === categoryId && m.stage === 'group');
      if (grp.some((m) => m.status !== 'finished')) {
        toast('กรุณากรอกผลรอบแบ่งกลุ่มให้ครบทุกคู่ก่อน', 'err');
        return;
      }
      const groupNos = [...new Set(grp.map((m) => m.group_no ?? 0))].sort((a, c) => a - c);
      const tops = groupNos.map((g) => {
        const gm = grp.filter((m) => (m.group_no ?? 0) === g);
        const ids = [...new Set(gm.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean) as string[])];
        return computeStandings(ids, gm).map((r) => r.id);
      });
      const adv = b?.advance || 2;
      const order: string[] = [];
      for (let k = 0; k < adv; k++) {
        tops.forEach((g) => {
          if (g[k]) order.push(g[k]);
        });
      }
      if (order.length < 2) {
        toast('มีผู้เข้ารอบน้อยเกินไป', 'err');
        return;
      }
      const maxNo = Math.max(0, ...state.matches.map((m) => m.match_no || 0)) + 1;
      const ko = buildKnockout(order, {
        tournamentId: cat.tournament_id,
        categoryId,
        startMatchNo: maxNo,
        stage: 'knockout',
      });
      setState((prev) => ({
        ...prev,
        matches: [
          ...prev.matches.filter((m) => !(m.category_id === categoryId && m.stage === 'knockout')),
          ...ko,
        ],
      }));
      toast('สร้างรอบไขว้สาย (Knockout) เรียบร้อย');
    },
    [state.categories, state.brackets, state.matches, toast],
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
      const rank = computeStandings(ids, sw).map((r) => r.id);
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
        match_no: maxNo++,
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
    (matchId: string, sets: [number, number][], liveCur?: [number, number] | null, silent?: boolean) => {
      setState((prev) => {
        const target = prev.matches.find((m) => m.id === matchId);
        if (!target) return prev;
        const rule = ruleForMatch(target, prev.categories, prev.rules);
        const mw = matchWinner(sets, rule);
        const winnerId = mw ? (mw === 'a' ? target.reg_a : target.reg_b) : null;
        const now = new Date().toISOString();

        const updatedMatches = prev.matches.map((m) => {
          if (m.id === matchId) {
            return {
              ...m,
              sets,
              cur_a: mw ? 0 : liveCur?.[0] ?? 0,
              cur_b: mw ? 0 : liveCur?.[1] ?? 0,
              winner: winnerId,
              status: mw ? ('finished' as const) : ('live' as const),
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
          const mw = matchWinner(nextSets, rule);
          if (mw) {
            winnerId = mw === 'a' ? m.reg_a : m.reg_b;
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

  const runAutoSchedule = useCallback(
    (startIso: string, courtNos: number[]): number => {
      if (!activeTournament) return 0;
      const plan = planAutoSchedule(tMatches, activeTournament, startIso, courtNos);
      if (!plan.length) {
        toast('ไม่มีแมตช์ที่รอจัดตาราง (หรือจัดครบแล้ว)', 'info');
        return 0;
      }
      const map = Object.fromEntries(plan.map((p) => [p.id, p]));
      setState((prev) => ({
        ...prev,
        matches: prev.matches.map((m) =>
          map[m.id] ? { ...m, court: map[m.id].court, scheduled_at: map[m.id].scheduled_at } : m,
        ),
      }));
      toast(`จัดตารางอัตโนมัติแล้ว ${plan.length} แมตช์`);
      return plan.length;
    },
    [activeTournament, tMatches, toast],
  );

  const callMatchToCourt = useCallback(
    (matchId: string, courtNo: number) => {
      setState((prev) => {
        const target = prev.matches.find((m) => m.id === matchId);
        if (!target) return prev;
        const now = new Date().toISOString();
        const nextMatches = prev.matches.map((m) => {
          if (m.id === matchId) {
            return { ...m, court: courtNo, scheduled_at: now, status: 'scheduled' as const };
          }
          if (m.tournament_id === target.tournament_id && m.court === courtNo && m.status === 'scheduled') {
            return { ...m, court: null };
          }
          return m;
        });

        const newNotes = [...prev.notifications];
        [target.reg_a, target.reg_b].filter(Boolean).forEach((regId) => {
          newNotes.unshift({
            id: uuid(),
            tournament_id: target.tournament_id,
            registration_id: regId!,
            kind: 'schedule',
            title: `เรียกลงสนาม ${courtNo}`,
            body: `แมตช์ #${target.match_no ?? '-'} (${target.round_label}) กรุณาเตรียมตัวที่สนาม ${courtNo}`,
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

  const updateRefereeCourt = useCallback(
    (id: string, courtNo: number | null) => {
      setState((prev) => ({
        ...prev,
        referees: prev.referees.map((r) => (r.id === id ? { ...r, court_no: courtNo } : r)),
      }));
      toast('มอบหมายสนามให้กรรมการแล้ว');
    },
    [toast],
  );

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
    isManagerOf,
    reload,
    signOut,
    route,
    navigate,
    routeParam,
    activeTournament,
    setActiveTid,
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
    toggleTournamentStatus,
    deleteTournament,
    saveCategory,
    deleteCategory,
    addRegistration,
    simulateRegistrations,
    updateRegistration,
    generateBracket,
    toggleBracketLock,
    clearBracket,
    generateGroupKnockoutStage,
    generateNextSwissRound,
    recordMatchSets,
    adjustLivePoint,
    updateMatchMeta,
    runAutoSchedule,
    callMatchToCourt,
    toggleCourtMaintenance,
    addCourt,
    addRulePreset,
    deleteRulePreset,
    assignCategoryRule,
    addReferee,
    updateRefereeCourt,
    deleteReferee,
  };

  return <MatchONContext.Provider value={value}>{children}</MatchONContext.Provider>;
}

export function useMatchON() {
  const ctx = useContext(MatchONContext);
  if (!ctx) throw new Error('useMatchON must be used inside MatchONProvider');
  return ctx;
}
