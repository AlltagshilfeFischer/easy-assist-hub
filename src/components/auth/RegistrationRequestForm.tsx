import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function RegistrationRequestForm() {
  const [email, setEmail] = useState('');
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Insert into pending_registrations table
      const { error } = await supabase
        .from('pending_registrations')
        .insert([{ email, vorname, nachname }]);

      if (error) {
        if (error.code === '23505') {
          toast({
            variant: 'destructive',
            title: 'Fehler',
            description: 'Diese E-Mail-Adresse wurde bereits registriert.',
          });
        } else {
          throw error;
        }
        return;
      }

      setSubmitted(true);
      toast({
        title: 'Anfrage gesendet',
        description: 'Vielen Dank für deine Registrierung – ein Admin prüft deine Daten.',
      });
      setEmail('');
      setVorname('');
      setNachname('');
    } catch (error: any) {
      console.error('Registration request error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-xl font-semibold">Anfrage eingereicht</h3>
        <p className="text-muted-foreground">
          Ihre Registrierungsanfrage wurde erfolgreich eingereicht.
          Sie erhalten eine E-Mail, sobald ein Administrator Ihre Anfrage genehmigt hat.
        </p>
        <Button
          variant="outline"
          onClick={() => setSubmitted(false)}
          className="w-full"
        >
          Weitere Anfrage stellen
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vorname">Vorname</Label>
        <Input
          id="vorname"
          type="text"
          placeholder="Max"
          value={vorname}
          onChange={(e) => setVorname(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nachname">Nachname</Label>
        <Input
          id="nachname"
          type="text"
          placeholder="Mustermann"
          value={nachname}
          onChange={(e) => setNachname(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          type="email"
          placeholder="ihre.email@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !email || !vorname || !nachname}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Registrierungsanfrage stellen
      </Button>
      <p className="text-sm text-muted-foreground text-center">
        Nach Genehmigung durch einen Administrator erhalten Sie Ihre Zugangsdaten per E-Mail.
      </p>
    </form>
  );
}