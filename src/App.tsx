/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppShell } from './components/AppShell';
import { MatchONProvider, useMatchON } from './context/MatchONContext';
import { AthletesPage } from './pages/AthletesPage';
import { BracketsPage } from './pages/BracketsPage';
import { CourtsPage } from './pages/CourtsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveScorePage } from './pages/LiveScorePage';
import { MyRegistrationsPage, RegisterPage } from './pages/RegisterPage';
import { SchedulePage } from './pages/SchedulePage';
import { AdminRequestsPage, ReportsPage, ResultsPage, RulesStaffPage, SettingsPage, StaffPage } from './pages/SecondaryPages';
import { RosterPage } from './pages/RosterPage';
import { TournamentHomePage } from './pages/TournamentHomePage';
import { TournamentsPage } from './pages/TournamentsPage';

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
    case 'home':
      return <TournamentHomePage />;
    case 'roster':
      return <RosterPage />;
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
        <RouteSwitch />
      </AppShell>
    </MatchONProvider>
  );
}
