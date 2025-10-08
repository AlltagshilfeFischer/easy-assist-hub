import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RegistrationRequestForm } from './RegistrationRequestForm';
import { PasswordResetForm } from './PasswordResetForm';

export default function AuthPage() {
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, signUp, resetPassword, user } = useAuth();
  const { toast } = useToast();

  // Redirect if already authenticated
  if (user) {
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Anmelden</TabsTrigger>
              <TabsTrigger value="register">Registrieren</TabsTrigger>
              <TabsTrigger value="reset">Passwort zurücksetzen</TabsTrigger>
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
              </TabsContent>

              <TabsContent value="register" className="space-y-4 mt-4">
                <RegistrationRequestForm />
              </TabsContent>
              
              <TabsContent value="reset" className="space-y-4 mt-4">
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
                  <Button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-primary hover:bg-primary-hover"
                  >
                    {resetLoading ? 'Wird versendet...' : 'Passwort zurücksetzen'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}