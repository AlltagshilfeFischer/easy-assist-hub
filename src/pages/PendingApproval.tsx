import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, XCircle } from 'lucide-react';

export default function PendingApproval() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    async function checkApprovalStatus() {
      if (!user) {
        navigate('/');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('pending_registrations')
          .select('status, rejection_reason')
          .eq('email', user.email)
          .maybeSingle();

        if (error) {
          console.error('Error checking approval status:', error);
        }

        if (data) {
          setStatus(data.status as 'pending' | 'approved' | 'rejected');
          setRejectionReason(data.rejection_reason);

          if (data.status === 'approved') {
            navigate('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    checkApprovalStatus();

    const channel = supabase
      .channel('pending-approval-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_registrations',
          filter: `email=eq.${user?.email}`,
        },
        (payload) => {
          const newStatus = payload.new.status as 'pending' | 'approved' | 'rejected';
          setStatus(newStatus);
          setRejectionReason(payload.new.rejection_reason);
          
          if (newStatus === 'approved') {
            window.location.reload();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === 'pending' ? (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Dein Konto wartet auf Freischaltung</CardTitle>
              <CardDescription>
                Vielen Dank für deine Registrierung. Ein Administrator prüft derzeit deine Daten.
                Du wirst per E-Mail benachrichtigt, sobald dein Konto freigeschaltet wurde.
              </CardDescription>
            </>
          ) : status === 'rejected' ? (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Registrierung abgelehnt</CardTitle>
              <CardDescription>
                Deine Registrierung wurde leider abgelehnt.
                {rejectionReason && (
                  <span className="block mt-2 font-medium text-foreground">
                    Grund: {rejectionReason}
                  </span>
                )}
              </CardDescription>
            </>
          ) : null}
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
