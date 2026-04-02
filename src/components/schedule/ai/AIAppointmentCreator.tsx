import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invokeAiFunction } from '@/lib/aiClient';
import { AIAppointmentSuggestionsDialog } from './AIAppointmentSuggestionsDialog';
import { parse, startOfWeek, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface AIAppointmentCreatorProps {
  onAppointmentCreated: () => void;
}

export function AIAppointmentCreator({ onAppointmentCreated }: AIAppointmentCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadContextData = async () => {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1); // Montag
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 13); // 2 Wochen voraus
      weekEnd.setHours(23, 59, 59, 999);

      const [customersData, employeesData, verfuegbarkeitenData, termineData] = await Promise.all([
        supabase.from('kunden').select('id, name, vorname, nachname').eq('aktiv', true),
        supabase.from('mitarbeiter').select('id, vorname, nachname, benutzer:benutzer!inner(vorname, nachname)').eq('ist_aktiv', true),
        supabase.from('mitarbeiter_verfuegbarkeit').select('mitarbeiter_id, wochentag, von, bis'),
        supabase.from('termine').select('id, mitarbeiter_id, start_at, end_at, status')
          .gte('start_at', weekStart.toISOString())
          .lte('start_at', weekEnd.toISOString())
          .not('status', 'in', '("cancelled","abgesagt_rechtzeitig")')
      ]);

      if (customersData.error) throw customersData.error;
      if (employeesData.error) throw employeesData.error;

      const transformedCustomers = customersData.data?.map(c => ({
        id: c.id,
        vorname: c.vorname,
        nachname: c.nachname,
        name: c.vorname && c.nachname ? `${c.vorname} ${c.nachname}` : c.name || 'Unbekannt'
      })) || [];

      const transformedEmployees = employeesData.data?.map((e: any) => {
        const benutzer = e.benutzer;
        return {
          id: e.id,
          name: e.vorname && e.nachname
            ? `${e.vorname} ${e.nachname}`
            : benutzer?.vorname && benutzer?.nachname
            ? `${benutzer.vorname} ${benutzer.nachname}`
            : 'Unbekannt'
        };
      }) || [];

      // Verfügbarkeiten pro MA gruppieren
      const verfuegbarkeiten = (verfuegbarkeitenData.data || []).reduce((acc: Record<string, { wochentag: number; von: string; bis: string }[]>, v) => {
        if (!acc[v.mitarbeiter_id]) acc[v.mitarbeiter_id] = [];
        acc[v.mitarbeiter_id].push({ wochentag: v.wochentag, von: v.von, bis: v.bis });
        return acc;
      }, {});

      // Bestehende Termine kompakt
      const bestehendeTermine = (termineData.data || []).map(t => ({
        mitarbeiter_id: t.mitarbeiter_id,
        start: t.start_at,
        end: t.end_at,
      }));

      setCustomers(transformedCustomers);
      setEmployees(transformedEmployees);

      return { customers: transformedCustomers, employees: transformedEmployees, verfuegbarkeiten, bestehendeTermine };
    } catch (error) {
      console.error('Error loading data:', error);
      return { customers: [], employees: [], verfuegbarkeiten: {}, bestehendeTermine: [] };
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Eingabe erforderlich',
        description: 'Bitte beschreibe die Termine, die erstellt werden sollen.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { customers: loadedCustomers, employees: loadedEmployees, verfuegbarkeiten, bestehendeTermine } = await loadContextData();

      const { data, error } = await invokeAiFunction('parse-appointment-text', {
        text: prompt,
        customers: loadedCustomers,
        employees: loadedEmployees,
        verfuegbarkeiten,
        bestehendeTermine,
      });

      if (error) throw error;

      if (!data?.termine || data.termine.length === 0) {
        toast({
          title: 'Keine Termine gefunden',
          description: 'Die AI konnte keine Termine aus dem Text extrahieren.',
          variant: 'destructive'
        });
        return;
      }

      setSuggestions(data.termine);
      setShowSuggestions(true);
      
    } catch (error: any) {
      console.error('Error generating appointments:', error);
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        toast({
          title: 'Rate Limit erreicht',
          description: 'Zu viele Anfragen. Bitte versuche es später erneut.',
          variant: 'destructive'
        });
      } else if (error.message?.includes('Payment') || error.message?.includes('402')) {
        toast({
          title: 'Guthaben aufgebraucht',
          description: 'Bitte kontaktiere den Administrator.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Fehler',
          description: 'Fehler beim Generieren der Termine: ' + (error.message || 'Unbekannter Fehler'),
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSuggestions = async (selectedSuggestions: any[]) => {
    try {
      const appointments = selectedSuggestions.map(suggestion => {
        const [hours, minutes] = suggestion.startzeit.split(':').map(Number);
        const startDate = parse(suggestion.datum, 'yyyy-MM-dd', new Date());
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + suggestion.dauer_minuten);

        return {
          titel: `Termin mit ${customers.find(c => c.id === suggestion.kunde_id)?.name || 'Kunde'}`,
          kunden_id: suggestion.kunde_id,
          mitarbeiter_id: suggestion.mitarbeiter_id,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          status: (suggestion.mitarbeiter_id ? 'scheduled' : 'unassigned') as 'scheduled' | 'unassigned',
          notizen: suggestion.notizen
        };
      });

      const { error } = await supabase
        .from('termine')
        .insert(appointments);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: `${appointments.length} Termin(e) wurde(n) erstellt.`
      });

      // Navigate to the first appointment's week
      if (appointments.length > 0) {
        const firstAppointment = appointments[0];
        const appointmentDate = new Date(firstAppointment.start_at);
        const weekStart = startOfWeek(appointmentDate, { weekStartsOn: 1 }); // Monday
        const weekParam = format(weekStart, 'yyyy-MM-dd');
        navigate(`/dashboard/controlboard/schedule-builder?week=${weekParam}`);
      }

      setPrompt('');
      setShowSuggestions(false);
      onAppointmentCreated();
    } catch (error) {
      console.error('Error creating appointments:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Erstellen der Termine.',
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <Card className="p-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <Textarea
            placeholder="z.B. 'Jeden Mo um 12 Uhr mit Frau Klemme'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[32px] h-8 bg-white text-xs resize-none flex-1"
            disabled={isLoading}
            rows={1}
          />
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            size="sm"
            className="h-8 text-xs flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
          </Button>
        </div>
      </Card>

      <AIAppointmentSuggestionsDialog
        open={showSuggestions}
        onOpenChange={setShowSuggestions}
        suggestions={suggestions}
        customers={customers}
        employees={employees}
        onConfirm={handleConfirmSuggestions}
      />
    </>
  );
}
