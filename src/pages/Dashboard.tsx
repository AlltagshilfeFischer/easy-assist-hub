import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import DashboardHome from './DashboardHome';
import ScheduleBuilder from './controlboard/ScheduleBuilder';
import MasterData from './controlboard/MasterData';
import NewEntries from './controlboard/NewEntries';
import MitarbeiterDashboard from './MitarbeiterDashboard';
import { useUserRole } from '@/hooks/useUserRole';

export default function Dashboard() {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Mitarbeiter sehen nur ihre eigene Dashboard-Ansicht
  if (role === 'mitarbeiter') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<MitarbeiterDashboard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // Admin sieht die vollständige Verwaltungsansicht
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/controlboard/schedule-builder" element={<ScheduleBuilder />} />
        <Route path="/controlboard/master-data" element={<MasterData />} />
        <Route path="/controlboard/new-entries" element={<NewEntries />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}