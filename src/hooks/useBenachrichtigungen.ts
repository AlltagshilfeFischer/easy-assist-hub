import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Benachrichtigung {
  id: string;
  typ: string;
  titel: string;
  nachricht: string | null;
  gelesen: boolean;
  termin_id: string | null;
  created_at: string;
}

export function useBenachrichtigungen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['benachrichtigungen', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Benachrichtigung[]> => {
      const { data, error } = await (supabase
        .from('benachrichtigungen' as any)
        .select('id, typ, titel, nachricht, gelesen, termin_id, created_at')
        .eq('benutzer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)) as any;
      if (error) throw error;
      return (data ?? []) as Benachrichtigung[];
    },
    refetchInterval: 30000, // Poll every 30s
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('benachrichtigungen-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'benachrichtigungen', filter: `benutzer_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['benachrichtigungen', user.id] });
        }
      );

    try {
      channel.subscribe();
    } catch {
      // Realtime not available — polling fallback is active
    }

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return query;
}

export function useUnreadCount() {
  const { data: benachrichtigungen = [] } = useBenachrichtigungen();
  return benachrichtigungen.filter((b) => !b.gelesen).length;
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('benachrichtigungen' as any)
        .update({ gelesen: true } as any)
        .eq('id', id)) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benachrichtigungen', user?.id] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('benachrichtigungen')
        .update({ gelesen: true })
        .eq('benutzer_id', user.id)
        .eq('gelesen', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benachrichtigungen', user?.id] });
    },
  });
}
