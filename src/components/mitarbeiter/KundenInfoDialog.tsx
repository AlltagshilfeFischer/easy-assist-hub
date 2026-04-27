import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Phone, Shield, Clock, AlertTriangle, MoveRight, User, Heart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment } from '@/types/domain';

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

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface KundenInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onChangeRequest: () => void;
  isGeschaeftsfuehrer?: boolean;
}

export function KundenInfoDialog({ isOpen, onClose, appointment, onChangeRequest, isGeschaeftsfuehrer = false }: KundenInfoDialogProps) {
  const [notfallkontakte, setNotfallkontakte] = useState<NotfallKontakt[]>([]);
  const [zeitfenster, setZeitfenster] = useState<Zeitfenster[]>([]);
  const [loading, setLoading] = useState(false);

  const customer = appointment?.customer;
  const kundenId = appointment?.kunden_id;

  useEffect(() => {
    if (!isOpen || !kundenId) return;
    setLoading(true);

    Promise.all([
      supabase.from('notfallkontakte').select('id, name, telefon, bezug').eq('kunden_id', kundenId),
      supabase.from('kunden_zeitfenster').select('id, wochentag, von, bis').eq('kunden_id', kundenId).order('wochentag'),
    ]).then(([nk, zf]) => {
      setNotfallkontakte((nk.data as NotfallKontakt[]) || []);
      setZeitfenster((zf.data as Zeitfenster[]) || []);
    }).finally(() => setLoading(false));
  }, [isOpen, kundenId]);

  if (!appointment) return null;

  const customerName = [customer?.vorname, customer?.nachname].filter(Boolean).join(' ') || customer?.name || 'Unbekannt';
  const adresse = [customer?.strasse, [customer?.plz, customer?.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const mapsUrl = adresse ? `https://maps.google.com/?q=${encodeURIComponent(adresse)}` : null;

  const startDate = parseISO(appointment.start_at);
  const endDate = parseISO(appointment.end_at);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Kundeninformationen
          </DialogTitle>
          <DialogDescription>
            Details zum Termin und Kunden
          </DialogDescription>
        </DialogHeader>

        {/* Termin-Info */}
        <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
          <p className="font-medium text-sm">{appointment.titel}</p>
          <p className="text-xs text-muted-foreground">
            {format(startDate, 'EEEE, dd.MM.yyyy', { locale: de })} · {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')} Uhr
          </p>
        </div>

        <Separator />

        {/* Kundenstammdaten */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <User className="h-4 w-4" /> Stammdaten
          </h3>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{customerName}</span>
            </div>
            {customer?.telefonnr && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Telefon</span>
                <a href={`tel:${customer.telefonnr}`} className="font-medium text-primary flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {customer.telefonnr}
                </a>
              </div>
            )}
            {adresse && (
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Adresse</span>
                <div className="text-right">
                  {mapsUrl ? (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary flex items-center gap-1 hover:underline">
                      <MapPin className="h-3 w-3 shrink-0" /> {adresse}
                    </a>
                  ) : (
                    <span className="font-medium">{adresse}</span>
                  )}
                  {customer?.stadtteil && (
                    <span className="text-xs text-muted-foreground block">({customer.stadtteil})</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Pflege-Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Heart className="h-4 w-4" /> Pflege-Info
          </h3>
          <div className="grid gap-2 text-sm">
            {customer?.pflegegrad != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pflegegrad</span>
                <Badge variant="secondary">{customer.pflegegrad}</Badge>
              </div>
            )}
            {customer?.pflegekasse && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pflegekasse</span>
                <span className="font-medium">{customer.pflegekasse}</span>
              </div>
            )}
            {customer?.versichertennummer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versichertennr.</span>
                <span className="font-medium font-mono text-xs">{customer.versichertennummer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notfallkontakte */}
        {notfallkontakte.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Notfallkontakte
              </h3>
              <div className="space-y-2">
                {notfallkontakte.map((nk) => (
                  <div key={nk.id} className="flex justify-between items-center text-sm rounded-md border p-2">
                    <div>
                      <span className="font-medium">{nk.name}</span>
                      {nk.bezug && <span className="text-muted-foreground text-xs ml-1">({nk.bezug})</span>}
                    </div>
                    <a href={`tel:${nk.telefon}`} className="text-primary flex items-center gap-1 text-xs">
                      <Phone className="h-3 w-3" /> {nk.telefon}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Zeitfenster */}
        {zeitfenster.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Bevorzugte Zeitfenster
              </h3>
              <div className="flex flex-wrap gap-2">
                {zeitfenster.map((zf) => (
                  <Badge key={zf.id} variant="outline" className="text-xs">
                    {zf.wochentag != null ? WOCHENTAGE[zf.wochentag] : '?'}: {zf.von?.slice(0, 5) || '?'} – {zf.bis?.slice(0, 5) || '?'}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Besondere Hinweise */}
        {customer?.sonstiges && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> Besondere Hinweise
              </h3>
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 whitespace-pre-wrap">{customer.sonstiges}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
          {appointment.status !== 'completed' && appointment.status !== 'abgerechnet' && appointment.status !== 'bezahlt' && (
            <Button size="sm" onClick={onChangeRequest} className="gap-1.5">
              <MoveRight className="h-4 w-4" />
              {isGeschaeftsfuehrer ? 'Termin verschieben' : 'Termin verschieben'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
