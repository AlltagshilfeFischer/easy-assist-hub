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
        // Fetch roles from secure user_roles table
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

        // 3. Mitarbeiter-ID laden für Rollen die Einsätze haben können
        // Admin/Disponent ist KEIN Mitarbeiter (kein Einsatz im Dienstplan)
        // Geschäftsführer und Mitarbeiter können Einsätze haben
        if (roleList.includes('geschaeftsfuehrer') || roleList.includes('mitarbeiter')) {
          const { data: mitarbeiterData } = await supabase
            .from('mitarbeiter')
            .select('id')
            .eq('benutzer_id', user.id)
            .maybeSingle();

          if (mountedRef.current && mitarbeiterData) {
            setMitarbeiterId(mitarbeiterData.id);
          }
        } else {
          if (mountedRef.current) setMitarbeiterId(null);
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
  // Admin (geschaeftsfuehrer): Voller Zugriff inkl. Löschen - feste Rolle
  const isGeschaeftsfuehrer = role === 'geschaeftsfuehrer';
  
  // Manager (admin) oder höher: Einsatzplanung, Kunden/Mitarbeiter lesen
  const isAdmin = role === 'geschaeftsfuehrer' || role === 'admin';
  
  // Manager-spezifisch
  const isDisponent = role === 'admin';
  
  // Buchhaltung: Rechnungen lesen/verwalten
  const isBuchhaltung = roles.includes('buchhaltung');
  
  // Für Rückwärtskompatibilität
  const isManager = isAdmin;
  
  // Kann löschen: Nur Admin (geschaeftsfuehrer)
  const canDelete = role === 'geschaeftsfuehrer';
  
  // Ist Mitarbeiter im Sinne von Einsätzen (GF oder mitarbeiter, NICHT Manager)
  const isEmployee = role === 'mitarbeiter' || role === 'geschaeftsfuehrer';
  
  // Hat Zugriff auf das System (irgendeine Rolle)
  const isAuthenticated = role !== null;
  
  const hasRole = (checkRole: UserRole) => roles.includes(checkRole);

  // Rollen-Label für UI
  const getRoleLabel = (r: UserRole): string => {
    switch (r) {
      case 'geschaeftsfuehrer': return 'Admin';
      case 'admin': return 'Manager';
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
    isAuthenticated,
    hasRole,
    getRoleLabel,
    getRoleBadgeVariant
  };
}
