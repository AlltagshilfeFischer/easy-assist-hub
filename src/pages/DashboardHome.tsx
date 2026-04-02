import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, AlertCircle, Clock, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import QuickActionChat from '@/components/dashboard/QuickActionChat';
import { useSettings } from '@/hooks/useSettings';

export default function DashboardHome() {
  const { settings } = useSettings();
  const {
    data: customersCount,
    isLoading: isLoadingCustomers
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
    data: pendingApprovalsCount,
    isLoading: isLoadingApprovals
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

  const {
    data: avgHoursPerCustomer,
    isLoading: isLoadingAvgHours
  } = useQuery({
    queryKey: ['avg-hours-per-customer'],
    queryFn: async () => {
      const { data: termine, error: termineError } = await supabase
        .from('termine')
        .select('iststunden, kunden_id');
      
      if (termineError) throw termineError;
      if (!termine || termine.length === 0) return 0;

      const customerHours = new Map<string, number>();
      termine.forEach(t => {
        const hours = customerHours.get(t.kunden_id) || 0;
        customerHours.set(t.kunden_id, hours + (t.iststunden || 0));
      });

      const totalHours = Array.from(customerHours.values()).reduce((sum, h) => sum + h, 0);
      return customerHours.size > 0 ? (totalHours / customerHours.size).toFixed(1) : 0;
    }
  });

  const {
    data: monthlyHours,
    isLoading: isLoadingMonthly
  } = useQuery({
    queryKey: ['monthly-hours'],
    queryFn: async () => {
      const now = new Date();
      const start = startOfMonth(now).toISOString();
      const end = endOfMonth(now).toISOString();

      const { data: termine, error } = await supabase
        .from('termine')
        .select('iststunden, start_at, end_at')
        .gte('start_at', start)
        .lte('start_at', end);

      if (error) throw error;

      const actualHours = termine?.reduce((sum, t) => sum + (t.iststunden || 0), 0) || 0;
      const plannedHours = termine?.reduce((sum, t) => {
        const duration = (new Date(t.end_at).getTime() - new Date(t.start_at).getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }, 0) || 0;

      return {
        actual: actualHours.toFixed(1),
        planned: plannedHours.toFixed(1)
      };
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
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Ausstehende Approvals</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {isLoadingApprovals ? <Skeleton className="h-8 w-12" /> : (pendingApprovalsCount ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Zu genehmigen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kunden</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingCustomers ? <Skeleton className="h-8 w-12" /> : (customersCount ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Aktive Kunden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Durchschnittsstunden</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingAvgHours ? <Skeleton className="h-8 w-16" /> : <>{avgHoursPerCustomer ?? 0}h</>}
            </div>
            <p className="text-xs text-muted-foreground">Pro Kunde</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stunden (Aktueller Monat)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingMonthly ? <Skeleton className="h-8 w-16" /> : <>{monthlyHours?.actual ?? 0}h</>}
            </div>
            <p className="text-xs text-muted-foreground">Geleistet</p>
            <div className="text-lg font-semibold mt-2">
              {isLoadingMonthly ? <Skeleton className="h-6 w-16" /> : <>{monthlyHours?.planned ?? 0}h</>}
            </div>
            <p className="text-xs text-muted-foreground">Geplant</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Chat — nur wenn KI-Modus aktiv */}
      {settings.aiModeEnabled && <QuickActionChat />}
    </div>;
}