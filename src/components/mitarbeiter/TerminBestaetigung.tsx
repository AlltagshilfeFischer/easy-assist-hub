import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { XCircle, AlertTriangle, Clock, Loader2, CheckCircle2 } from 'lucide-react';

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  kunden_id: string;
  customer?: {
    id: string;
    name: string;
  };
}

interface TerminBestaetigungProps {
  appointments: Appointment[];
  onUpdate: () => void;
}

export function TerminBestaetigung({ appointments, onUpdate }: TerminBestaetigungProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [istStundenMap, setIstStundenMap] = useState<Record<string, string>>({});

  // Filter past appointments that are still "scheduled" or "in_progress" (unconfirmed)
  const now = new Date();
  const unconfirmedPast = appointments.filter(a => {
    const end = new Date(a.end_at);
    return end < now && ['scheduled', 'in_progress'].includes(a.status);
  }).sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    setLoadingId(appointmentId);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus as Database['public']['Enums']['termin_status'],
      };

      // If completing and Ist-Stunden were entered, include them
      if (newStatus === 'completed') {
        const istStr = istStundenMap[appointmentId];
        if (istStr && !isNaN(parseFloat(istStr))) {
          updateData.iststunden = parseFloat(istStr);
        }
      }

      const { error } = await supabase
        .from('termine')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      const labels: Record<string, string> = {
        completed: 'Durchgefuehrt',
        abgesagt_rechtzeitig: 'Rechtzeitig abgesagt',
        nicht_angetroffen: 'Nicht angetroffen',
      };
      toast.success(`Termin als "${labels[newStatus] || newStatus}" markiert`);
      onUpdate();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Fehler beim Aktualisieren des Termins');
    } finally {
      setLoadingId(null);
    }
  };

  if (unconfirmedPast.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Offene Terminbestaetigungen
          <Badge variant="destructive" className="ml-2">{unconfirmedPast.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Bitte bestaetige deine vergangenen Termine oder melde Ausnahmen.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {unconfirmedPast.map(appointment => {
          const start = new Date(appointment.start_at);
          const end = new Date(appointment.end_at);
          const isLoading = loadingId === appointment.id;
          const customerName = appointment.customer?.name || appointment.titel;
          const plannedMinutes = differenceInMinutes(end, start);
          const plannedHours = (plannedMinutes / 60).toFixed(1);

          return (
            <div
              key={appointment.id}
              className="flex flex-col gap-3 p-3 bg-background rounded-lg border"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{customerName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(start, 'EEEE, dd.MM.yyyy', { locale: de })} · {format(start, 'HH:mm')} – {format(end, 'HH:mm')} ({plannedHours}h)
                  </p>
                </div>

                {/* Ist-Stunden optional */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Ist-Std:</span>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    max="12"
                    placeholder={plannedHours}
                    value={istStundenMap[appointment.id] || ''}
                    onChange={(e) => setIstStundenMap(prev => ({ ...prev, [appointment.id]: e.target.value }))}
                    className="w-20 h-7 text-sm"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isLoading}
                  onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                >
                  {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Durchgefuehrt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                  disabled={isLoading}
                  onClick={() => handleStatusUpdate(appointment.id, 'abgesagt_rechtzeitig')}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Rechtzeitig abgesagt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  disabled={isLoading}
                  onClick={() => handleStatusUpdate(appointment.id, 'nicht_angetroffen')}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Nicht angetroffen
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
