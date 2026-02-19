import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChangeRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reason?: string;
  old_start_at?: string;
  old_end_at?: string;
  new_start_at?: string;
  new_end_at?: string;
  termin?: {
    titel: string;
    customer?: {
      name: string | null;
    } | null;
  } | null;
}

export function MyChangeRequests() {
  const { mitarbeiterId } = useUserRole();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadRequests = async () => {
    if (!mitarbeiterId) return;

    try {
      const { data, error } = await supabase
        .from('termin_aenderungen')
        .select(`
          id,
          status,
          created_at,
          reason,
          old_start_at,
          old_end_at,
          new_start_at,
          new_end_at,
          termin:termine(
            titel,
            customer:kunden(name)
          )
        `)
        .eq('requested_by', mitarbeiterId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading change requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [mitarbeiterId]);

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('termin_aenderungen')
        .delete()
        .eq('id', requestId)
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: 'Anfrage storniert',
        description: 'Die Änderungsanfrage wurde erfolgreich storniert.',
      });

      loadRequests();
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast({
        title: 'Fehler',
        description: 'Die Anfrage konnte nicht storniert werden.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Ausstehend
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Genehmigt
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Abgelehnt
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Meine Änderungsanfragen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Keine Änderungsanfragen vorhanden</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="p-4 rounded-lg border bg-card space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">{request.termin?.titel}</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.termin?.customer?.name}
                  </p>
                </div>
                {getStatusBadge(request.status)}
              </div>

              {request.reason && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Grund: </span>
                  <span>{request.reason}</span>
                </div>
              )}

              {request.old_start_at && request.new_start_at && (
                <div className="text-sm space-y-1">
                  <div className="text-muted-foreground">
                    Alt: {format(new Date(request.old_start_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    {request.old_end_at && ` - ${format(new Date(request.old_end_at), 'HH:mm', { locale: de })}`}
                  </div>
                  <div className="text-primary">
                    Neu: {format(new Date(request.new_start_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    {request.new_end_at && ` - ${format(new Date(request.new_end_at), 'HH:mm', { locale: de })}`}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Erstellt: {format(new Date(request.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                </span>
                {request.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(request.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Stornieren
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
