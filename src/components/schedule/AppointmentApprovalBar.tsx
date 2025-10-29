import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentApprovalDialog } from './AppointmentApprovalDialog';
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadPendingChanges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('termin_aenderungen')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingChanges((data as any) || []);
    } catch (error) {
      console.error('Error loading pending changes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
      subscription.unsubscribe();
    };
  }, []);

  if (loading || pendingChanges.length === 0) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-lg shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                  {pendingChanges.length}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  Genehmigungen ausstehend
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {pendingChanges.length} {pendingChanges.length === 1 ? 'Terminänderung wartet' : 'Terminänderungen warten'} auf Genehmigung
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowDialog(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Jetzt prüfen
                <Badge variant="secondary" className="ml-2 bg-white text-amber-900">
                  {pendingChanges.length}
                </Badge>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {isExpanded && pendingChanges.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
              <div className="flex flex-wrap gap-2">
                {pendingChanges.slice(0, 3).map((change) => (
                  <Badge 
                    key={change.id} 
                    variant="outline" 
                    className="text-xs bg-white dark:bg-amber-950 border-amber-300 dark:border-amber-700"
                  >
                    {change.requester?.vorname} {change.requester?.nachname}
                  </Badge>
                ))}
                {pendingChanges.length > 3 && (
                  <Badge variant="outline" className="text-xs bg-white dark:bg-amber-950">
                    +{pendingChanges.length - 3} weitere
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AppointmentApprovalDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        changes={pendingChanges}
        onApprovalAction={loadPendingChanges}
      />
    </>
  );
}
