/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { AppShell } from './components/AppShell';
import { MatchONProvider, useMatchON } from './context/MatchONContext';

const SponsorsPage = lazy(() => import('./pages/SponsorsPage').then((m) => ({ default: m.SponsorsPage })));
const ModelsPage = lazy(() => import('./pages/ModelsPage').then((m) => ({ default: m.ModelsPage })));
const AthletesPage = lazy(() => import('./pages/AthletesPage').then((m) => ({ default: m.AthletesPage })));
const BracketsPage = lazy(() => import('./pages/BracketsPage').then((m) => ({ default: m.BracketsPage })));
const CourtsPage = lazy(() => import('./pages/CourtsPage').then((m) => ({ default: m.CourtsPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LiveScorePage = lazy(() => import('./pages/LiveScorePage').then((m) => ({ default: m.LiveScorePage })));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const SiteHomePage = lazy(() => import('./pages/SiteHomePage').then((m) => ({ default: m.SiteHomePage })));
const MePage = lazy(() => import('./pages/MePage').then((m) => ({ default: m.MePage })));
const TournamentHomePage = lazy(() => import('./pages/TournamentHomePage').then((m) => ({ default: m.TournamentHomePage })));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage').then((m) => ({ default: m.TournamentsPage })));
const MyRegistrationsPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.MyRegistrationsPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const AdminRequestsPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.AdminRequestsPage })));
const ReportsPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.ReportsPage })));
const ResultsPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.ResultsPage })));
const RulesStaffPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.RulesStaffPage })));
const SettingsPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.SettingsPage })));
const StaffPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.StaffPage })));

// เริ่มดาวน์โหลดหน้าแรกคู่ขนานกับการโหลดข้อมูล (ไม่รอข้อมูลเสร็จก่อน) และหน้าอื่นตอนว่าง
void import('./pages/SiteHomePage');
void import('./pages/TournamentHomePage');
if (typeof window !== 'undefined') {
  const idle = (window as any).requestIdleCallback || ((f: () => void) => setTimeout(f, 1500));
  idle(() => {
    void import('./pages/TournamentsPage');
    void import('./pages/RegisterPage');
    void import('./pages/BracketsPage');
    void import('./pages/LiveScorePage');
  });
}

const Fallback = () => <div className="p-10 text-center text-sm text-slate-500">กำลังโหลด…</div>;

function RouteSwitch() {
  const { route, loading } = useMatchON();
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล…</div>;

  switch (route) {
    case 'dashboard':
      return <DashboardPage />;
    case 'tournaments':
      return <TournamentsPage />;
    case 'register':
      return <RegisterPage />;
    case 'my':
      return <MyRegistrationsPage />;
    case 'athletes':
      return <AthletesPage />;
    case 'sponsors':
      return <SponsorsPage />;
    case 'models':
      return <ModelsPage />;
    case 'brackets':
      return <BracketsPage />;
    case 'schedule':
      return <SchedulePage />;
    case 'courts':
      return <CourtsPage />;
    case 'live':
      return <LiveScorePage />;
    case 'staff':
      return <StaffPage />;
    case 'rules':
      return <RulesStaffPage />;
    case 'results':
      return <ResultsPage />;
    case 'reports':
      return <ReportsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'mine':
      return <TournamentsPage mode="mine" />;
    case 'cats':
      return <TournamentsPage mode="cats" />;
    case 'info':
      return <TournamentsPage mode="info" />;
    case 'home':
      return <TournamentHomePage />;
    case 'me':
      return <MePage />;
    case 'site':
      return <SiteHomePage />;
    case 'roster':
      return <AthletesPage />;
    case 'admin':
      return <AdminRequestsPage />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  return (
    <MatchONProvider>
      <AppShell>
        <Suspense fallback={<Fallback />}>
          <RouteSwitch />
        </Suspense>
      </AppShell>
    </MatchONProvider>
  );
}
