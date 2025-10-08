import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

export function PasswordResetForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: 'E-Mail gesendet',
        description: 'Überprüfe dein Postfach für den Passwort-Reset-Link.',
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Passwort-Reset fehlgeschlagen.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-xl font-semibold">E-Mail versendet</h3>
        <p className="text-muted-foreground">
          Wir haben dir einen Link zum Zurücksetzen deines Passworts an <strong>{email}</strong> gesendet.
          Überprüfe dein Postfach und folge den Anweisungen.
        </p>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zum Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">E-Mail-Adresse</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="deine.email@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !email}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Passwort zurücksetzen
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="w-full"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zum Login
      </Button>
      <p className="text-sm text-muted-foreground text-center">
        Du erhältst eine E-Mail mit einem Link zum Zurücksetzen deines Passworts.
      </p>
    </form>
  );
}
