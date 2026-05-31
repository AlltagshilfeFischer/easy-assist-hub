import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { useGfStempelUrl } from '@/hooks/useOrganisationSettings';
import { useGfSignature } from '@/hooks/useGfSignature';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import {
  Settings as SettingsIcon,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Stamp,
  Upload,
  Trash2,
  PenLine,
  RotateCcw,
} from 'lucide-react';
import { invokeAiFunction } from '@/lib/aiClient';
import { toast } from 'sonner';

const MAX_STAMP_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_STAMP_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [isValidating, setIsValidating] = useState(false);
  const [keyInput, setKeyInput] = useState(settings.openAiApiKey);
  const [showKey, setShowKey] = useState(false);

  // GF-Stempel (organisationsweit)
  const { stempelUrl, isLoading: isStempelLoading, saveStempelUrl, isSaving: isStempelSaving } = useGfStempelUrl();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persönliche GF-Unterschrift
  const { isGeschaeftsfuehrer } = useUserRole();
  const { signaturUrl, signaturName, isLoading: isSigLoading, isSaving: isSigSaving, saveSignature, saveUploadedFile, clearSignature, saveName } = useGfSignature();
  const [sigName, setSigName] = useState('');
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSigUploading, setIsSigUploading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const sigNameInitialized = useRef(false);

  // Initialen Namen aus gespeichertem Wert übernehmen (einmalig beim Laden)
  useEffect(() => {
    if (signaturName && !sigNameInitialized.current) {
      sigNameInitialized.current = true;
      setSigName(signaturName);
    }
  }, [signaturName]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (isDrawMode) setTimeout(initCanvas, 50);
  }, [isDrawMode, initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e, canvas);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPointRef.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  };

  const endDraw = () => { isDrawingRef.current = false; lastPointRef.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  const handleSaveDrawn = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await saveSignature(dataUrl, sigName);
      setIsDrawMode(false);
      setHasDrawn(false);
      toast.success('Unterschrift gespeichert');
    } catch (err) {
      console.error(err);
      toast.error('Speichern fehlgeschlagen');
    }
  };

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (sigFileInputRef.current) sigFileInputRef.current.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Nur PNG oder JPG erlaubt');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Datei zu groß — max. 2 MB');
      return;
    }
    setIsSigUploading(true);
    try {
      await saveUploadedFile(file, sigName);
      toast.success('Unterschrift gespeichert');
    } catch (err) {
      console.error(err);
      toast.error('Upload fehlgeschlagen');
    } finally {
      setIsSigUploading(false);
    }
  };

  const handleClearSig = async () => {
    try {
      await clearSignature();
      toast.success('Unterschrift entfernt');
    } catch (err) {
      console.error(err);
      toast.error('Löschen fehlgeschlagen');
    }
  };

  const handleSaveName = async () => {
    try {
      await saveName(sigName);
      toast.success('Name gespeichert');
    } catch (err) {
      console.error(err);
      toast.error('Speichern fehlgeschlagen');
    }
  };

  const handleStempelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';

    if (!file) return;

    if (!ALLOWED_STAMP_TYPES.includes(file.type)) {
      toast.error('Nur PNG oder JPG erlaubt');
      return;
    }
    if (file.size > MAX_STAMP_SIZE_BYTES) {
      toast.error('Datei zu groß — maximal 2 MB erlaubt');
      return;
    }

    setIsUploading(true);
    try {
      // Feste Extension "png" — vereinfacht Delete und verhindert Extension-Mismatch
      const storagePath = `gf-stempel/stempel.png`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      // Nur die saubere URL in DB speichern — Cache-Buster wird beim Anzeigen ergänzt
      await saveStempelUrl(urlData.publicUrl);
      toast.success('Stempel erfolgreich gespeichert');
    } catch (err) {
      console.error(err);
      toast.error('Upload fehlgeschlagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStempelDelete = async () => {
    try {
      await saveStempelUrl(null);
      // Datei aus Storage entfernen (best-effort, feste Extension)
      await supabase.storage.from('avatars').remove(['gf-stempel/stempel.png']);
      toast.success('Stempel entfernt');
    } catch (err) {
      console.error(err);
      toast.error('Löschen fehlgeschlagen');
    }
  };

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

      type CheckResult =
        | { valid: true }
        | { valid: false; reason: 'missing_key' | 'invalid_key' | 'network_error'; error: string };
      const result = data as CheckResult;
      if (result.valid) {
        updateSettings({ aiModeEnabled: true, openAiApiKey: keyToTest.trim() });
        toast.success('API-Key gültig — KI-Modus aktiviert');
        return true;
      } else {
        updateSettings({ openAiApiKey: '', aiModeEnabled: false });
        const description =
          result.reason === 'missing_key'
            ? 'Kein API-Key auf dem Server konfiguriert.'
            : result.reason === 'network_error'
            ? 'OpenAI war nicht erreichbar. Bitte erneut versuchen.'
            : (result.error ?? 'Der eingegebene Key wurde von OpenAI abgelehnt.');
        toast.error('API-Key ungültig', { description });
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

      {/* GF-Stempel / Unterschrift */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stamp className="h-5 w-5" />
            GF-Stempel / Unterschrift
          </CardTitle>
          <CardDescription>
            Bild (PNG/JPG, max. 2 MB) wird auf dem Leistungsnachweis unten links angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vorschau */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              {isStempelLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade…
                </div>
              ) : stempelUrl ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Aktueller Stempel:</p>
                  <div className="border rounded-lg p-3 bg-white inline-block">
                    <img
                      src={stempelUrl}
                      alt="GF-Stempel"
                      className="max-h-24 max-w-xs object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center text-sm text-muted-foreground">
                  Noch kein Stempel hinterlegt
                </div>
              )}
            </div>
          </div>

          {/* Aktionen */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isStempelSaving}
              className="gap-2"
            >
              {isUploading || isStempelSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {stempelUrl ? 'Stempel ersetzen' : 'Stempel hochladen'}
            </Button>
            {stempelUrl && (
              <Button
                variant="outline"
                onClick={handleStempelDelete}
                disabled={isUploading || isStempelSaving}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Entfernen
              </Button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleStempelUpload}
          />

          <p className="text-xs text-muted-foreground">
            Empfohlen: transparenter Hintergrund (PNG), mind. 200×100 px.
          </p>
        </CardContent>
      </Card>

      {/* Persönliche GF-Unterschrift — nur für GF/GlobalAdmin */}
      {isGeschaeftsfuehrer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Persönliche Unterschrift
            </CardTitle>
            <CardDescription>
              Einmal zeichnen oder hochladen — wird automatisch auf jedem Leistungsnachweis als GF-Unterschrift verwendet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="sig-name">Name (erscheint auf dem LN)</Label>
              <div className="flex gap-2">
                <Input
                  id="sig-name"
                  value={sigName}
                  onChange={e => setSigName(e.target.value)}
                  placeholder="Vorname Nachname"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleSaveName} disabled={isSigSaving} className="shrink-0">
                  Speichern
                </Button>
              </div>
            </div>

            {/* Aktuelle Unterschrift */}
            {isSigLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade…
              </div>
            ) : signaturUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Gespeicherte Unterschrift:</p>
                <div className="border rounded-lg p-3 bg-white inline-block">
                  <img
                    src={`${signaturUrl}?t=${Math.floor(Date.now() / 60000)}`}
                    alt="GF-Unterschrift"
                    className="max-h-20 max-w-xs object-contain"
                  />
                </div>
              </div>
            ) : !isDrawMode ? (
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center text-sm text-muted-foreground">
                Noch keine Unterschrift hinterlegt
              </div>
            ) : null}

            {/* Zeichenpad */}
            {isDrawMode && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Hier unterschreiben:</p>
                <div className="border rounded-lg bg-white overflow-hidden" style={{ touchAction: 'none' }}>
                  <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '120px', display: 'block', cursor: 'crosshair' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Neu zeichnen
                  </Button>
                  <Button size="sm" onClick={handleSaveDrawn} disabled={!hasDrawn || isSigSaving} className="gap-1.5">
                    {isSigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Unterschrift übernehmen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setIsDrawMode(false); setHasDrawn(false); }}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}

            {/* Aktionen */}
            {!isDrawMode && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setIsDrawMode(true)} className="gap-2">
                  <PenLine className="h-4 w-4" />
                  {signaturUrl ? 'Neu zeichnen' : 'Unterschrift zeichnen'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => sigFileInputRef.current?.click()}
                  disabled={isSigUploading || isSigSaving}
                  className="gap-2"
                >
                  {isSigUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {signaturUrl ? 'Bild ersetzen' : 'Bild hochladen'}
                </Button>
                {signaturUrl && (
                  <Button
                    variant="outline"
                    onClick={handleClearSig}
                    disabled={isSigUploading || isSigSaving}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Entfernen
                  </Button>
                )}
              </div>
            )}

            <input
              ref={sigFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleSigUpload}
            />

            <p className="text-xs text-muted-foreground">
              Die Unterschrift erscheint automatisch auf jedem Leistungsnachweis, solange du eingeloggt bist.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
