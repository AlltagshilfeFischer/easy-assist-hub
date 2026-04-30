import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Sparkles, FileText, Receipt, User, AlertCircle } from 'lucide-react';
import AITimeWindowsCreator from '@/components/schedule/ai/AITimeWindowsCreator';
import { useSettings } from '@/hooks/useSettings';
import { StepAbrechnung } from '@/components/customers/wizard/StepAbrechnung';
import { StepDokumente } from '@/components/customers/wizard/StepDokumente';
import { PflegekasseCombobox } from '@/components/customers/PflegekasseCombobox';
import { supabase } from '@/integrations/supabase/client';
import { customerBaseSchema } from '@/lib/validations/customer-schema';
import type { Customer, Employee, CustomerTimeWindow, Notfallkontakt } from '@/types/domain';
import type { Database } from '@/integrations/supabase/types';

type DokumentRow = Database['public']['Tables']['dokumente']['Row'];

type EditingCustomer = Customer & {
  zeitfenster?: CustomerTimeWindow[];
  notfallkontakte?: Notfallkontakt[];
  begruendung?: string | null;
};

interface CustomerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: EditingCustomer;
  setEditingCustomer: (c: EditingCustomer) => void;
  employees: Employee[] | undefined;
  onSave: (e: React.FormEvent, overrides?: Partial<EditingCustomer>) => void;
}

const getWeekdayName = (day: number): string => {
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return days[day] || '';
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const dateToMonth = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export function CustomerEditDialog({
  open,
  onOpenChange,
  editingCustomer,
  setEditingCustomer,
  employees,
  onSave,
}: CustomerEditDialogProps) {
  const { settings } = useSettings();
  const [showAITimeWindows, setShowAITimeWindows] = useState(false);
  const [budgetOrder, setBudgetOrder] = useState<string[]>([]);
  const [draggedBudget, setDraggedBudget] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<{ vertrag: File[]; historie: File[]; antragswesen: File[] }>({ vertrag: [], historie: [], antragswesen: [] });
  const [existingDokumente, setExistingDokumente] = useState<DokumentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize budget order from customer data
  useEffect(() => {
    if (editingCustomer) {
      const bp = editingCustomer.budget_prioritaet;
      if (bp && Array.isArray(bp) && bp.length > 0) {
        setBudgetOrder(bp);
      } else {
        // Build from active flags
        const order: string[] = [];
        if (editingCustomer.verhinderungspflege_aktiv) order.push('verhinderungspflege');
        if (editingCustomer.pflegesachleistung_aktiv) order.push('pflegesachleistung');
        setBudgetOrder(order);
      }
      setDocumentFiles({ vertrag: [], historie: [], antragswesen: [] });
      // Load existing documents
      loadExistingDokumente(editingCustomer.id);
    }
  }, [editingCustomer?.id]);

  const loadExistingDokumente = async (kundenId: string) => {
    if (!kundenId) return;
    const { data } = await supabase
      .from('dokumente')
      .select('*')
      .eq('kunden_id', kundenId)
      .order('created_at', { ascending: false });
    setExistingDokumente(data || []);
  };

  if (!editingCustomer) return null;

  // Wrapper for StepAbrechnung: it expects setCustomerData as function updater
  const setCustomerDataForAbrechnung = (fn: (prev: any) => any) => {
    setEditingCustomer(fn(editingCustomer));
  };

  const preSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = customerBaseSchema.safeParse({
      ...editingCustomer,
      pflegegrad: editingCustomer.pflegegrad != null ? String(editingCustomer.pflegegrad) : '',
      termindauer_stunden: editingCustomer.termindauer_stunden != null ? String(editingCustomer.termindauer_stunden) : '1.5',
      stunden_kontingent_monat: editingCustomer.stunden_kontingent_monat != null ? String(editingCustomer.stunden_kontingent_monat) : '',
      verhinderungspflege_budget: editingCustomer.verhinderungspflege_budget != null ? String(editingCustomer.verhinderungspflege_budget) : '3539',
      rechnungskopie: editingCustomer.rechnungskopie || [],
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setValidationErrors(fieldErrors);
      return;
    }
    setValidationErrors({});
    onSave(e, {
      budget_prioritaet: budgetOrder,
      notfallkontakte: editingCustomer.notfallkontakte ?? [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kundendaten bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeiten Sie alle Informationen für {editingCustomer?.vorname} {editingCustomer?.nachname}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={preSubmit}>
          <Tabs defaultValue="stammdaten" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stammdaten" className="gap-1.5">
                <User className="h-4 w-4" />
                Stammdaten
              </TabsTrigger>
              <TabsTrigger value="abrechnung" className="gap-1.5">
                <Receipt className="h-4 w-4" />
                Abrechnung
              </TabsTrigger>
              <TabsTrigger value="dokumente" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Dokumente
              </TabsTrigger>
            </TabsList>

            {/* Tab: Stammdaten */}
            <TabsContent value="stammdaten" className="space-y-6 mt-4">
              {/* Persönliche Daten */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Persönliche Daten</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="kategorie">Kategorie</Label>
                    <Select value={editingCustomer.kategorie || 'Kunde'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, kategorie: value })}>
                      <SelectTrigger id="kategorie"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Interessent">Interessent</SelectItem>
                        <SelectItem value="Kunde">Kunde</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="vorname">Vorname</Label>
                    <Input id="vorname" value={editingCustomer.vorname || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, vorname: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="nachname">Nachname</Label>
                    <Input id="nachname" value={editingCustomer.nachname || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, nachname: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
                    <Input
                      id="geburtsdatum"
                      type="date"
                      value={editingCustomer.geburtsdatum || ''}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, geburtsdatum: e.target.value })}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text').trim();
                        const match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
                        if (match) {
                          e.preventDefault();
                          const [, day, month, year] = match;
                          setEditingCustomer({ ...editingCustomer, geburtsdatum: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hauptbetreuer">Hauptbetreuer</Label>
                    <Select value={editingCustomer.mitarbeiter || '__none__'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, mitarbeiter: value === '__none__' ? null : value })}>
                      <SelectTrigger id="hauptbetreuer"><SelectValue placeholder="Hauptbetreuer auswählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Kein Hauptbetreuer</SelectItem>
                        {employees?.filter((e: any) => e.ist_aktiv).map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            {`${m.vorname || ''} ${m.nachname || ''}`.trim() || 'Unbenannter Mitarbeiter'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-strasse">Straße</Label>
                    <Input id="edit-strasse" value={editingCustomer.strasse || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, strasse: e.target.value })} placeholder="Straße und Hausnummer" />
                  </div>
                  <div>
                    <Label htmlFor="edit-plz">PLZ</Label>
                    <Input id="edit-plz" value={editingCustomer.plz || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, plz: e.target.value })} placeholder="PLZ" />
                  </div>
                  <div>
                    <Label htmlFor="edit-stadt">Stadt</Label>
                    <Input id="edit-stadt" value={editingCustomer.stadt || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, stadt: e.target.value })} placeholder="Stadt" />
                  </div>
                  <div>
                    <Label htmlFor="stadtteil">Stadtteil</Label>
                    <Input id="stadtteil" value={editingCustomer.stadtteil || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, stadtteil: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Kontaktdaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="telefonnr">Telefon</Label><Input id="telefonnr" value={editingCustomer.telefonnr || ''} onChange={(e) => { const val = e.target.value.replace(/[^\d+\-\/ ()]/g, ''); setEditingCustomer({ ...editingCustomer, telefonnr: val }); }} inputMode="tel" /></div>
                  <div><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" value={editingCustomer.email || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} /></div>
                </div>
              </div>

              {/* Pflegedaten */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Pflegedaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="pflegegrad">Pflegegrad</Label><Input id="pflegegrad" type="number" min="0" max="5" value={editingCustomer.pflegegrad || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, pflegegrad: e.target.value ? parseInt(e.target.value) : null })} /></div>
                  <div><Label htmlFor="stunden_kontingent_monat">Stunden</Label><Input id="stunden_kontingent_monat" type="number" step="0.5" value={editingCustomer.stunden_kontingent_monat || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, stunden_kontingent_monat: e.target.value ? parseFloat(e.target.value) : null })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Pflegekasse</Label><PflegekasseCombobox value={editingCustomer.pflegekasse || ''} onValueChange={(v) => setEditingCustomer({ ...editingCustomer, pflegekasse: v })} /></div>
                  <div><Label htmlFor="versichertennummer">Versichertennummer</Label><Input id="versichertennummer" value={editingCustomer.versichertennummer || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, versichertennummer: e.target.value })} /></div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Status</h3>
                <div>
                  <Label htmlFor="aktiv" className="text-base font-medium">Status</Label>
                  <Select value={editingCustomer.aktiv ? 'true' : 'false'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, aktiv: value === 'true' })}>
                    <SelectTrigger id="aktiv"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktiv</SelectItem>
                      <SelectItem value="false">Nicht aktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="begruendung">Begründung für Austritt/Deaktivierung</Label>
                  <Textarea id="begruendung" value={editingCustomer.begruendung || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, begruendung: e.target.value })} placeholder="Begründung eingeben..." rows={3} />
                </div>
              </div>

              {/* Ein- und Austrittsdaten */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Ein- und Austrittsdaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="eintritt">Eintrittsmonat</Label><Input id="eintritt" type="month" value={dateToMonth(editingCustomer.eintritt) || getCurrentMonth()} onChange={(e) => setEditingCustomer({ ...editingCustomer, eintritt: e.target.value })} /></div>
                  <div><Label htmlFor="austritt">Austrittsmonat</Label><Input id="austritt" type="month" value={dateToMonth(editingCustomer.austritt) || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, austritt: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="kopie_lw">Kopie LW</Label>
                    <Select value={editingCustomer.kopie_lw || '__none__'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, kopie_lw: value === '__none__' ? null : value })}>
                      <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Auswählen</SelectItem>
                        <SelectItem value="Ja">Ja</SelectItem>
                        <SelectItem value="Nein">Nein</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label htmlFor="angehoerige_ansprechpartner">Angehörige/Ansprechpartner</Label><Input id="angehoerige_ansprechpartner" value={editingCustomer.angehoerige_ansprechpartner || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, angehoerige_ansprechpartner: e.target.value })} /></div>
                <div><Label htmlFor="sonstiges">Sonstiges</Label><Textarea id="sonstiges" value={editingCustomer.sonstiges || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, sonstiges: e.target.value })} rows={3} /></div>
              </div>

              {/* Zeitfenster Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Zeitfenster</Label>
                  <div className="flex gap-2">
                    {settings.aiModeEnabled && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowAITimeWindows(true)}>
                        <Sparkles className="h-4 w-4 mr-1" />KI-Zeitfenster
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      const zeitfenster = editingCustomer.zeitfenster || [];
                      setEditingCustomer({ ...editingCustomer, zeitfenster: [...zeitfenster, { wochentag: 1, von: '08:00', bis: '12:00' }] });
                    }}>
                      <Plus className="h-4 w-4 mr-1" />Manuell hinzufügen
                    </Button>
                  </div>
                </div>

                {(editingCustomer.zeitfenster || []).map((zeitfenster: any, index: number) => (
                  <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                    <div>
                      <Label className="text-xs">Wochentag</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors" value={zeitfenster.wochentag}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.zeitfenster || [])];
                          updated[index] = { ...updated[index], wochentag: parseInt(e.target.value) };
                          setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                        }}>
                        <option value="0">Sonntag</option><option value="1">Montag</option><option value="2">Dienstag</option>
                        <option value="3">Mittwoch</option><option value="4">Donnerstag</option><option value="5">Freitag</option><option value="6">Samstag</option>
                      </select>
                    </div>
                    <div><Label className="text-xs">Von</Label><Input type="time" value={zeitfenster.von || ''} onChange={(e) => { const updated = [...(editingCustomer.zeitfenster || [])]; updated[index] = { ...updated[index], von: e.target.value }; setEditingCustomer({ ...editingCustomer, zeitfenster: updated }); }} /></div>
                    <div><Label className="text-xs">Bis</Label><Input type="time" value={zeitfenster.bis || ''} onChange={(e) => { const updated = [...(editingCustomer.zeitfenster || [])]; updated[index] = { ...updated[index], bis: e.target.value }; setEditingCustomer({ ...editingCustomer, zeitfenster: updated }); }} /></div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => {
                      const updated = (editingCustomer.zeitfenster || []).filter((_: any, i: number) => i !== index);
                      setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}

                {(editingCustomer.zeitfenster || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const grouped = (editingCustomer.zeitfenster || []).reduce((acc: any, slot: any) => {
                        if (!acc[slot.wochentag]) acc[slot.wochentag] = [];
                        acc[slot.wochentag].push(slot);
                        return acc;
                      }, {});
                      const sortedDays = Object.keys(grouped).map(Number).sort((a, b) => { const aD = a === 0 ? 7 : a; const bD = b === 0 ? 7 : b; return aD - bD; });
                      return sortedDays.map((day) => (
                        <Badge key={day} variant="outline" className="text-xs">
                          <span className="font-semibold">{getWeekdayName(day)}</span>
                          <span className="mx-1">·</span>
                          <span className="text-muted-foreground">
                            {grouped[day].map((slot: any, idx: number) => (
                              <span key={idx}>{slot.von?.substring(0, 5)}-{slot.bis?.substring(0, 5)}{idx < grouped[day].length - 1 && ', '}</span>
                            ))}
                          </span>
                        </Badge>
                      ));
                    })()}
                  </div>
                )}

                {showAITimeWindows && (
                  <AITimeWindowsCreator
                    onConfirm={(windows: any[]) => {
                      setEditingCustomer({
                        ...editingCustomer,
                        zeitfenster: [...(editingCustomer.zeitfenster || []), ...windows],
                      });
                      setShowAITimeWindows(false);
                    }}
                    onCancel={() => setShowAITimeWindows(false)}
                  />
                )}
              </div>

              {/* Notfallkontakte */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Notfallkontakte</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingCustomer({
                      ...editingCustomer,
                      notfallkontakte: [...(editingCustomer.notfallkontakte || []), { name: '', bezug: null, telefon: '' }],
                    })}
                  >
                    <Plus className="h-4 w-4 mr-1" />Kontakt hinzufügen
                  </Button>
                </div>

                {(editingCustomer.notfallkontakte || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Keine Notfallkontakte hinterlegt.</p>
                )}

                {(editingCustomer.notfallkontakte || []).map((kontakt: Notfallkontakt, index: number) => (
                  <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={kontakt.name}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.notfallkontakte || [])];
                          updated[index] = { ...updated[index], name: e.target.value };
                          setEditingCustomer({ ...editingCustomer, notfallkontakte: updated });
                        }}
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bezug</Label>
                      <Input
                        value={kontakt.bezug ?? ''}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.notfallkontakte || [])];
                          updated[index] = { ...updated[index], bezug: e.target.value || null };
                          setEditingCustomer({ ...editingCustomer, notfallkontakte: updated });
                        }}
                        placeholder="z.B. Sohn, Nachbar"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefon</Label>
                      <Input
                        value={kontakt.telefon}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.notfallkontakte || [])];
                          updated[index] = { ...updated[index], telefon: e.target.value.replace(/[^\d+\-\/ ()]/g, '') };
                          setEditingCustomer({ ...editingCustomer, notfallkontakte: updated });
                        }}
                        placeholder="0511 123456"
                        inputMode="tel"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingCustomer({
                        ...editingCustomer,
                        notfallkontakte: (editingCustomer.notfallkontakte || []).filter((_: Notfallkontakt, i: number) => i !== index),
                      })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab: Abrechnung */}
            <TabsContent value="abrechnung">
              <StepAbrechnung
                customerData={{
                  ...editingCustomer,
                  pflegegrad: editingCustomer.pflegegrad != null ? String(editingCustomer.pflegegrad) : '',
                  verhinderungspflege_budget: editingCustomer.verhinderungspflege_budget ?? 3539,
                }}
                setCustomerData={setCustomerDataForAbrechnung}
                budgetOrder={budgetOrder}
                setBudgetOrder={setBudgetOrder}
                draggedBudget={draggedBudget}
                setDraggedBudget={setDraggedBudget}
              />
            </TabsContent>

            {/* Tab: Dokumente */}
            <TabsContent value="dokumente" className="space-y-6 mt-4">
              <StepDokumente
                documentFiles={documentFiles}
                setDocumentFiles={setDocumentFiles}
              />

              {/* Existing documents */}
              {existingDokumente.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Vorhandene Dokumente</h3>
                  <div className="space-y-2">
                    {existingDokumente.map((dok) => (
                      <div key={dok.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{dok.titel}</p>
                            <p className="text-xs text-muted-foreground">{dok.kategorie} · {dok.dateiname}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {new Date(dok.created_at).toLocaleDateString('de-DE')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 mt-4">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Bitte korrigieren Sie folgende Felder:</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {Object.entries(validationErrors).map(([key, msg]) => (
                    <li key={key}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit">Speichern</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
