import * as React from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const { createContext, useContext, useEffect, useState } = React;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, vorname?: string, nachname?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  forcePasswordChange: boolean;
  initialPassword: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [initialPassword, setInitialPassword] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Detect PASSWORD_RECOVERY event — user clicked a recovery link
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logAuthEvent = async (operation: string, email?: string) => {
    try {
      await supabase.from('audit_log').insert({
        table_name: 'auth',
        operation,
        new_data: { email: email || null, timestamp: new Date().toISOString() } as any,
      });
    } catch (e) {
      console.warn('Audit log insert failed:', e);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      setInitialPassword(password);
      logAuthEvent('LOGIN', email);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, vorname?: string, nachname?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          vorname: vorname || '',
          nachname: nachname || '',
        }
      }
    });

    // Handle Supabase error for already registered user (422 error)
    if (error) {
      if (error.message?.includes('already registered') || 
          error.message?.includes('User already registered') ||
          (error as any).code === 'user_already_exists') {
        return { 
          error: { 
            message: 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an oder setzen Sie Ihr Passwort zurück.' 
          } 
        };
      }
      return { error };
    }

    // Check if user already exists (Supabase returns user with empty identities array)
    if (data?.user && data.user.identities?.length === 0) {
      return { 
        error: { 
          message: 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an oder setzen Sie Ihr Passwort zurück.' 
        } 
      };
    }

    return { error: null };
  };

  const signOut = async () => {
    const email = user?.email;
    try {
      await logAuthEvent('LOGOUT', email || undefined);
    } catch (_) {}
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut warning (ignored):', e);
    } finally {
      setSession(null);
      setUser(null);
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string) => {
    // Don't check benutzer table - RLS blocks unauthenticated reads.
    // Supabase handles non-existent emails gracefully (no error, no email sent).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?type=recovery`,
    });
    
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { force_password_change: false }
    });
    if (!error) {
      setRecoveryMode(false);
      setInitialPassword(null);
      logAuthEvent('PASSWORD_CHANGE', user?.email || undefined);
    }
    return { error };
  };

  // Show password change form if: metadata flag is set OR we're in recovery mode
  const forcePasswordChange = !!user?.user_metadata?.force_password_change || recoveryMode;

  const value = {
    user,
    session,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    forcePasswordChange,
    initialPassword,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}