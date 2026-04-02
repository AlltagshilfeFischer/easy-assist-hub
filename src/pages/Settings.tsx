import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/hooks/useSettings';
import { Settings as SettingsIcon, Sparkles, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [isValidating, setIsValidating] = useState(false);

  const handleAiToggle = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ aiModeEnabled: false });
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-ai-config');
      if (error) throw error;

      const result = data as { valid: boolean; error?: string };
      if (result.valid) {
        updateSettings({ aiModeEnabled: true });
        toast.success('KI-Modus aktiviert');
      } else {
        toast.error('KI nicht verfügbar', {
          description: result.error ?? 'API-Key nicht konfiguriert. Bitte den OPENAI_API_KEY in den Supabase Edge Function Secrets hinterlegen.',
        });
      }
    } catch {
      toast.error('Verbindungsfehler beim Prüfen des API-Keys');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Passe die Anwendung an deine Bedürfnisse an</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Benutzeroberfläche
          </CardTitle>
          <CardDescription>
            Einstellungen für die Darstellung der Anwendung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sidebar-auto-collapse">Sidebar im Dienstplan einklappen</Label>
              <p className="text-sm text-muted-foreground">
                Die Sidebar wird automatisch eingeklappt, wenn du den Dienstplan öffnest
              </p>
            </div>
            <Switch
              id="sidebar-auto-collapse"
              checked={settings.sidebarAutoCollapseOnSchedule}
              onCheckedChange={(checked) => updateSettings({ sidebarAutoCollapseOnSchedule: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            KI-Assistent
          </CardTitle>
          <CardDescription>
            Aktiviere die KI-Funktionalitäten der Anwendung. Beim Aktivieren wird der API-Key automatisch geprüft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-mode" className="flex items-center gap-2">
                KI-Modus aktivieren
                {isValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {!isValidating && settings.aiModeEnabled && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                )}
                {!isValidating && !settings.aiModeEnabled && (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
              </Label>
              <p className="text-sm text-muted-foreground">
                {settings.aiModeEnabled
                  ? 'KI-Features sind aktiv — Chat-Assistent, Smart-Import, Zeitfenster-KI und Mitarbeiter-Matching'
                  : 'KI-Features sind deaktiviert und werden in der Oberfläche ausgeblendet'}
              </p>
            </div>
            <Switch
              id="ai-mode"
              checked={settings.aiModeEnabled}
              disabled={isValidating}
              onCheckedChange={handleAiToggle}
            />
          </div>

          {settings.aiModeEnabled && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-300">
              <p className="font-medium">Aktive KI-Funktionen:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-green-700 dark:text-green-400">
                <li>KI-Assistent im Dashboard</li>
                <li>KI-Import bei Kunden &amp; Mitarbeitern</li>
                <li>KI-Zeitfenster-Konfiguration</li>
                <li>KI-Mitarbeiter-Matching</li>
                <li>KI-Terminvorschläge im Dienstplan</li>
              </ul>
            </div>
          )}

          {!settings.aiModeEnabled && (
            <p className="text-xs text-muted-foreground">
              Voraussetzung: <code className="rounded bg-muted px-1 py-0.5 font-mono">OPENAI_API_KEY</code> muss in den Supabase Edge Function Secrets konfiguriert sein.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
