import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, UserCheck, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimeWindow {
  wochentag: number;
  von: string;
  bis: string;
}

interface EmployeeSuggestion {
  mitarbeiter_id: string;
  match_score: number;
  reasoning: string;
  employee: {
    id: string;
    vorname: string;
    nachname: string;
    plz: string;
    zustaendigkeitsbereich: string;
  };
}

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface StepEmployeeMatchingProps {
  customerData: any;
  createdCustomerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function StepEmployeeMatching({ customerData, createdCustomerId, onClose, onSuccess }: StepEmployeeMatchingProps) {
  const [preferences, setPreferences] = useState('');
  const [frequency, setFrequency] = useState('');
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const calculateDuration = (von: string, bis: string): number => {
    const [vonH, vonM] = von.split(':').map(Number);
    const [bisH, bisM] = bis.split(':').map(Number);
    return (bisH * 60 + bisM) - (vonH * 60 + vonM);
  };

  const handleGenerateSuggestions = async () => {
    if (!frequency.trim()) { toast.error('Bitte Frequenz angeben'); return; }
    setSuggestionsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-employees', {
        body: { timeWindows: customerData.zeitfenster, plz: customerData.plz, preferences, frequency },
      });
      if (error) throw error;
      if (!data?.suggestions || data.suggestions.length === 0) { toast.error('Keine passenden Mitarbeiter gefunden'); return; }
      setSuggestions(data.suggestions);
      toast.success(`${data.suggestions.length} Mitarbeiter vorgeschlagen`);
    } catch (error: any) {
      console.error('Error suggesting employees:', error);
      toast.error('Fehler beim Vorschlagen von Mitarbeitern');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleConfirmEmployee = async () => {
    if (!selectedEmployee || !createdCustomerId) { toast.error('Bitte wählen Sie einen Mitarbeiter aus'); return; }
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.from('kunden').update({ mitarbeiter: selectedEmployee }).eq('id', createdCustomerId);
      if (updateError) throw updateError;

      for (const timeWindow of customerData.zeitfenster) {
        const today = new Date();
        const dayOfWeek = timeWindow.wochentag;
        const daysUntilNext = (dayOfWeek - today.getDay() + 7) % 7 || 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntilNext);

        const { error: vorlageError } = await supabase.from('termin_vorlagen').insert([{
          titel: `${customerData.vorname} ${customerData.nachname}`,
          kunden_id: createdCustomerId,
          mitarbeiter_id: selectedEmployee,
          wochentag: timeWindow.wochentag,
          start_zeit: timeWindow.von,
          dauer_minuten: calculateDuration(timeWindow.von, timeWindow.bis),
          intervall: 'weekly',
          ist_aktiv: true,
          gueltig_von: new Date().toISOString().split('T')[0],
        }]);
        if (vorlageError) console.error('Error creating template:', vorlageError);
      }

      toast.success('Regeltermin erfolgreich erstellt');
      onClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error confirming employee:', error);
      toast.error(error.message || 'Fehler beim Erstellen des Regeltermins');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipEmployeeMatching = () => {
    toast.success('Kunde erfolgreich angelegt');
    onClose();
    onSuccess();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />KI-Mitarbeiter Matching</CardTitle>
          <CardDescription>Lassen Sie die KI den besten Mitarbeiter für diesen Kunden finden</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-2">Zeitfenster:</p>
            <div className="space-y-1">
              {customerData.zeitfenster.map((tw: TimeWindow, idx: number) => (
                <p key={idx} className="text-sm text-muted-foreground">• {WEEKDAY_NAMES[tw.wochentag]}: {tw.von} - {tw.bis} Uhr</p>
              ))}
            </div>
          </div>
          {customerData.plz && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm"><span className="font-medium">PLZ:</span> {customerData.plz}</p>
            </div>
          )}
          <div><Label>Frequenz (z.B. "Jeden Montag", "Wöchentlich") *</Label><Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="z.B. Jeden Montag" className="mt-2" /></div>
          <div><Label>Mitarbeiter-Präferenzen (optional)</Label><Textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="z.B. 'Erfahrung mit Demenz', 'Männlicher Pfleger bevorzugt'" className="min-h-[80px] mt-2" /></div>
          <Button onClick={handleGenerateSuggestions} disabled={suggestionsLoading || !frequency.trim()} className="w-full">
            {suggestionsLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analysiere Mitarbeiter...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Mitarbeiter vorschlagen</>)}
          </Button>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Vorgeschlagene Mitarbeiter</CardTitle><CardDescription>Wählen Sie den besten Mitarbeiter für diesen Kunden</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion) => (
              <div key={suggestion.mitarbeiter_id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedEmployee === suggestion.mitarbeiter_id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                onClick={() => setSelectedEmployee(suggestion.mitarbeiter_id)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{suggestion.employee.vorname} {suggestion.employee.nachname}</p>
                    <p className="text-sm text-muted-foreground">PLZ: {suggestion.employee.plz || 'N/A'} • {suggestion.employee.zustaendigkeitsbereich || 'Kein Bereich'}</p>
                  </div>
                  <Badge className={`${getScoreColor(suggestion.match_score)} text-white`}>{suggestion.match_score}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                {selectedEmployee === suggestion.mitarbeiter_id && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-primary"><UserCheck className="h-4 w-4" />Ausgewählt</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2 border-t pt-4">
        <Button onClick={handleSkipEmployeeMatching} variant="outline">Überspringen</Button>
        <Button onClick={handleConfirmEmployee} disabled={!selectedEmployee || isLoading}>
          {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Erstelle Regeltermin...</>) : (<><CheckCircle className="h-4 w-4 mr-2" />Mitarbeiter zuordnen & Regeltermin erstellen</>)}
        </Button>
      </div>
    </div>
  );
}
