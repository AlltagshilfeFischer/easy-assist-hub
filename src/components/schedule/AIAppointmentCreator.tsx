import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AIAppointmentSuggestionsDialog } from './AIAppointmentSuggestionsDialog';
import { parse } from 'date-fns';

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

  const loadCustomersAndEmployees = async () => {
    try {
      const [customersData, employeesData] = await Promise.all([
        supabase.from('kunden').select('id, name, vorname, nachname').eq('aktiv', true),
        supabase.from('mitarbeiter').select('id, vorname, nachname, benutzer:benutzer!inner(vorname, nachname)').eq('ist_aktiv', true)
      ]);

      if (customersData.error) throw customersData.error;
      if (employeesData.error) throw employeesData.error;

      const transformedCustomers = customersData.data?.map(c => ({
        id: c.id,
        name: c.vorname && c.nachname ? `${c.vorname} ${c.nachname}` : c.name || 'Unbekannt'
      })) || [];

      const transformedEmployees = employeesData.data?.map(e => {
        const benutzer = (e as any).benutzer;
        return {
          id: e.id,
          name: e.vorname && e.nachname 
            ? `${e.vorname} ${e.nachname}`
            : benutzer?.vorname && benutzer?.nachname
            ? `${benutzer.vorname} ${benutzer.nachname}`
            : 'Unbekannt'
        };
      }) || [];

      setCustomers(transformedCustomers);
      setEmployees(transformedEmployees);

      return { customers: transformedCustomers, employees: transformedEmployees };
    } catch (error) {
      console.error('Error loading data:', error);
      return { customers: [], employees: [] };
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
      const { customers: loadedCustomers, employees: loadedEmployees } = await loadCustomersAndEmployees();

      const { data, error } = await supabase.functions.invoke('parse-appointment-text', {
        body: { 
          text: prompt,
          customers: loadedCustomers,
          employees: loadedEmployees
        }
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
          description: 'Bitte füge Lovable AI Guthaben hinzu.',
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

      setPrompt('');
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
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">AI Terminassistent</h3>
          </div>
          
          <Textarea
            placeholder="Beschreibe die Termine in natürlicher Sprache... z.B. 'Erstelle morgen um 14 Uhr einen Termin für Frau Müller mit Mitarbeiter Schmidt für 90 Minuten' oder 'Nächste Woche Montag bis Freitag jeweils um 10 Uhr Termin bei Herr Weber'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[80px] bg-white"
            disabled={isLoading}
          />
          
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="self-end"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysiere...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Vorschläge generieren
              </>
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
