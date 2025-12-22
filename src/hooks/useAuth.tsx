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
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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

    // Check if user already exists (Supabase returns user with empty identities array)
    if (!error && data?.user && data.user.identities?.length === 0) {
      return { 
        error: { 
          message: 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an oder setzen Sie Ihr Passwort zurück.' 
        } 
      };
    }

    // If signup succeeded, update pending_registrations with the names
    if (!error && data?.user) {
      await supabase
        .from('pending_registrations')
        .upsert({
          email: email,
          vorname: vorname || null,
          nachname: nachname || null,
          status: 'pending'
        }, { onConflict: 'email' });
    }

    return { error };
  };

  const signOut = async () => {
    // Robust logout: redirect regardless of server response (handles 403 session_not_found)
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
    // First check if user exists in benutzer table
    const { data: existingUser } = await supabase
      .from('benutzer')
      .select('email')
      .eq('email', email)
      .single();
    
    if (!existingUser) {
      return { error: { message: 'Diese E-Mail-Adresse ist nicht registriert.' } };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?type=recovery`,
    });
    
    return { error };
  };

  const value = {
    user,
    session,
    signIn,
    signUp,
    signOut,
    resetPassword,
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