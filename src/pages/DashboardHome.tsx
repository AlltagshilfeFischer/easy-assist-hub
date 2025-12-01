import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export default function DashboardHome() {
  const {
    data: customersCount
  } = useQuery({
    queryKey: ['customers-count'],
    queryFn: async () => {
      const {
        count,
        error
      } = await supabase.from('kunden').select('*', {
        count: 'exact',
        head: true
      }).eq('aktiv', true);
      if (error) throw error;
      return count || 0;
    }
  });
  const {
    data: employeesCount
  } = useQuery({
    queryKey: ['employees-count'],
    queryFn: async () => {
      const {
        count,
        error
      } = await supabase.from('mitarbeiter').select('*', {
        count: 'exact',
        head: true
      }).eq('ist_aktiv', true);
      if (error) throw error;
      return count || 0;
    }
  });
  const {
    data: pendingApprovalsCount
  } = useQuery({
    queryKey: ['pending-approvals-count'],
    queryFn: async () => {
      const {
        count,
        error
      } = await supabase.from('termin_aenderungen').select('*', {
        count: 'exact',
        head: true
      }).eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    }
  });

  return <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Übersicht</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kunden</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersCount || 0}</div>
            <p className="text-xs text-muted-foreground">Aktive Kunden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesCount || 0}</div>
            <p className="text-xs text-muted-foreground">Aktive Mitarbeiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausstehende Approvals</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovalsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Zu genehmigen</p>
          </CardContent>
        </Card>
      </div>
    </div>;
}