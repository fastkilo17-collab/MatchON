import { useCallback, useEffect, useRef, useState } from 'react';
import { photoUrl, sb } from './supabase';
import type { Category, Court, Match, Registration, Tournament } from '../types/matchon';
import { ruleForMatch } from '../utils/bracket';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Firebase live layer lives in /public/js/live.js (shared with referee.html and courts.html).
let fbMod: Promise<any> | null = null;
const loadFb = (): Promise<any> =>
  (fbMod ||= import(/* @vite-ignore */ `${location.origin}${import.meta.env.BASE_URL}js/live.js`));

const CODE = (m: Match) => m.id.slice(0, 8);
const rand = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

export interface FbCourt {
  courtNo: number;
  status: string;
  matchCode?: string;
  scores: [number, number][];
  activeSet: number;
  startedAt?: number;
  matchNo?: number;
  roundLabel?: string;
  catName?: string;
}

interface Args {
  tournament: Tournament | null;
  courts: Court[];
  matches: Match[];
  regMap: Record<string, Registration>;
  catMap: Record<string, Category>;
  canWrite: boolean;
  recordSets: (id: string, sets: [number, number][], cur: [number, number] | null, silent?: boolean, force?: boolean) => void;
  rules: import('../types/matchon').RulePreset[];
  categories: Category[];
}

export function useLiveBridge(a: Args) {
  const { tournament, courts, matches, regMap, catMap, canWrite, recordSets, rules, categories } = a;
  const [fb, setFb] = useState<Record<number, FbCourt>>({});
  const [bridgeOn, setBridgeOn] = useState(false);
  const [error, setError] = useState('');
  const cfg = useRef<{ live_id: string; master: any; keys: Record<string, string> } | null>(null);
  const FB = useRef<any>(null);
  const done = useRef<Set<string>>(new Set());
  const lastSig = useRef<Record<string, string>>({});
  const fbReady = useRef(false);
  const [fbLoaded, setFbLoaded] = useState(false);
  const lastPushed = useRef<Record<string, string>>({});
  const sbSeen = useRef<Record<string, string>>({});
  const latest = useRef({ matches, regMap, catMap, courts, recordSets, rules, categories });
  latest.current = { matches, regMap, catMap, courts, recordSets, rules, categories };
  const tid = tournament?.id || '';
  const [cfgLive, setCfgLive] = useState<string | null>(null);
  const liveId = cfgLive || tournament?.live_id || null;

  const payload = useCallback(
    (no: number, m: Match | null) => {
      const { regMap: R, catMap: C } = latest.current;
      const name = tournament?.name || '';
      if (!m) {
        return { courtNo: no, hidden: latest.current.courts.find((c) => c.no === no)?.status === 'maintenance', status: 'READY', round: 'คอร์ทว่าง (พร้อมเรียกคู่ถัดไป)', teamA: 'รอเรียกคู่แข่งขัน', clubA: '-', teamB: 'รอเรียกคู่แข่งขัน', clubB: '-', scores: [[0, 0], [0, 0], [0, 0]], tournament: name };
      }
      const side = (r?: Registration | null) => {
        const ks = (['p1', 'p2'] as const).filter((k) => r && (r as any)[`${k}_name`]);
        return {
          team: ks.map((k) => (r as any)[`${k}_nick`] || (r as any)[`${k}_name`]).join(' / '),
          real: ks.map((k) => (r as any)[`${k}_name`]),
          ph: ks.map((k) => {
            const p = (r as any)[`${k}_photo`] as string | null;
            return p && (!p.startsWith('data:') || p.length < 3000) ? photoUrl(p) : '';
          }),
        };
      };
      const ra = m.reg_a ? R[m.reg_a] : null;
      const rb = m.reg_b ? R[m.reg_b] : null;
      // seed from Supabase so an in-progress score is never reset to 0-0
      const seeded: [number, number][] = [[0, 0], [0, 0], [0, 0]];
      (m.sets || []).slice(0, 3).forEach((x, i) => { seeded[i] = [x[0], x[1]]; });
      const si = Math.min(2, (m.sets || []).length);
      if (m.status === 'live' || m.cur_a || m.cur_b) seeded[si] = [m.cur_a || 0, m.cur_b || 0];
      const hasScore = seeded.some((x) => x[0] || x[1]);
      const A = side(ra);
      const B = side(rb);
      return {
        courtNo: no, hidden: false, status: 'LIVE', matchCode: CODE(m),
        round: `${m.match_no ? 'แมตช์ #' + m.match_no : ''} ${C[m.category_id]?.name || ''} ${m.round_label || ''}`.trim(),
        matchNo: m.match_no || null, roundLabel: m.round_label || '', catName: C[m.category_id]?.name || '',
        rule: (() => { const r = ruleForMatch(m, latest.current.categories, latest.current.rules); return { best_of: r.best_of, points: r.points, cap: r.cap, deuce: r.deuce, playTwo: r.play_two }; })(),
        tournament: name, teamA: A.team, clubA: ra?.club || '', teamB: B.team, clubB: rb?.club || '',
        realA: A.real, realB: B.real, photoA: A.ph, photoB: B.ph, scores: seeded, shuttleUsed: 1, activeSet: hasScore ? si : -1,
      };
    },
    [tournament?.name],
  );

  const currentMatch = (no: number): Match | null => {
    const ms = latest.current.matches.filter((m) => m.court === no && m.reg_a && m.reg_b && m.status !== 'finished');
    return ms.find((m) => m.status === 'live') || ms.find((m) => m.status === 'scheduled') || null;
  };

  // read side: everybody watches courts that have a live id
  useEffect(() => {
    if (!liveId || (canWrite && !bridgeOn)) return;
    let off: (() => void) | undefined;
    let dead = false;
    (async () => {
      try {
        const mod = await loadFb();
        FB.current = mod;
        if (!canWrite) await mod.connect(liveId, null);
        if (dead) return;
        off = mod.watchCourts(liveId, (list: any[]) => {
          setFb(Object.fromEntries((list || []).map((c) => [c.courtNo, c])));
          if (!fbReady.current) { fbReady.current = true; setFbLoaded(true); }
        });
      } catch {
        /* offline or Firebase blocked: Supabase data alone still works */
      }
    })();
    return () => {
      dead = true;
      off?.();
    };
  }, [liveId, canWrite, bridgeOn]);

  // write side: organizers / staff connect as master and receive referee results
  useEffect(() => {
    if (!canWrite || !tid || !courts.length) return;
    let dead = false;
    let offDone: (() => void) | undefined;
    (async () => {
      try {
        const mod = await loadFb();
        FB.current = mod;
        const r = await sb.rpc('ensure_live', { p_tournament: tid });
        if (r.error) throw r.error;
        const c = r.data as { live_id: string; master: any; keys: Record<string, string> };
        const keys = { ...(c.keys || {}) };
        let changed = false;
        for (const ct of latest.current.courts) {
          if (!keys['c' + ct.no]) {
            keys['c' + ct.no] = rand(24);
            changed = true;
          }
        }
        const cn = await mod.connect(c.live_id, { master: c.master });
        if (!cn.canWrite) throw new Error(`เชื่อม Firebase ไม่สำเร็จ (${cn.error || ''} ${cn.detail || ''})`);
        if (changed) await sb.rpc('save_live_keys', { p_tournament: tid, p_keys: keys });
        await mod.publishCourtKeys(c.live_id, keys);
        if (dead) return;
        cfg.current = { ...c, keys };
        setCfgLive(c.live_id);
        setBridgeOn(true);
        setError('');
        offDone = mod.watchCompleted(c.live_id, (list: any[]) => {
          for (const it of list || []) {
            if (done.current.has(it.fbId)) continue;
            done.current.add(it.fbId);
            const m = latest.current.matches.find((x) => it.code && x.id.startsWith(it.code));
            if (!m || m.status === 'finished') continue;
            const sets = String(it.scoreText || '')
              .split(',')
              .map((s) => s.trim().split('-').map(Number))
              .filter((p) => p.length === 2 && p.every(Number.isFinite)) as [number, number][];
            if (sets.length) latest.current.recordSets(m.id, sets, null, false, true);
          }
        });
      } catch (e: any) {
        if (!dead) setError(e?.message || String(e));
      }
    })();
    return () => {
      dead = true;
      offDone?.();
      setBridgeOn(false);
    };
  }, [canWrite, tid, courts.length]);

  // live partial scores from the referee page -> Supabase
  useEffect(() => {
    if (!bridgeOn || !canWrite) return;
    for (const c of Object.values(fb)) {
      if (c.status !== 'LIVE' || !c.matchCode) continue;
      const m = latest.current.matches.find((x) => x.id.startsWith(c.matchCode!));
      if (!m || m.status === 'finished' || !m.court) continue;
      if (!(c.startedAt || c.scores.some((s) => s[0] || s[1]))) continue;
      const act = c.activeSet >= 0 ? c.activeSet : 0;
      const sets = c.scores.slice(0, act).filter((s) => s[0] || s[1]) as [number, number][];
      const cur = (c.scores[act] || [0, 0]) as [number, number];
      const sig = JSON.stringify([sets, cur]);
      if (lastPushed.current[m.id] === sig) continue;
      lastPushed.current[m.id] = sig;
      latest.current.recordSets(m.id, sets, cur, true);
    }
  }, [fb, bridgeOn, canWrite]);

  // score typed in the app (+1/-1, manual sheet) -> Firebase, so the big board and referee page follow
  useEffect(() => {
    if (!bridgeOn || !fbLoaded || !cfg.current || !FB.current) return;
    for (const ct of courts) {
      const m = latest.current.matches.find((x) => x.court === ct.no && x.status === 'live');
      const f = fb[ct.no];
      if (!m || !f || f.status !== 'LIVE' || f.matchCode !== CODE(m)) continue;
      const sets = (m.sets || []).filter((x) => x[0] || x[1]) as [number, number][];
      const cur: [number, number] = [m.cur_a || 0, m.cur_b || 0];
      const sig = JSON.stringify([sets, cur]);
      const prevSeen = sbSeen.current[m.id];
      sbSeen.current[m.id] = sig;
      if (prevSeen === sig) continue; // the app's score did not change (e.g. only the referee page moved)
      if (prevSeen === undefined && (f.startedAt || f.scores.some((x) => x[0] || x[1]))) continue; // first look: never overwrite a running referee score
      if (lastPushed.current[m.id] === sig) continue; // already in sync (came from the referee page)
      lastPushed.current[m.id] = sig;
      const scores: [number, number][] = [[0, 0], [0, 0], [0, 0]];
      sets.slice(0, 3).forEach((x, i) => { scores[i] = [x[0], x[1]]; });
      const act = Math.min(2, sets.length);
      scores[act] = cur;
      FB.current.updateCourt(cfg.current.live_id, ct.no, (c: any) => {
        c.scores = scores; c.activeSet = act;
        if (!c.startedAt) { c.startedAt = Date.now(); c.paused = false; }
      }).catch(() => { delete lastPushed.current[m.id]; });
    }
  }, [matches, fb, bridgeOn, fbLoaded, courts]);

  // สนามที่ถูกลบในแอป -> ลบออกจาก Firebase ด้วย (จอใหญ่/หน้ากรรมการจะไม่เห็น)
  useEffect(() => {
    if (!bridgeOn || !fbLoaded || !cfg.current || !FB.current || !canWrite || !courts.length) return;
    const known = new Set(courts.map((c) => c.no));
    const gone = Object.keys(fb).map(Number).filter((no) => fb[no] && !known.has(no));
    if (!gone.length) return;
    gone.forEach((no) => { delete lastSig.current[no]; });
    const done = FB.current.removeCourts
      ? FB.current.removeCourts(cfg.current.live_id, gone)
      : Promise.all(gone.map((no) => FB.current.updateCourt(cfg.current.live_id, no, (c: any) => { c.hidden = true; c.status = 'READY'; })));
    Promise.resolve(done).catch(() => { /* retry on next change */ });
  }, [courts, fb, bridgeOn, fbLoaded, canWrite]);

  // put the court's current match on the referee page when it changes
  useEffect(() => {
    if (!bridgeOn || !fbLoaded || !cfg.current || !FB.current) return;
    (async () => {
      for (const ct of courts) {
        const m = currentMatch(ct.no);
        const maint = ct.status === 'maintenance';
        const sig = (m ? CODE(m) : 'none') + (maint ? '|maint' : '');
        if (lastSig.current[ct.no] === sig) continue;
        const existing = fb[ct.no];
        if (maint && existing && !existing.hidden) {
          FB.current.updateCourt(cfg.current!.live_id, ct.no, (c: any) => { c.hidden = true; }).catch(() => { delete lastSig.current[ct.no]; });
          lastSig.current[ct.no] = sig;
          if (!m) continue;
        }
        if (existing && existing.status === 'LIVE' && existing.matchCode === (m ? CODE(m) : undefined)) {
          lastSig.current[ct.no] = sig;
          // same match: refresh labels only (match number, round, category, rule) - never touch the score
          const p = payload(ct.no, m);
          const same = (existing.matchNo || 0) === (p.matchNo || 0) && (existing.roundLabel || '') === p.roundLabel && (existing.catName || '') === p.catName && JSON.stringify((existing as any).rule || null) === JSON.stringify(p.rule);
          if (!same) {
            FB.current.updateCourt(cfg.current!.live_id, ct.no, (c: any) => {
              c.matchNo = p.matchNo; c.roundLabel = p.roundLabel; c.catName = p.catName; c.round = p.round; c.rule = p.rule; c.tournament = p.tournament;
            }).catch(() => { delete lastSig.current[ct.no]; });
          }
          continue;
        }
        const exM = existing?.matchCode ? latest.current.matches.find((x) => x.id.startsWith(existing.matchCode!)) : undefined;
        const exDone = !!exM; // the app knows this match but no longer has it on this court (finished / sent back to the queue) -> free the court (and the referee page)
        if (!m && existing && existing.status === 'LIVE' && !exDone && (existing.startedAt || existing.scores.some((s) => s[0] || s[1]))) continue; // never wipe a referee's running match (called-only courts are cleared)
        lastSig.current[ct.no] = sig;
        try {
          await FB.current.writeCourts(cfg.current!.live_id, [payload(ct.no, m)]);
        } catch {
          delete lastSig.current[ct.no];
        }
      }
    })();
  }, [bridgeOn, fbLoaded, matches, courts, fb, payload]);

  const refereeUrl = useCallback(
    async (no: number, umpire?: string, rotate?: boolean): Promise<string> => {
      const c = cfg.current;
      if (!c) throw new Error(error || 'ยังเชื่อม Firebase ไม่เสร็จ ลองอีกครั้ง');
      if (rotate || !c.keys['c' + no]) {
        c.keys['c' + no] = rand(24);
        const sv = await sb.rpc('save_live_keys', { p_tournament: tid, p_keys: c.keys });
        if (sv.error) throw sv.error;
        await FB.current.publishCourtKeys(c.live_id, c.keys);
      }
      const m = currentMatch(no);
      if (!fb[no] && fbReady.current) await FB.current.writeCourts(c.live_id, [payload(no, m)]);
      return `${location.origin}${import.meta.env.BASE_URL}referee.html?court=${no}&live=${c.live_id}${umpire ? '&ref=' + encodeURIComponent(umpire) : ''}#k=${c.keys['c' + no]}`;
    },
    [error, tid, fb, payload],
  );

  return { fb, bridgeOn, error, refereeUrl, liveId };
}
