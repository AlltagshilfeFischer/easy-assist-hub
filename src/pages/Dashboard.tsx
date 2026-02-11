import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import DashboardHome from './DashboardHome';
import ScheduleBuilderModern from './controlboard/ScheduleBuilderModern';
import MasterData from './controlboard/MasterData';
import NewEntries from './controlboard/NewEntries';
import BenutzerverwaltungNeu from './controlboard/BenutzerverwaltungNeu';
import Billing from './controlboard/Billing';
import Dokumentenverwaltung from './controlboard/Dokumentenverwaltung';
import MitarbeiterStart from './MitarbeiterStart';
import PendingApproval from './PendingApproval';
import Settings from './Settings';
import { useUserRole } from '@/hooks/useUserRole';

export default function Dashboard() {
  const { role, loading, isBuchhaltung } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Keine Rolle → nicht in benutzer Tabelle → Warteseite
  if (role === null) {
    return <PendingApproval />;
  }

  // Mitarbeiter (ohne andere Rolle) sehen eingeschränkte Startseite
  if (role === 'mitarbeiter') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<MitarbeiterStart />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // Buchhaltung: Dashboard + Abrechnungen
  if (role === 'buchhaltung') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/controlboard/billing" element={<Billing />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // Disponent (admin): Dienstplan, Kunden, Dokumente, Abrechnungen (kein Benutzerverwaltung/Einstellungen)
  if (role === 'admin') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/controlboard/schedule-builder" element={<ScheduleBuilderModern />} />
          <Route path="/controlboard/master-data" element={<MasterData />} />
          <Route path="/controlboard/dokumentenverwaltung" element={<Dokumentenverwaltung />} />
          <Route path="/controlboard/billing" element={<Billing />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // StandortSuperadmin (geschaeftsfuehrer): Vollzugriff
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/controlboard/schedule-builder" element={<ScheduleBuilderModern />} />
        <Route path="/controlboard/master-data" element={<MasterData />} />
        <Route path="/controlboard/new-entries" element={<NewEntries />} />
        <Route path="/controlboard/admin" element={<BenutzerverwaltungNeu />} />
        <Route path="/controlboard/dokumentenverwaltung" element={<Dokumentenverwaltung />} />
        <Route path="/controlboard/billing" element={<Billing />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
