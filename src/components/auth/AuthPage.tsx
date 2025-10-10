import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RegistrationRequestForm } from './RegistrationRequestForm';
import { PasswordResetForm } from './PasswordResetForm';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const { signIn, signUp, resetPassword, user } = useAuth();
  const { toast } = useToast();
  
  // Check if this is an invitation link
  const hashString = typeof window !== 'undefined' ? (window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : window.location.hash) : '';
  const hashParams = new URLSearchParams(hashString || '');
  const isInvite = ['invite','signup'].includes(searchParams.get('type') || '') || ['invite','signup'].includes(hashParams.get('type') || '');
  const isRecovery = searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';

  // Redirect if already authenticated (but allow invite/recovery to show password setup)
  if (user && !(isInvite || isRecovery)) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Anmeldung fehlgeschlagen',
        description: error.message === 'Invalid login credentials' 
          ? 'Ungültige E-Mail oder Passwort'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Erfolgreich angemeldet',
        description: 'Willkommen zurück!',
      });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast({
        title: 'Registrierung fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Registrierung erfolgreich',
        description: 'Sie können sich nun anmelden.',
      });
      setEmail('');
      setPassword('');
    }

    setSignUpLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    const { error } = await resetPassword(resetEmail);

    if (error) {
      toast({
        title: 'Fehler beim Zurücksetzen des Passworts',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'E-Mail versendet',
        description: 'Falls Ihre E-Mail-Adresse registriert ist, erhalten Sie einen Link zum Zurücksetzen des Passworts.',
      });
      setResetEmail('');
    }

    setResetLoading(false);
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwörter stimmen nicht überein',
        description: 'Bitte stellen Sie sicher, dass beide Passwörter identisch sind.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Passwort zu kurz',
        description: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
        variant: 'destructive',
      });
      return;
    }

    setSetupLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast({
        title: 'Fehler beim Setzen des Passworts',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Passwort erfolgreich gesetzt',
        description: 'Sie werden jetzt angemeldet...',
      });
      // User wird automatisch eingeloggt
    }

    setSetupLoading(false);
  };


  // Show password setup form if this is an invite or recovery link
  if (isInvite || isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-4">
              <img src="/lovable-uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" alt="Alltagshilfe Fischer Logo" className="w-12 h-12" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Alltagshilfe Fischer</h1>
            <p className="text-muted-foreground">Controlboard</p>
          </div>

          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <CardTitle>{isInvite ? 'Passwort einrichten' : 'Neues Passwort setzen'}</CardTitle>
              <CardDescription>
                {isInvite ? 'Willkommen! Bitte richten Sie Ihr Passwort ein.' : 'Bitte setzen Sie ein neues Passwort.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetupPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Mindestens 6 Zeichen"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={setupLoading}
                  className="w-full bg-primary hover:bg-primary-hover"
                >
                  {setupLoading ? 'Wird gespeichert...' : 'Passwort speichern'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-4">
            <img src="/lovable-uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" alt="Alltagshilfe Fischer Logo" className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Alltagshilfe Fischer</h1>
          <p className="text-muted-foreground">Controlboard</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Anmeldung</CardTitle>
            <CardDescription>
              Melden Sie sich an oder setzen Sie Ihr Passwort zurück
            </CardDescription>
          </CardHeader>
          <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Anmelden</TabsTrigger>
              <TabsTrigger value="register">Registrieren</TabsTrigger>
            </TabsList>
              
              <TabsContent value="signin" className="space-y-4 mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre.email@beispiel.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-hover"
                  >
                    {loading ? 'Wird angemeldet...' : 'Anmelden'}
                  </Button>
                </form>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Passwort vergessen?
                  </button>
                </div>
                {showPasswordReset && (
                  <div className="space-y-4 pt-4 border-t">
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="resetEmail">E-Mail-Adresse</Label>
                        <Input
                          id="resetEmail"
                          type="email"
                          placeholder="ihre.email@beispiel.de"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                          className="w-full"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Geben Sie Ihre registrierte E-Mail-Adresse ein, um einen Link zum Zurücksetzen des Passworts zu erhalten.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPasswordReset(false)}
                          className="flex-1"
                        >
                          Abbrechen
                        </Button>
                        <Button
                          type="submit"
                          disabled={resetLoading}
                          className="flex-1 bg-primary hover:bg-primary-hover"
                        >
                          {resetLoading ? 'Wird versendet...' : 'Senden'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="register" className="space-y-4 mt-4">
                <RegistrationRequestForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}