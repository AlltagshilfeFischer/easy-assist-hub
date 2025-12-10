import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimeWindow {
  wochentag: number;
  von: string;
  bis: string;
  prioritaet?: number;
}

interface AITimeWindowsCreatorProps {
  onConfirm: (windows: TimeWindow[]) => void;
  onCancel: () => void;
}

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export default function AITimeWindowsCreator({ onConfirm, onCancel }: AITimeWindowsCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TimeWindow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TimeWindow | null>(null);

  const exampleSnippets = [
    'Montag und Mittwoch Schicht 1',
    'Jeden Dienstag von 14 bis 16 Uhr',
    'Mo, Mi, Fr vormittags zwischen 9 und 11'
  ];

  const addSnippet = (snippet: string) => {
    setPrompt(prev => prev ? `${prev}\n${snippet}` : snippet);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Bitte geben Sie eine Beschreibung ein');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-time-windows', {
        body: { text: prompt }
      });

      if (error) throw error;

      if (!data?.windows || data.windows.length === 0) {
        toast.error('Keine Zeitfenster gefunden. Bitte versuchen Sie es mit einer anderen Beschreibung.');
        return;
      }

      setSuggestions(data.windows);
      toast.success(`${data.windows.length} Zeitfenster generiert`);
    } catch (error: any) {
      console.error('Error generating time windows:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error('Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
      } else if (error.message?.includes('credits')) {
        toast.error('Nicht genügend Credits. Bitte fügen Sie Credits hinzu.');
      } else {
        toast.error('Fehler beim Generieren der Zeitfenster');
      }
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...suggestions[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editForm) {
      const updated = [...suggestions];
      updated[editingIndex] = editForm;
      setSuggestions(updated);
      setEditingIndex(null);
      setEditForm(null);
      toast.success('Zeitfenster aktualisiert');
    }
  };

  const removeWindow = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
    toast.success('Zeitfenster entfernt');
  };

  const handleConfirm = () => {
    if (suggestions.length === 0) {
      toast.error('Bitte generieren Sie zuerst Zeitfenster');
      return;
    }
    onConfirm(suggestions);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            KI-Zeitfenster Generator
          </CardTitle>
          <CardDescription>
            Beschreiben Sie in natürlicher Sprache, wann der Kunde Termine benötigt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Zeitfenster-Beschreibung</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="z.B. 'Montag und Mittwoch Schicht 1' oder 'Jeden Dienstag von 14 bis 16 Uhr'"
              className="min-h-[100px] mt-2"
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {exampleSnippets.map((snippet, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => addSnippet(snippet)}
                disabled={loading}
              >
                <Plus className="h-3 w-3 mr-1" />
                {snippet}
              </Button>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generiere Zeitfenster...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Zeitfenster generieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generierte Zeitfenster ({suggestions.length})</CardTitle>
            <CardDescription>Überprüfen und bearbeiten Sie die Zeitfenster</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((window, index) => (
              <div key={index} className="border rounded-lg p-3">
                {editingIndex === index ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Wochentag</Label>
                        <Input
                          type="number"
                          min="0"
                          max="6"
                          value={editForm?.wochentag}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, wochentag: parseInt(e.target.value) } : null)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {WEEKDAY_NAMES[editForm?.wochentag || 0]}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs">Priorität</Label>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={editForm?.prioritaet || 3}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, prioritaet: parseInt(e.target.value) } : null)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Von</Label>
                        <Input
                          type="time"
                          value={editForm?.von}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, von: e.target.value } : null)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Bis</Label>
                        <Input
                          type="time"
                          value={editForm?.bis}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, bis: e.target.value } : null)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} variant="default">
                        <Check className="h-4 w-4 mr-1" />
                        Speichern
                      </Button>
                      <Button size="sm" onClick={cancelEdit} variant="outline">
                        <X className="h-4 w-4 mr-1" />
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {WEEKDAY_NAMES[window.wochentag]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {window.von} - {window.bis} Uhr • Priorität: {window.prioritaet || 3}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(index)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeWindow(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleConfirm} className="flex-1">
                Weiter zu Mitarbeiter-Vorschlägen
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
