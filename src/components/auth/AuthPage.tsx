import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

// Platzhalter-URL für die Landing Page - später durch echte URL ersetzen
const LANDING_PAGE_URL = 'https://alltagshilfe-fischer.de';

const AuthPage = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      let errorMessage = error.message;
      
      // Benutzerfreundliche Fehlermeldungen auf Deutsch
      if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Prüfen Sie Ihren Posteingang und klicken Sie auf den Bestätigungslink.';
      } else if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'E-Mail oder Passwort ist falsch.';
      }
      
      toast({
        title: "Fehler beim Anmelden",
        description: errorMessage,
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Passwörter stimmen nicht überein",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await signUp(email, password, vorname, nachname);
    
    if (error) {
      let errorMessage = error.message;
      
      if (error.message.includes('User already registered')) {
        errorMessage = 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an.';
      }
      
      toast({
        title: "Fehler bei der Registrierung",
        description: errorMessage,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registrierung erfolgreich",
        description: "Prüfen Sie Ihren Posteingang und bestätigen Sie Ihre E-Mail-Adresse. Danach muss ein Administrator Ihr Konto freischalten.",
        duration: 8000,
      });
      setActiveTab('login');
      setPassword('');
      setConfirmPassword('');
      setVorname('');
      setNachname('');
    }
    
    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await resetPassword(email);
    
    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "E-Mail versendet",
        description: "Prüfen Sie Ihren Posteingang für den Passwort-Reset-Link.",
      });
      setShowPasswordReset(false);
      setActiveTab('login');
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <a 
            href={LANDING_PAGE_URL}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Website
          </a>
          <div className="flex items-center gap-3 mb-2">
            <img 
              src="/lovable-uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" 
              alt="Alltagshilfe Fischer Logo" 
              className="h-10 w-10 object-contain"
            />
            <CardTitle>Alltagshilfe Fischer Portal</CardTitle>
          </div>
          <CardDescription>
            Melden Sie sich an oder registrieren Sie sich
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showPasswordReset ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Passwort zurücksetzen</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowPasswordReset(false)}
                >
                  Zurück
                </Button>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-Mail</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="ihre@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Wird gesendet..." : "Passwort zurücksetzen"}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Sie erhalten eine E-Mail mit einem Link zum Zurücksetzen Ihres Passworts.
                </p>
              </form>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Anmelden</TabsTrigger>
                <TabsTrigger value="register">Registrieren</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@email.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
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
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Wird angemeldet..." : "Anmelden"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(true)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
                  >
                    Passwort vergessen?
                  </button>
                </form>
              </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-vorname">Vorname</Label>
                  <Input
                    id="reg-vorname"
                    type="text"
                    placeholder="Max"
                    value={vorname}
                    onChange={(e) => setVorname(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-nachname">Nachname</Label>
                  <Input
                    id="reg-nachname"
                    type="text"
                    placeholder="Mustermann"
                    value={nachname}
                    onChange={(e) => setNachname(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-Mail</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="ihre@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Passwort</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">Passwort bestätigen</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Wird registriert..." : "Registrieren"}
                </Button>
              </form>
            </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
