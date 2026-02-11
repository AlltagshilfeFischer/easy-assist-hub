import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Rollen: geschaeftsfuehrer (höchste), admin, buchhaltung, mitarbeiter
export type UserRole = 'geschaeftsfuehrer' | 'admin' | 'buchhaltung' | 'mitarbeiter' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [mitarbeiterId, setMitarbeiterId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    async function fetchUserRole() {
      if (!user) {
        if (mountedRef.current) {
          setRole(null);
          setRoles([]);
          setLoading(false);
        }
        return;
      }

      try {
        // 1. Check approval status in benutzer table
        const { data: benutzerData, error: benutzerError } = await supabase
          .from('benutzer')
          .select('status, id')
          .eq('id', user.id)
          .maybeSingle();

        if (!mountedRef.current) return;
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

        if (!mountedRef.current) return;
        if (rolesError) throw rolesError;

        const roleList = (userRoles || []).map(r => r.role as UserRole);
        setRoles(roleList);

        // Determine primary role (highest privilege)
        // Hierarchie: geschaeftsfuehrer > admin > buchhaltung > mitarbeiter
        if (roleList.includes('geschaeftsfuehrer')) {
          setRole('geschaeftsfuehrer');
        } else if (roleList.includes('admin')) {
          setRole('admin');
        } else if (roleList.includes('buchhaltung')) {
          setRole('buchhaltung');
        } else if (roleList.includes('mitarbeiter')) {
          setRole('mitarbeiter');
        } else {
          setRole(null);
        }

        // 3. If user has any role, get their mitarbeiter_id
        if (roleList.length > 0) {
          const { data: mitarbeiterData } = await supabase
            .from('mitarbeiter')
            .select('id')
            .eq('benutzer_id', user.id)
            .maybeSingle();

          if (mountedRef.current && mitarbeiterData) {
            setMitarbeiterId(mitarbeiterData.id);
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        if (mountedRef.current) {
          setRole(null);
          setRoles([]);
          setMitarbeiterId(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    fetchUserRole();
    
    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  // Helper functions for role checks
  // StandortSuperadmin (geschaeftsfuehrer): Voller Zugriff inkl. Löschen
  const isGeschaeftsfuehrer = role === 'geschaeftsfuehrer';
  
  // Disponent (admin) oder höher: Einsatzplanung, Kunden/Mitarbeiter lesen
  const isAdmin = role === 'geschaeftsfuehrer' || role === 'admin';
  
  // Disponent-spezifisch
  const isDisponent = role === 'admin';
  
  // Buchhaltung: Rechnungen lesen/verwalten
  const isBuchhaltung = roles.includes('buchhaltung');
  
  // Für Rückwärtskompatibilität
  const isManager = isAdmin;
  
  // Kann löschen: Nur StandortSuperadmin
  const canDelete = role === 'geschaeftsfuehrer';
  
  // Ist authentifizierter Mitarbeiter (hat irgendeine Rolle)
  const isEmployee = role !== null;
  
  const hasRole = (checkRole: UserRole) => roles.includes(checkRole);

  // Rollen-Label für UI
  const getRoleLabel = (r: UserRole): string => {
    switch (r) {
      case 'geschaeftsfuehrer': return 'StandortSuperadmin';
      case 'admin': return 'Disponent';
      case 'buchhaltung': return 'Buchhaltung';
      case 'mitarbeiter': return 'Mitarbeiter';
      default: return 'Unbekannt';
    }
  };

  // Rollen-Badge-Variante für UI
  const getRoleBadgeVariant = (r: UserRole): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (r) {
      case 'geschaeftsfuehrer': return 'destructive';
      case 'admin': return 'default';
      case 'buchhaltung': return 'outline';
      case 'mitarbeiter': return 'secondary';
      default: return 'outline';
    }
  };

  return { 
    role, 
    roles,
    loading, 
    mitarbeiterId,
    // Helper
    isGeschaeftsfuehrer,
    isAdmin,
    isDisponent,
    isBuchhaltung,
    isManager, // Rückwärtskompatibilität
    canDelete,
    isEmployee,
    hasRole,
    getRoleLabel,
    getRoleBadgeVariant
  };
}
