// Shared state + helpers for the MatchON main app.
export * from '../v1/js/lib.js';
export { buildKnockout, buildRoundRobin, standings, autoSchedule, roundLabel, seedOrder } from '../v1/js/bracket.js';
import { sb, teamName } from '../v1/js/lib.js';

export const MANAGE = ['super_admin', 'organizer', 'staff'];
export const ALL = ['anon', 'player', 'referee', 'staff', 'organizer', 'super_admin'];

export const S = { user: null, role: 'anon', name: '', tid: null, tournaments: [] };
export const canManage = () => MANAGE.includes(S.role);
export const ROLE_TH = { super_admin: 'ผู้ดูแลระบบ', organizer: 'ผู้จัดการแข่งขัน', staff: 'เจ้าหน้าที่', referee: 'กรรมการ', player: 'นักกีฬา', anon: 'ผู้ชม' };

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
export { store };

export async function loadSession() {
  const { data } = await sb.auth.getSession();
  S.user = (data && data.session && data.session.user) || null;
  S.role = 'anon';
  S.name = '';
  if (S.user) {
    const { data: p } = await sb.from('profiles').select('role,display_name').eq('id', S.user.id).maybeSingle();
    S.role = (p && p.role) || 'player';
    S.name = (p && p.display_name) || S.user.email || '';
  }
  await loadTournaments();
}

export async function loadTournaments() {
  const { data } = await sb.from('tournaments').select('*').order('created_at', { ascending: false });
  S.tournaments = data || [];
  const saved = store.get('matchon.tid');
  S.tid = S.tournaments.some((t) => t.id === saved) ? saved : (S.tournaments[0] && S.tournaments[0].id) || null;
}
export const setTid = (id) => { S.tid = id; store.set('matchon.tid', id); };
export const curT = () => S.tournaments.find((t) => t.id === S.tid) || null;

// Everything one tournament page needs. Managers read registrations directly; everyone else gets the public view.
export async function loadData(tid) {
  const mgr = canManage();
  const [cats, regs, matches, courts, brackets] = await Promise.all([
    sb.from('categories').select('*').eq('tournament_id', tid).order('sort').order('name'),
    mgr ? sb.from('registrations').select('*').eq('tournament_id', tid).order('created_at')
        : sb.rpc('public_entries', { p_tournament: tid }),
    sb.from('matches').select('*').eq('tournament_id', tid).order('round').order('slot'),
    sb.from('courts').select('*').eq('tournament_id', tid).order('no'),
    sb.from('brackets').select('*').eq('tournament_id', tid),
  ]);
  for (const r of [cats, regs, matches, courts, brackets]) if (r.error) throw r.error;
  const D = { tid, cats: cats.data || [], regs: regs.data || [], matches: matches.data || [], courts: courts.data || [], brackets: brackets.data || [] };
  D.E = Object.fromEntries(D.regs.map((r) => [r.id, r]));
  D.C = Object.fromEntries(D.cats.map((c) => [c.id, c]));
  return D;
}

export const name = (D, id) => (id && D.E[id] ? teamName(D.E[id]) : 'รอผลการแข่ง');
export const people = (r) => (r.p2_name ? 2 : 1);

export const KIND_TH = { singles: 'เดี่ยว', doubles: 'คู่' };
export const GENDER_TH = { male: 'ชาย', female: 'หญิง', mixed: 'ผสม', open: 'ทั่วไป' };
export const FORMAT_TH = { knockout: 'แพ้คัดออก', round_robin: 'พบกันหมด', group_stage: 'แบ่งกลุ่ม', group_knockout: 'แบ่งกลุ่ม + ไขว้สาย', swiss: 'Swiss' };
export const MATCH_TH = { scheduled: 'รอแข่ง', live: 'กำลังแข่ง', finished: 'จบแล้ว' };

// Does a registrant meet the category age window? Returns '' when fine, otherwise a short reason.
export function ageProblem(cat, birthYearCE) {
  if (cat.age_min == null && cat.age_max == null) return '';
  if (!birthYearCE) return 'ต้องระบุปีเกิด';
  const age = new Date().getFullYear() - birthYearCE;
  if (cat.age_min != null && age < cat.age_min) return 'อายุน้อยกว่าเกณฑ์';
  if (cat.age_max != null && age > cat.age_max) return 'อายุมากกว่าเกณฑ์';
  return '';
}

export function downloadFile(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

export const tabs = (items, cur) => items.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('');
export const pill = (txt, kind = '') => `<span class="pill ${kind}">${txt}</span>`;
export const confirmBox = (msg) => window.confirm(msg);

// Notify a registrant (shows in their status page).
export async function notify(tournamentId, registrationId, kind, title, body) {
  await sb.from('notifications').insert({ tournament_id: tournamentId, registration_id: registrationId, kind, title, body });
}
