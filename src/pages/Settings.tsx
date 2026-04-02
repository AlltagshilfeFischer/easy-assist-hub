import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import {
  Settings as SettingsIcon,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { invokeAiFunction } from '@/lib/aiClient';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [isValidating, setIsValidating] = useState(false);
  const [keyInput, setKeyInput] = useState(settings.openAiApiKey);
  const [showKey, setShowKey] = useState(false);

  const validateAndSave = async (keyToTest: string) => {
    if (!keyToTest.trim()) {
      toast.error('Bitte zuerst einen API-Key eingeben');
      return false;
    }

    setIsValidating(true);
    // Key temporär für den Test-Request speichern, damit invokeAiFunction ihn findet
    updateSettings({ openAiApiKey: keyToTest.trim() });

    try {
      const { data, error } = await invokeAiFunction('check-ai-config', {});
      if (error) throw error;

      const result = data as { valid: boolean; error?: string };
      if (result.valid) {
        updateSettings({ aiModeEnabled: true, openAiApiKey: keyToTest.trim() });
        toast.success('API-Key gültig — KI-Modus aktiviert');
        return true;
      } else {
        // Ungültiger Key → zurücksetzen
        updateSettings({ openAiApiKey: '', aiModeEnabled: false });
        toast.error('Ungültiger API-Key', {
          description: result.error ?? 'Der eingegebene Key wurde von OpenAI abgelehnt.',
        });
        return false;
      }
    } catch {
      updateSettings({ openAiApiKey: '', aiModeEnabled: false });
      toast.error('Verbindungsfehler beim Prüfen des API-Keys');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleAiToggle = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ aiModeEnabled: false });
      return;
    }
    // Einschalten: Key aus aktuellem Input oder gespeichertem Key verwenden
    const keyToUse = keyInput.trim() || settings.openAiApiKey;
    await validateAndSave(keyToUse);
  };

  const handleTestAndSave = () => validateAndSave(keyInput);

  const isKeyConfigured = !!settings.openAiApiKey;

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
            OpenAI API-Key hinterlegen und KI-Funktionalitäten aktivieren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* API-Key Eingabe */}
          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API-Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="openai-key"
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10 font-mono text-sm"
                  disabled={isValidating}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={handleTestAndSave}
                disabled={isValidating || !keyInput.trim()}
                variant="outline"
                className="shrink-0"
              >
                {isValidating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Prüfe…</>
                ) : (
                  'Testen & Speichern'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Den Key findest du unter{' '}
              <span className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">
                platform.openai.com → API Keys
              </span>
            </p>
          </div>

          {/* Status + Toggle */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-3">
              {settings.aiModeEnabled && isKeyConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground/50 shrink-0" />
              )}
              <div className="space-y-0.5">
                <Label htmlFor="ai-mode" className="cursor-pointer">KI-Modus</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.aiModeEnabled && isKeyConfigured
                    ? 'Aktiv — alle KI-Features sind eingeschaltet'
                    : isKeyConfigured
                    ? 'Key hinterlegt — KI-Modus aktivieren'
                    : 'Erst API-Key eingeben und testen'}
                </p>
              </div>
            </div>
            <Switch
              id="ai-mode"
              checked={settings.aiModeEnabled}
              disabled={isValidating || (!isKeyConfigured && !keyInput.trim())}
              onCheckedChange={handleAiToggle}
            />
          </div>

          {/* Aktive Features Liste */}
          {settings.aiModeEnabled && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 text-sm">
              <p className="font-medium text-green-800 dark:text-green-300">Aktive KI-Funktionen:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-green-700 dark:text-green-400">
                <li>KI-Assistent im Dashboard</li>
                <li>KI-Import bei Kunden &amp; Mitarbeitern</li>
                <li>KI-Zeitfenster-Konfiguration</li>
                <li>KI-Mitarbeiter-Matching</li>
                <li>KI-Terminvorschläge im Dienstplan</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
