import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, Users } from 'lucide-react';

interface UnactivatedUser {
  user_id: string;
  user_email: string;
  created_at: string;
}

interface Mitarbeiter {
  email: string;
  vorname: string;
  nachname: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const [unactivatedUsers, setUnactivatedUsers] = useState<UnactivatedUser[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadUnactivatedUsers(), loadMitarbeiter()]);
    setLoading(false);
  };

  const loadUnactivatedUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_unactivated_users');
      
      if (error) throw error;
      
      setUnactivatedUsers(data || []);
    } catch (error: any) {
      console.error('Fehler beim Laden der nicht freigeschalteten User:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Laden der nicht freigeschalteten Benutzer: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const loadMitarbeiter = async () => {
    try {
      const { data, error } = await supabase
        .from('benutzer')
        .select('email, vorname, nachname, created_at')
        .eq('rolle', 'mitarbeiter')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setMitarbeiter(data || []);
    } catch (error: any) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Laden der Mitarbeiter: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const handleActivate = async (userId: string, email: string) => {
    setActivating(userId);
    
    try {
      const { error } = await supabase.rpc('freischalte_mitarbeiter', {
        p_user_id: userId,
        p_email: email,
      });
      
      if (error) throw error;
      
      toast({
        title: 'Erfolgreich',
        description: `${email} wurde als Mitarbeiter freigeschaltet.`,
      });
      
      await loadData();
    } catch (error: any) {
      console.error('Fehler beim Freischalten:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Freischalten: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mitarbeiterverwaltung</h1>
        <p className="text-muted-foreground">Verwalten Sie Benutzer und Mitarbeiter</p>
      </div>

      <Tabs defaultValue="unactivated" className="w-full">
        <TabsList>
          <TabsTrigger value="unactivated" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Nicht freigeschaltet ({unactivatedUsers.length})
          </TabsTrigger>
          <TabsTrigger value="mitarbeiter" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mitarbeiter ({mitarbeiter.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unactivated">
          <Card>
            <CardHeader>
              <CardTitle>Nicht freigeschaltete Benutzer</CardTitle>
              <CardDescription>
                Registrierte Benutzer, die noch nicht freigeschaltet wurden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unactivatedUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine nicht freigeschalteten Benutzer vorhanden
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Registriert am</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unactivatedUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.user_email}</TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('de-DE')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleActivate(user.user_id, user.user_email)}
                            disabled={activating === user.user_id}
                          >
                            {activating === user.user_id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Wird freigeschaltet...
                              </>
                            ) : (
                              'Als Mitarbeiter freischalten'
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mitarbeiter">
          <Card>
            <CardHeader>
              <CardTitle>Freigeschaltete Mitarbeiter</CardTitle>
              <CardDescription>
                Alle aktiven Mitarbeiter im System
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mitarbeiter.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine Mitarbeiter vorhanden
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Vorname</TableHead>
                      <TableHead>Nachname</TableHead>
                      <TableHead>Erstellt am</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mitarbeiter.map((m) => (
                      <TableRow key={m.email}>
                        <TableCell className="font-medium">{m.email}</TableCell>
                        <TableCell>{m.vorname || '-'}</TableCell>
                        <TableCell>{m.nachname || '-'}</TableCell>
                        <TableCell>
                          {new Date(m.created_at).toLocaleDateString('de-DE')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Aktiv</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
