import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'mitarbeiter' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [mitarbeiterId, setMitarbeiterId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch user from benutzer table
        const { data: benutzerData, error: benutzerError } = await supabase
          .from('benutzer')
          .select('rolle, id')
          .eq('id', user.id)
          .maybeSingle();

        if (benutzerError) throw benutzerError;

        if (benutzerData) {
          setRole(benutzerData.rolle as UserRole);

          // If user is mitarbeiter, get their mitarbeiter_id
          if (benutzerData.rolle === 'mitarbeiter') {
            const { data: mitarbeiterData } = await supabase
              .from('mitarbeiter')
              .select('id')
              .eq('benutzer_id', user.id)
              .single();

            if (mitarbeiterData) {
              setMitarbeiterId(mitarbeiterData.id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  return { role, loading, mitarbeiterId };
}
