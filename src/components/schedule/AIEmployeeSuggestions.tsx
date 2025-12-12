import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, UserCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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

interface AIEmployeeSuggestionsProps {
  timeWindows: TimeWindow[];
  customerPlz?: string;
  onConfirm: (mitarbeiterId: string, frequency: string) => void;
  onBack: () => void;
  onCancel: () => void;
}

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export default function AIEmployeeSuggestions({ 
  timeWindows, 
  customerPlz, 
  onConfirm, 
  onBack,
  onCancel 
}: AIEmployeeSuggestionsProps) {
  const [preferences, setPreferences] = useState('');
  const [frequency, setFrequency] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-employees', {
        body: {
          timeWindows,
          plz: customerPlz,
          preferences,
          frequency
        }
      });

      if (error) throw error;

      if (!data?.suggestions || data.suggestions.length === 0) {
        toast.error('Keine passenden Mitarbeiter gefunden');
        return;
      }

      setSuggestions(data.suggestions);
      toast.success(`${data.suggestions.length} Mitarbeiter vorgeschlagen`);
    } catch (error: any) {
      console.error('Error suggesting employees:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error('Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
      } else if (error.message?.includes('credits')) {
        toast.error('Nicht genügend Credits. Bitte fügen Sie Credits hinzu.');
      } else {
        toast.error('Fehler beim Vorschlagen von Mitarbeitern');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedEmployee) {
      toast.error('Bitte wählen Sie einen Mitarbeiter aus');
      return;
    }
    if (!frequency.trim()) {
      toast.error('Bitte geben Sie die Frequenz an');
      return;
    }
    onConfirm(selectedEmployee, frequency);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            KI-Mitarbeiter Matching
          </CardTitle>
          <CardDescription>
            Lassen Sie die KI den besten Mitarbeiter für diesen Kunden finden
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-2">Zeitfenster:</p>
            <div className="space-y-1">
              {timeWindows.map((tw, idx) => (
                <p key={idx} className="text-sm text-muted-foreground">
                  • {WEEKDAY_NAMES[tw.wochentag]}: {tw.von} - {tw.bis} Uhr
                </p>
              ))}
            </div>
          </div>

          {customerPlz && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">PLZ:</span> {customerPlz}
              </p>
            </div>
          )}

          <div>
            <Label>Frequenz (z.B. "Jeden Montag", "Wöchentlich")</Label>
            <Input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="z.B. Jeden Montag"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Mitarbeiter-Präferenzen (optional)</Label>
            <Textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="z.B. 'Erfahrung mit Demenz', 'Männlicher Pfleger bevorzugt'"
              className="min-h-[80px] mt-2"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !frequency.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analysiere Mitarbeiter...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Mitarbeiter vorschlagen
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vorgeschlagene Mitarbeiter</CardTitle>
            <CardDescription>Wählen Sie den besten Mitarbeiter für diesen Kunden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.mitarbeiter_id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedEmployee === suggestion.mitarbeiter_id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedEmployee(suggestion.mitarbeiter_id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">
                      {suggestion.employee.vorname} {suggestion.employee.nachname}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PLZ: {suggestion.employee.plz || 'N/A'} • {suggestion.employee.zustaendigkeitsbereich || 'Kein Bereich'}
                    </p>
                  </div>
                  <Badge className={`${getScoreColor(suggestion.match_score)} text-white`}>
                    {suggestion.match_score}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                {selectedEmployee === suggestion.mitarbeiter_id && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                    <UserCheck className="h-4 w-4" />
                    Ausgewählt
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedEmployee} className="flex-1">
                Regeltermin erstellen
              </Button>
              <Button onClick={onCancel} variant="outline">
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
