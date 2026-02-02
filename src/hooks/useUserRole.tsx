import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'mitarbeiter' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [mitarbeiterId, setMitarbeiterId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        // 1. Check approval status in benutzer table
        const { data: benutzerData, error: benutzerError } = await supabase
          .from('benutzer')
          .select('status, id')
          .eq('id', user.id)
          .maybeSingle();

        if (benutzerError) throw benutzerError;

        // Not in benutzer table OR not approved yet => not authorized
        if (!benutzerData || benutzerData.status !== 'approved') {
          setRole(null);
          setRoles([]);
          setMitarbeiterId(null);
          setLoading(false);
          return;
        }

        // 2. Fetch roles from secure user_roles table
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) throw rolesError;

        const roleList = (userRoles || []).map(r => r.role as UserRole);
        setRoles(roleList);

        // Determine primary role (highest privilege)
        if (roleList.includes('admin')) {
          setRole('admin');
        } else if (roleList.includes('manager')) {
          setRole('manager');
        } else if (roleList.includes('mitarbeiter')) {
          setRole('mitarbeiter');
        } else {
          setRole(null);
        }

        // 3. If user is mitarbeiter, get their mitarbeiter_id
        if (roleList.includes('mitarbeiter') || roleList.includes('manager')) {
          const { data: mitarbeiterData } = await supabase
            .from('mitarbeiter')
            .select('id')
            .eq('benutzer_id', user.id)
            .maybeSingle();

          if (mitarbeiterData) {
            setMitarbeiterId(mitarbeiterData.id);
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
        setRoles([]);
        setMitarbeiterId(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  // Helper functions for role checks
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || role === 'admin';
  const hasRole = (checkRole: UserRole) => roles.includes(checkRole);

  return { 
    role, 
    roles,
    loading, 
    mitarbeiterId,
    isAdmin,
    isManager,
    hasRole
  };
}
