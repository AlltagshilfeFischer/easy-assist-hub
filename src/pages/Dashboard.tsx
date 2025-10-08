import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import DashboardHome from './DashboardHome';
import ScheduleBuilder from './controlboard/ScheduleBuilder';
import MasterData from './controlboard/MasterData';
import NewEntries from './controlboard/NewEntries';
import MitarbeiterVerwaltung from './controlboard/MitarbeiterVerwaltung';
import MitarbeiterDashboard from './MitarbeiterDashboard';
import PendingApproval from './PendingApproval';
import { useUserRole } from '@/hooks/useUserRole';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { role, loading } = useUserRole();
  const { user } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

  useEffect(() => {
    async function checkApprovalStatus() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('pending_registrations')
          .select('status')
          .eq('email', user.email)
          .maybeSingle();

        if (!error && data) {
          setApprovalStatus(data.status);
        }
      } catch (error) {
        console.error('Error checking approval status:', error);
      } finally {
        setCheckingApproval(false);
      }
    }

    checkApprovalStatus();
  }, [user]);

  if (loading || checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user is pending approval
  if (approvalStatus === 'pending') {
    return <PendingApproval />;
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
        <Route path="/controlboard/mitarbeiter-verwaltung" element={<MitarbeiterVerwaltung />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}