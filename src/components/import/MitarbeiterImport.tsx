import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, UserPlus, Trash2, AlertCircle } from 'lucide-react';

interface ParsedMitarbeiter {
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  strasse?: string;
  plz?: string;
  stadt?: string;
  soll_wochenstunden?: number;
}

interface MitarbeiterImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MitarbeiterImport({ open, onOpenChange }: MitarbeiterImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState('');
  const [parsed, setParsed] = useState<ParsedMitarbeiter[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-mitarbeiter-text', {
        body: { text: inputText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.mitarbeiter?.length) {
        toast({ title: 'Keine Mitarbeiter erkannt', description: 'Die KI konnte keine Mitarbeiter aus dem Text extrahieren.', variant: 'destructive' });
        return;
      }
      setParsed(data.mitarbeiter);
      setStep('preview');
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleRemove = (index: number) => {
    setParsed(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const valid = parsed.filter(m => m.vorname && m.nachname && m.email);
    if (!valid.length) {
      toast({ title: 'Keine gültigen Einträge', description: 'Jeder Mitarbeiter benötigt Vorname, Nachname und E-Mail.', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: 'Nicht authentifiziert', variant: 'destructive' });
      setIsImporting(false);
      return;
    }

    let success = 0;
    let failed = 0;

    for (const m of valid) {
      try {
        const { error } = await supabase.functions.invoke('invite-mitarbeiter', {
          body: {
            email: m.email.trim(),
            vorname: m.vorname.trim(),
            nachname: m.nachname.trim(),
            telefon: m.telefon?.trim() || null,
            strasse: m.strasse?.trim() || null,
            plz: m.plz?.trim() || null,
            stadt: m.stadt?.trim() || null,
            soll_wochenstunden: m.soll_wochenstunden || null,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['mitarbeiter'] });
    queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });

    toast({
      title: failed ? 'Teilweiser Import' : 'Import erfolgreich',
      description: `${success} Einladung${success !== 1 ? 'en' : ''} gesendet${failed ? `, ${failed} fehlgeschlagen` : ''}`,
      variant: failed ? 'destructive' : 'default',
    });

    handleClose();
  };

  const handleClose = () => {
    setInputText('');
    setParsed([]);
    setStep('input');
    onOpenChange(false);
  };

  const missingEmails = parsed.filter(m => !m.email);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Mitarbeiter mit KI importieren
          </DialogTitle>
          <DialogDescription>
            Geben Sie Mitarbeiterdaten in beliebigem Format ein – die KI erkennt und strukturiert sie automatisch.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Beispiele:\n\nAnna Schmidt, anna@firma.de, Tel: 0511-12345\nMarkus Weber – markus.weber@test.de, 30 Std/Woche\n\nOder als Tabelle:\nVorname;Nachname;E-Mail\nLisa;Müller;lisa@test.de`}
              className="flex-1 min-h-[200px] font-mono text-sm"
            />
            <Button onClick={handleParse} disabled={!inputText.trim() || isParsing} className="w-full">
              {isParsing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> KI analysiert...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Mit KI analysieren</>
              )}
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {parsed.length} Mitarbeiter erkannt
              </p>
              <Button variant="ghost" size="sm" onClick={() => setStep('input')}>
                Zurück zum Text
              </Button>
            </div>

            {missingEmails.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {missingEmails.length} Mitarbeiter ohne E-Mail – werden übersprungen
              </div>
            )}

            <div className="flex-1 overflow-auto space-y-2 min-h-0">
              {parsed.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${!m.email ? 'border-destructive/30 bg-destructive/5 opacity-60' : 'bg-card'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {m.vorname} {m.nachname}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {m.email || 'Keine E-Mail'}
                      {m.telefon && ` · ${m.telefon}`}
                      {m.soll_wochenstunden && ` · ${m.soll_wochenstunden}h/Woche`}
                    </div>
                    {(m.strasse || m.stadt) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {[m.strasse, m.plz, m.stadt].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {!m.email && <Badge variant="destructive" className="text-xs">Keine E-Mail</Badge>}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleImport}
              disabled={isImporting || !parsed.some(m => m.email)}
              className="w-full"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Einladungen werden gesendet...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" /> {parsed.filter(m => m.email).length} Mitarbeiter einladen</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
