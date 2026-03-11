import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentApprovalDialog } from './dialogs/AppointmentApprovalDialog';
import { cn } from '@/lib/utils';

interface AppointmentChange {
  id: string;
  termin_id: string;
  requested_by: string;
  old_start_at: string;
  old_end_at: string;
  old_mitarbeiter_id: string | null;
  old_kunden_id: string;
  new_start_at: string | null;
  new_end_at: string | null;
  new_mitarbeiter_id: string | null;
  new_kunden_id: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  requester?: {
    vorname: string;
    nachname: string;
  };
  old_customer?: {
    vorname: string;
    nachname: string;
  };
  new_customer?: {
    vorname: string;
    nachname: string;
  };
  old_employee?: {
    vorname: string;
    nachname: string;
  };
  new_employee?: {
    vorname: string;
    nachname: string;
  };
}

export function AppointmentApprovalBar() {
  const [pendingChanges, setPendingChanges] = useState<AppointmentChange[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadPendingChanges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('termin_aenderungen')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (mountedRef.current) {
        setPendingChanges((data as any) || []);
      }
    } catch (error) {
      console.error('Error loading pending changes:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadPendingChanges();

    // Subscribe to changes
    const subscription = supabase
      .channel('termin_aenderungen_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'termin_aenderungen'
      }, () => {
        loadPendingChanges();
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const hasChanges = pendingChanges.length > 0;

  return (
    <>
      <Button
        variant={hasChanges ? "default" : "outline"}
        size="sm"
        onClick={() => hasChanges && setShowDialog(true)}
        className={cn(
          "relative",
          hasChanges 
            ? "bg-amber-600 hover:bg-amber-700 text-white" 
            : "border-green-500 text-green-700 dark:text-green-400"
        )}
        disabled={!hasChanges}
      >
        <Bell className="h-4 w-4 mr-2" />
        Genehmigungen
        {hasChanges && (
          <Badge variant="secondary" className="ml-2 bg-white text-amber-900">
            {pendingChanges.length}
          </Badge>
        )}
      </Button>

      <AppointmentApprovalDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        changes={pendingChanges}
        onApprovalAction={loadPendingChanges}
      />
    </>
  );
}
