import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { LeistungsnachweisSignature } from '@/components/mitarbeiter/LeistungsnachweisSignature';

const MitarbeiterStart = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Willkommen, Mitarbeiter</h1>
        <p className="text-muted-foreground">Ihr persönliches Dashboard</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ihr Bereich</CardTitle>
          <CardDescription>
            Angemeldet als: {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Dieser Bereich wird in Kürze mit weiteren Funktionen erweitert.
          </p>
        </CardContent>
      </Card>

      {/* Leistungsnachweise Unterschrift-Bereich */}
      <LeistungsnachweisSignature />
    </div>
  );
};

export default MitarbeiterStart;
