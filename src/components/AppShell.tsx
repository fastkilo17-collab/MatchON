import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  MapPin,
  Menu,
  Plus,
  Scale,
  Settings,
  Ticket,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMatchON } from '../context/MatchONContext';
import { AccountBox } from './AuthDialog';
import type { NavRoute, UserRole } from '../types/matchon';
import { ToastStack } from './UiKit';

interface NavItem {
  id: NavRoute;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'main' | 'manage' | 'arena' | 'info';
  roles: UserRole[];
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'ภาพรวมระบบ', shortLabel: 'ภาพรวม', icon: LayoutDashboard, group: 'main', roles: ['organizer'] },
  { id: 'home', label: 'หน้าหลักรายการ', shortLabel: 'หน้าหลัก', icon: LayoutDashboard, group: 'main', roles: ['organizer', 'player', 'referee'] },
  { id: 'tournaments', label: 'รายการแข่งขัน', shortLabel: 'รายการ', icon: Trophy, group: 'main', roles: ['organizer', 'player', 'referee'] },
  { id: 'register', label: 'สมัครแข่งขัน', shortLabel: 'สมัคร', icon: ClipboardCheck, group: 'main', roles: ['player', 'organizer'] },
  { id: 'my', label: 'การสมัครของฉัน', shortLabel: 'ของฉัน', icon: Ticket, group: 'main', roles: ['player', 'organizer'] },

  { id: 'roster', label: 'รายชื่อนักกีฬา', shortLabel: 'รายชื่อ', icon: Users, group: 'main', roles: ['organizer', 'player', 'referee'] },
  { id: 'athletes', label: 'จัดการนักกีฬา', shortLabel: 'นักกีฬา', icon: Users, group: 'manage', roles: ['organizer'] },
  { id: 'brackets', label: 'สายแข่งขัน', shortLabel: 'สาย', icon: GitBranch, group: 'manage', roles: ['organizer', 'player', 'referee'] },
  { id: 'schedule', label: 'ตารางการแข่งขัน', shortLabel: 'ตาราง', icon: CalendarDays, group: 'manage', roles: ['organizer', 'player', 'referee'] },

  { id: 'courts', label: 'จัดการสนาม', shortLabel: 'สนาม', icon: MapPin, group: 'arena', roles: ['organizer', 'referee'] },
  { id: 'live', label: 'Live Score', shortLabel: 'คะแนนสด', icon: Activity, group: 'arena', roles: ['organizer', 'player', 'referee'] },
  { id: 'staff', label: 'จัดการ Staff', shortLabel: 'Staff', icon: ShieldCheck, group: 'arena', roles: ['organizer'] },
  { id: 'rules', label: 'กติกา & กรรมการ', shortLabel: 'กติกา', icon: Scale, group: 'arena', roles: ['organizer', 'referee'] },

  { id: 'results', label: 'ผลการแข่งขัน', shortLabel: 'ผลแข่ง', icon: Trophy, group: 'info', roles: ['organizer', 'player', 'referee'] },
  { id: 'reports', label: 'รายงานและสถิติ', shortLabel: 'รายงาน', icon: BarChart3, group: 'info', roles: ['organizer'] },
  { id: 'admin', label: 'คำขอเป็นผู้จัด', shortLabel: 'คำขอ', icon: UserCheck, group: 'info', roles: ['organizer', 'player', 'referee'], adminOnly: true },
  { id: 'settings', label: 'โปรไฟล์ & บัญชี', shortLabel: 'โปรไฟล์', icon: Settings, group: 'info', roles: ['organizer', 'player', 'referee'] },
];

const ROLE_META: Record<UserRole, { label: string; short: string }> = {
  organizer: { label: 'ผู้จัดการแข่งขัน', short: 'ผู้จัด' },
  player: { label: 'นักกีฬา / ผู้ชม', short: 'นักกีฬา' },
  referee: { label: 'กรรมการสนาม', short: 'กรรมการ' },
};

const GROUP_TITLES: Record<NavItem['group'], string> = {
  main: 'เมนูหลัก',
  manage: 'จัดการแข่งขัน',
  arena: 'สนามและคะแนนสด',
  info: 'ผลลัพธ์และระบบ',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, route, navigate, activeTournament, setActiveTid, toasts, profile, isAdmin } = useMatchON();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const role = state.role;
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role) && (!item.adminOnly || isAdmin));
  const currentMeta = NAV_ITEMS.find((item) => item.id === route);

  const primaryBottomIds: NavRoute[] =
    role === 'organizer'
      ? ['dashboard', 'courts', 'live', 'schedule']
      : role === 'referee'
        ? ['live', 'courts', 'schedule', 'results']
        : ['tournaments', 'register', 'my', 'live'];

  const bottomTabs = primaryBottomIds
    .map((id) => NAV_ITEMS.find((item) => item.id === id))
    .filter(Boolean) as NavItem[];

  const hideTournamentPicker = ['tournaments', 'register', 'my', 'settings'].includes(route);

  const handleNav = (id: NavRoute) => {
    navigate(id);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Bright Light Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-dvh noprint">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100 shrink-0">
          {!logoError ? (
            <img
              src={`${import.meta.env.BASE_URL}src/assets/images/matchon_emblem_1794832771407.jpg`}
              alt="MatchON"
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-display font-bold text-base shrink-0">
              M
            </div>
          )}
          <span className="font-display font-bold text-lg tracking-tight text-slate-900 whitespace-nowrap">
            MatchON
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {(['main', 'manage', 'arena', 'info'] as const).map((groupKey) => {
            const items = visibleItems.filter((i) => i.group === groupKey);
            if (!items.length) return null;
            return (
              <div key={groupKey}>
                <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
                  {GROUP_TITLES[groupKey]}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = route === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNav(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <AccountBox />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Sticky Top Header (56px mobile, 64px desktop) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between gap-3 noprint">
          {/* Left: Mobile Brand or Desktop Page Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => handleNav(role === 'organizer' ? 'dashboard' : role === 'referee' ? 'live' : 'tournaments')}
              className="lg:hidden flex items-center gap-2 shrink-0 min-h-[40px]"
            >
              {!logoError ? (
                <img
                  src={`${import.meta.env.BASE_URL}src/assets/images/matchon_emblem_1794832771407.jpg`}
                  alt="MatchON"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-7 h-7 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-display font-bold text-xs">
                  M
                </div>
              )}
              <span className="font-display font-bold text-base text-slate-900 whitespace-nowrap">
                MatchON
              </span>
            </button>

            <h1 className="hidden lg:block font-display font-bold text-lg text-slate-900 truncate">
              {currentMeta?.label || 'MatchON'}
            </h1>
          </div>

          {/* Center/Right: Tournament Picker + Primary Action / Role Switch */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!hideTournamentPicker && state.tournaments.length > 0 && (
              <div className="relative flex items-center min-w-0 max-w-[175px] sm:max-w-[260px]">
                <select
                  aria-label="เลือกรายการแข่งขัน"
                  value={activeTournament?.id || ''}
                  onChange={(e) => setActiveTid(e.target.value)}
                  className="w-full appearance-none bg-slate-100 hover:bg-slate-200/70 text-slate-800 text-xs sm:text-sm font-medium rounded-xl pl-3 pr-8 py-2 min-h-[40px] border border-transparent focus:border-blue-500 focus:bg-white focus:outline-none truncate transition-colors cursor-pointer"
                >
                  {state.tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 pointer-events-none absolute right-2.5" />
              </div>
            )}

            {hideTournamentPicker && activeTournament && (
              <button type="button" onClick={() => handleNav('home')} title="หน้าหลักรายการ" className="min-w-0 max-w-[140px] sm:max-w-[260px] truncate text-xs sm:text-sm font-semibold text-slate-700 hover:text-blue-700">
                {activeTournament.name}
              </button>
            )}

            {profile && (
              <button type="button" onClick={() => handleNav('settings')} aria-label="โปรไฟล์ของฉัน" title={profile.display_name || 'โปรไฟล์'} className="shrink-0 w-10 h-10 rounded-full overflow-hidden ring-2 ring-white shadow bg-blue-100 grid place-items-center text-sm font-bold text-blue-700">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>{[...(profile.display_name || profile.email || '?')][0]}</span>
                )}
              </button>
            )}

            {/* Mobile Quick Role Switcher */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              title="บัญชีผู้ใช้"
              className={`lg:hidden min-h-[40px] px-3 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 ${profile ? 'hidden' : ''}`}
            >
              {profile ? '' : 'เข้าสู่ระบบ'}
            </button>

            {/* Desktop Single Primary CTA */}
            {role === 'organizer' ? (
              <button
                type="button"
                onClick={() => handleNav('tournaments')}
                className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-blue-600/15"
              >
                <Plus className="w-4 h-4" />
                <span>จัดการรายการ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('register')}
                className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-blue-600/15"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>สมัครแข่งขัน</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed 64px + safe-area) */}
      <nav
        aria-label="เมนูหลักบนมือถือ"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe noprint"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {bottomTabs.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
                <span className={`text-[10.5px] mt-1 leading-none whitespace-nowrap ${active ? 'font-semibold' : 'font-medium'}`}>
                  {item.shortLabel}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="เปิดเมนูทั้งหมด"
            className={`flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl transition-colors ${
              menuOpen ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Menu className="w-5 h-5 stroke-[2]" />
            <span className="text-[10.5px] mt-1 leading-none font-medium whitespace-nowrap">เมนูทั้งหมด</span>
          </button>
        </div>
      </nav>

      {/* Mobile Full Menu Bottom Sheet */}
      <AnimatePresence>
        {menuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-h-[85dvh] flex flex-col bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            >
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-slate-300" />
              </div>

              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-base text-slate-900">เมนูทั้งหมด</h2>
                  <p className="text-xs text-slate-500">เลือกฟังก์ชันที่ต้องการใช้งาน</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="ปิดเมนู"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100"><AccountBox /></div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-safe">
                {(['main', 'manage', 'arena', 'info'] as const).map((groupKey) => {
                  const items = visibleItems.filter((i) => i.group === groupKey);
                  if (!items.length) return null;
                  return (
                    <div key={groupKey}>
                      <div className="text-xs font-semibold text-slate-400 mb-2">
                        {GROUP_TITLES[groupKey]}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((item) => {
                          const Icon = item.icon;
                          const active = route === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNav(item.id)}
                              className={`flex items-center gap-2.5 px-3.5 py-3 min-h-[48px] rounded-xl border text-left text-sm font-medium transition-colors ${
                                active
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ToastStack toasts={toasts} />
    </div>
  );
}
