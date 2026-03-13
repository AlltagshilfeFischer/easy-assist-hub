import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import DashboardHome from './DashboardHome';
import MitarbeiterDashboard from './MitarbeiterDashboard';
import ScheduleBuilderModern from './controlboard/ScheduleBuilderModern';
import MasterData from './controlboard/MasterData';
import NewEntries from './controlboard/NewEntries';
import BenutzerverwaltungNeu from './controlboard/BenutzerverwaltungNeu';
import Leistungsnachweise from './controlboard/Leistungsnachweise';
import Dokumentenverwaltung from './controlboard/Dokumentenverwaltung';
import AktivitaetsLog from './controlboard/AktivitaetsLog';

import MitarbeiterStart from './MitarbeiterStart';
import BudgetTracker from './controlboard/budgettracker/BudgetTracker';
import BudgetTrackerDetail from './controlboard/budgettracker/BudgetTrackerDetail';

import Settings from './Settings';
import { useUserRole } from '@/hooks/useUserRole';

export default function Dashboard() {
  const { role, loading } = useUserRole();
  const { signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Kein Zugriff</h2>
          <p className="text-muted-foreground">
            Ihrem Konto wurde noch keine Rolle zugewiesen. Bitte kontaktieren Sie den Administrator.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="mt-4">
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </div>
      </div>
    );
  }

  // Mitarbeiter: nur eigener Bereich, kein Pflegebudget
  if (role === 'mitarbeiter') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<MitarbeiterStart />} />
          <Route path="/mein-bereich" element={<MitarbeiterDashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // Buchhaltung: nur Einsicht — kein Import, kein Dienstplan, keine Stammdaten
  if (role === 'buchhaltung') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/controlboard/budgettracker" element={<BudgetTracker />} />
          <Route path="/controlboard/budgettracker/:kundenId" element={<BudgetTrackerDetail />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // Admin (Disponent): Einsatzplanung + Pflegebudget, keine Userverwaltung
  if (role === 'admin') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/controlboard/schedule-builder" element={<ScheduleBuilderModern />} />
          <Route path="/controlboard/master-data" element={<MasterData />} />
          <Route path="/controlboard/dokumentenverwaltung" element={<Dokumentenverwaltung />} />
          <Route path="/controlboard/leistungsnachweise" element={<Leistungsnachweise />} />
          <Route path="/controlboard/budgettracker" element={<BudgetTracker />} />
          <Route path="/controlboard/budgettracker/:kundenId" element={<BudgetTrackerDetail />} />
          <Route path="/controlboard/aktivitaetslog" element={<AktivitaetsLog />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // GlobalAdmin oder Geschäftsführer: Vollzugriff
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/mein-bereich" element={<MitarbeiterDashboard />} />
        <Route path="/controlboard/schedule-builder" element={<ScheduleBuilderModern />} />
        <Route path="/controlboard/master-data" element={<MasterData />} />
        <Route path="/controlboard/new-entries" element={<NewEntries />} />
        <Route path="/controlboard/admin" element={<BenutzerverwaltungNeu />} />
        <Route path="/controlboard/dokumentenverwaltung" element={<Dokumentenverwaltung />} />
        <Route path="/controlboard/leistungsnachweise" element={<Leistungsnachweise />} />
        <Route path="/controlboard/budgettracker" element={<BudgetTracker />} />
        <Route path="/controlboard/budgettracker/:kundenId" element={<BudgetTrackerDetail />} />
        <Route path="/controlboard/aktivitaetslog" element={<AktivitaetsLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
