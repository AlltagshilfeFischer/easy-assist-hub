import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MapPin, Phone, Mail, User, Shield, Clock, AlertTriangle, Heart, CreditCard, FileText, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface NotfallKontakt {
  id: string;
  name: string;
  telefon: string;
  bezug?: string | null;
}

interface Zeitfenster {
  id: string;
  wochentag: number | null;
  von: string | null;
  bis: string | null;
}

interface Leistung {
  id: string;
  art: string;
  status: string;
  gueltig_von: string;
  gueltig_bis: string | null;
  kontingent_menge: number | null;
  kontingent_verbraucht: number | null;
  kontingent_einheit: string | null;
  kontingent_zeitraum: string | null;
}

interface Hauptbetreuer {
  id: string;
  vorname: string | null;
  nachname: string | null;
}

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const LEISTUNGSART_LABELS: Record<string, string> = {
  entlastungsleistung: 'Entlastungsleistung (§45b)',
  verhinderungspflege: 'Verhinderungspflege (§39)',
  kurzzeitpflege: 'Kurzzeitpflege',
  pflegesachleistung: 'Pflegesachleistung (§36)',
  privat: 'Privat',
  sonstige: 'Sonstige',
};

const STATUS_COLORS: Record<string, string> = {
  beantragt: 'secondary',
  genehmigt: 'default',
  aktiv: 'default',
  pausiert: 'outline',
  beendet: 'secondary',
};

interface KundenDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  kundenId: string | null;
}

export function KundenDetailDialog({ isOpen, onClose, kundenId }: KundenDetailDialogProps) {
  const [kunde, setKunde] = useState<any>(null);
  const [notfallkontakte, setNotfallkontakte] = useState<NotfallKontakt[]>([]);
  const [zeitfenster, setZeitfenster] = useState<Zeitfenster[]>([]);
  const [leistungen, setLeistungen] = useState<Leistung[]>([]);
  const [hauptbetreuer, setHauptbetreuer] = useState<Hauptbetreuer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !kundenId) return;
    setLoading(true);

    Promise.all([
      supabase.from('kunden').select('*').eq('id', kundenId).single(),
      supabase.from('notfallkontakte').select('id, name, telefon, bezug').eq('kunden_id', kundenId),
      supabase.from('kunden_zeitfenster').select('id, wochentag, von, bis').eq('kunden_id', kundenId).order('wochentag'),
      supabase.from('leistungen').select('id, art, status, gueltig_von, gueltig_bis, kontingent_menge, kontingent_verbraucht, kontingent_einheit, kontingent_zeitraum').eq('kunden_id', kundenId).in('status', ['beantragt', 'genehmigt', 'aktiv']),
    ]).then(async ([kundeRes, nkRes, zfRes, leistRes]) => {
      const kundeData = kundeRes.data;
      setKunde(kundeData);
      setNotfallkontakte(nkRes.data || []);
      setZeitfenster(zfRes.data || []);
      setLeistungen(leistRes.data || []);

      if (kundeData?.mitarbeiter) {
        const { data: ma } = await supabase.from('mitarbeiter').select('id, vorname, nachname').eq('id', kundeData.mitarbeiter).single();
        setHauptbetreuer(ma);
      } else {
        setHauptbetreuer(null);
      }
      setLoading(false);
    });
  }, [isOpen, kundenId]);

  if (!kundenId) return null;

  const addressParts = [kunde?.strasse, [kunde?.plz, kunde?.stadt].filter(Boolean).join(' ')].filter(Boolean);
  const fullAddress = addressParts.join(', ');

  const budgetPrio = kunde?.budget_prioritaet || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {loading ? 'Lade...' : `${kunde?.vorname || ''} ${kunde?.nachname || ''}`}
            {kunde?.kunden_nummer && <Badge variant="outline" className="ml-2">#{kunde.kunden_nummer}</Badge>}
          </DialogTitle>
          <DialogDescription>Vollständige Kundendetails</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Lade Kundendaten...</div>
        ) : kunde ? (
          <Accordion type="multiple" defaultValue={['stammdaten', 'pflege', 'abrechnung', 'leistungen']} className="space-y-1">
            {/* Stammdaten */}
            <AccordionItem value="stammdaten">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><User className="h-4 w-4" /> Stammdaten & Kontakt</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium">{kunde.vorname} {kunde.nachname}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kategorie</span>
                    <p><Badge variant={kunde.kategorie === 'Interessent' ? 'outline' : 'default'}>{kunde.kategorie || 'Kunde'}</Badge></p>
                  </div>
                  {kunde.geburtsdatum && (
                    <div>
                      <span className="text-muted-foreground">Geburtsdatum</span>
                      <p>{new Date(kunde.geburtsdatum).toLocaleDateString('de-DE')}</p>
                    </div>
                  )}
                  {kunde.geschlecht && (
                    <div>
                      <span className="text-muted-foreground">Geschlecht</span>
                      <p>{kunde.geschlecht}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  {kunde.telefonnr && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={`tel:${kunde.telefonnr}`} className="hover:underline">{kunde.telefonnr}</a>
                    </div>
                  )}
                  {kunde.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={`mailto:${kunde.email}`} className="hover:underline">{kunde.email}</a>
                    </div>
                  )}
                  {fullAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                      <div>
                        <p>{fullAddress}{kunde.stadtteil && <span className="text-muted-foreground"> ({kunde.stadtteil})</span>}</p>
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          In Google Maps öffnen →
                        </a>
                      </div>
                    </div>
                  )}
                  {kunde.kontaktweg && (
                    <div>
                      <span className="text-muted-foreground">Bevorzugter Kontaktweg:</span> {kunde.kontaktweg}
                    </div>
                  )}
                </div>

                {/* Hauptbetreuer */}
                {hauptbetreuer && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Hauptbetreuer:</span>
                      <span className="font-medium">{hauptbetreuer.vorname} {hauptbetreuer.nachname}</span>
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Pflege & Versicherung */}
            <AccordionItem value="pflege">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Pflege & Versicherung</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Pflegegrad</span>
                    <p className="font-medium">{kunde.pflegegrad ?? 'Nicht angegeben'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kasse/Privat</span>
                    <p>{kunde.kasse_privat || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pflegekasse</span>
                    <p>{kunde.pflegekasse || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Versichertennr.</span>
                    <p>{kunde.versichertennummer || '-'}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Abrechnung / Töpfe */}
            <AccordionItem value="abrechnung">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Abrechnung & Budgets</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2 text-sm">
                {/* Verhinderungspflege */}
                <div className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Verhinderungspflege (§39)</span>
                    <Badge variant={kunde.verhinderungspflege_aktiv ? 'default' : 'secondary'}>
                      {kunde.verhinderungspflege_aktiv ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>Beantragt: {kunde.verhinderungspflege_beantragt ? '✓' : '✗'}</span>
                    <span>Genehmigt: {kunde.verhinderungspflege_genehmigt ? '✓' : '✗'}</span>
                    <span>Budget: {kunde.verhinderungspflege_budget ? `${Number(kunde.verhinderungspflege_budget).toLocaleString('de-DE')} €` : '-'}</span>
                  </div>
                </div>

                {/* Pflegesachleistung */}
                <div className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Pflegesachleistung (§36)</span>
                    <Badge variant={kunde.pflegesachleistung_aktiv ? 'default' : 'secondary'}>
                      {kunde.pflegesachleistung_aktiv ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Beantragt: {kunde.pflegesachleistung_beantragt ? '✓' : '✗'}</span>
                    <span>Genehmigt: {kunde.pflegesachleistung_genehmigt ? '✓' : '✗'}</span>
                  </div>
                </div>

                {/* Stundenkontingent */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Stundenkontingent/Monat</span>
                    <p className="font-medium">{kunde.stunden_kontingent_monat ? `${kunde.stunden_kontingent_monat} h` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Termindauer (Standard)</span>
                    <p className="font-medium">{kunde.termindauer_stunden ? `${kunde.termindauer_stunden} h` : '1,5 h'}</p>
                  </div>
                </div>

                {/* Budget-Priorität */}
                {budgetPrio.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Budget-Priorität (Reihenfolge)</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {budgetPrio.map((bp: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{i + 1}. {bp}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Aktive Leistungen */}
            <AccordionItem value="leistungen">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Aktive Leistungen ({leistungen.length})</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {leistungen.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine aktiven Leistungen</p>
                ) : leistungen.map((l) => (
                  <div key={l.id} className="border rounded-md p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{LEISTUNGSART_LABELS[l.art] || l.art}</span>
                      <Badge variant={(STATUS_COLORS[l.status] || 'outline') as any}>{l.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                      <span>Gültig ab: {new Date(l.gueltig_von).toLocaleDateString('de-DE')}</span>
                      <span>Gültig bis: {l.gueltig_bis ? new Date(l.gueltig_bis).toLocaleDateString('de-DE') : 'unbefristet'}</span>
                      {l.kontingent_menge != null && (
                        <>
                          <span>Kontingent: {l.kontingent_menge} {l.kontingent_einheit || 'h'}/{l.kontingent_zeitraum || 'Monat'}</span>
                          <span>Verbraucht: {l.kontingent_verbraucht ?? 0} {l.kontingent_einheit || 'h'}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Zeitfenster */}
            <AccordionItem value="zeitfenster">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Zeitfenster ({zeitfenster.length})</span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                {zeitfenster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Zeitfenster hinterlegt</p>
                ) : (
                  <div className="space-y-1">
                    {zeitfenster.map((z) => (
                      <div key={z.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="min-w-[90px] justify-center text-xs">
                          {z.wochentag != null ? WOCHENTAGE[z.wochentag] : '-'}
                        </Badge>
                        <span>{z.von?.slice(0, 5) || '?'} – {z.bis?.slice(0, 5) || '?'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Notfallkontakte */}
            <AccordionItem value="notfall">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Notfallkontakte ({notfallkontakte.length})</span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                {notfallkontakte.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Notfallkontakte hinterlegt</p>
                ) : (
                  <div className="space-y-2">
                    {notfallkontakte.map((nk) => (
                      <div key={nk.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                        <div>
                          <span className="font-medium">{nk.name}</span>
                          {nk.bezug && <span className="text-muted-foreground ml-1">({nk.bezug})</span>}
                        </div>
                        <a href={`tel:${nk.telefon}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" />{nk.telefon}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Besondere Hinweise */}
            {kunde.sonstiges && (
              <AccordionItem value="hinweise">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Besondere Hinweise</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{kunde.sonstiges}</p>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Kunde nicht gefunden</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
