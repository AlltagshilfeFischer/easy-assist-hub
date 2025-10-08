import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function PendingApproval() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-warning" />
          </div>
          <CardTitle className="text-2xl">Dein Konto wartet auf Freischaltung</CardTitle>
          <CardDescription className="text-base mt-2">
            Vielen Dank für deine Registrierung. Ein Administrator muss dein Konto noch freischalten, bevor du Zugriff erhältst.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Du erhältst eine E-Mail, sobald dein Konto freigeschaltet wurde. Bitte habe etwas Geduld.
            </p>
          </div>
          <Button 
            onClick={() => signOut()} 
            variant="outline" 
            className="w-full"
          >
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
