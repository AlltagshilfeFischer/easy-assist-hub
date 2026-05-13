import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

export type Rechnung = Database['public']['Tables']['rechnungen']['Row'];
export type Rechnungsposition = Database['public']['Tables']['rechnungspositionen']['Row'];
export type RechnungStatus = Database['public']['Enums']['rechnung_status'];

interface StatusUpdateFields {
  status: RechnungStatus;
  freigegeben_von?: string;
  freigegeben_am?: string;
  versendet_am?: string;
  bezahlt_am?: string;
}

export function useRechnungen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: rechnungen, isLoading } = useQuery({
    queryKey: ['rechnungen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rechnungen')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Rechnung[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: RechnungStatus;
    }) => {
      const now = new Date().toISOString();
      const fields: StatusUpdateFields = { status };

      if (status === 'freigegeben') {
        fields.freigegeben_von = user?.id;
        fields.freigegeben_am = now;
      } else if (status === 'versendet') {
        fields.versendet_am = now;
      } else if (status === 'bezahlt') {
        fields.bezahlt_am = now;
      }

      const { data, error } = await supabase
        .from('rechnungen')
        .update(fields)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Rechnung;
    },
    onSuccess: (_, variables) => {
      const labels: Record<RechnungStatus, string> = {
        entwurf: 'Entwurf',
        freigegeben: 'Freigegeben',
        versendet: 'Als versendet markiert',
        bezahlt: 'Als bezahlt markiert',
        storniert: 'Storniert',
      };
      toast.success(labels[variables.status] || 'Status aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['rechnungen'] });
    },
    onError: (err) => {
      toast.error('Fehler beim Aktualisieren', {
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    },
  });

  const stornoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('rechnungen')
        .update({ status: 'storniert' as RechnungStatus })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Rechnung;
    },
    onSuccess: () => {
      toast.success('Rechnung storniert');
      queryClient.invalidateQueries({ queryKey: ['rechnungen'] });
    },
    onError: (err) => {
      toast.error('Fehler beim Stornieren', {
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    },
  });

  return {
    rechnungen,
    isLoading,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
    storno: stornoMutation.mutate,
    isStornoing: stornoMutation.isPending,
  };
}

export function useRechnungspositionen(rechnungId: string | null) {
  return useQuery({
    queryKey: ['rechnungspositionen', rechnungId],
    queryFn: async () => {
      if (!rechnungId) return [];
      const { data, error } = await supabase
        .from('rechnungspositionen')
        .select('*')
        .eq('rechnung_id', rechnungId)
        .order('leistungsdatum', { ascending: true });
      if (error) throw error;
      return data as Rechnungsposition[];
    },
    enabled: !!rechnungId,
  });
}
