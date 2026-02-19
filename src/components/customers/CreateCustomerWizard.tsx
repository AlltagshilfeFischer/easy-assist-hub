import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowRight, Loader2, Euro, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StepStammdaten } from './wizard/StepStammdaten';
import { StepAbrechnung } from './wizard/StepAbrechnung';
import { StepDokumente } from './wizard/StepDokumente';
import { StepEmployeeMatching } from './wizard/StepEmployeeMatching';

interface TimeWindow { wochentag: number; von: string; bis: string; }

interface CreateCustomerWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  onSuccess: () => void;
}

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthToDate = (monthString: string) => {
  if (!monthString) return null;
  return `${monthString}-01`;
};

const INITIAL_DATA = {
  kategorie: 'Kunde', vorname: '', nachname: '', geburtsdatum: '', geschlecht: '',
  strasse: '', stadt: '', plz: '', stadtteil: '', telefonnr: '', email: '', kontaktweg: '',
  pflegekasse: '', versichertennummer: '', pflegegrad: '', kasse_privat: '',
  verhinderungspflege_status: '', kopie_lw: '',
  rechnungskopie: [] as string[], rechnungskopie_adresse_name: '', rechnungskopie_adresse_strasse: '',
  rechnungskopie_adresse_plz: '', rechnungskopie_adresse_stadt: '',
  stunden_kontingent_monat: '', terminfrequenz: '', termindauer_stunden: '1.5',
  startdatum: '', eintritt: getCurrentMonth(), austritt: '',
  angehoerige_ansprechpartner: '', has_regular_appointments: false, mitarbeiter: '',
  zeitfenster: [] as TimeWindow[],
  notfallkontakte: [{ name: '', bezug: '', telefon: '' }],
  sonstiges: '',
  verhinderungspflege_aktiv: false, verhinderungspflege_beantragt: false, verhinderungspflege_genehmigt: false,
  verhinderungspflege_budget: '3539',
  pflegesachleistung_aktiv: false, pflegesachleistung_beantragt: false, pflegesachleistung_genehmigt: false,
};

export default function CreateCustomerWizard({ open, onOpenChange, employees, onSuccess }: CreateCustomerWizardProps) {
  const [step, setStep] = useState<'customer' | 'employees'>('customer');
  const [activeTab, setActiveTab] = useState('stammdaten');
  const [isLoading, setIsLoading] = useState(false);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState({ ...INITIAL_DATA, eintritt: getCurrentMonth() });
  const [weekMatrix, setWeekMatrix] = useState<Record<number, Record<string, boolean>>>({});
  const [budgetOrder, setBudgetOrder] = useState<string[]>([]);
  const [draggedBudget, setDraggedBudget] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<{ vertrag: File[]; historie: File[]; antragswesen: File[] }>({ vertrag: [], historie: [], antragswesen: [] });

  const resetWizard = () => {
    setStep('customer'); setActiveTab('stammdaten'); setCreatedCustomerId(null);
    setWeekMatrix({}); setBudgetOrder([]); setDraggedBudget(null);
    setDocumentFiles({ vertrag: [], historie: [], antragswesen: [] });
    setCustomerData({ ...INITIAL_DATA, eintritt: getCurrentMonth() });
  };

  const handleClose = () => { resetWizard(); onOpenChange(false); };

  const handleSaveCustomerAndTimeWindows = async () => {
    if (!customerData.vorname || !customerData.nachname) { toast.error('Bitte Vor- und Nachname ausfüllen'); return; }
    if (!customerData.strasse.trim()) { toast.error('Bitte Straße und Hausnummer ausfüllen'); return; }
    if (!customerData.plz.trim() || !/^\d{5}$/.test(customerData.plz.trim())) { toast.error('Bitte eine gültige 5-stellige PLZ eingeben'); return; }
    if (!customerData.telefonnr.trim()) { toast.error('Bitte Telefonnummer ausfüllen'); return; }

    setIsLoading(true);
    try {
      const insertData: Record<string, any> = {
        kategorie: customerData.kategorie, vorname: customerData.vorname, nachname: customerData.nachname,
        telefonnr: customerData.telefonnr || null, email: customerData.email || null,
        strasse: customerData.strasse || null, stadt: customerData.stadt || null,
        plz: customerData.plz || null, stadtteil: customerData.stadtteil || null,
        geburtsdatum: customerData.geburtsdatum || null, geschlecht: customerData.geschlecht || null,
        kontaktweg: customerData.kontaktweg || null, pflegekasse: customerData.pflegekasse || null,
        versichertennummer: customerData.versichertennummer || null,
        pflegegrad: customerData.pflegegrad ? parseInt(customerData.pflegegrad) : null,
        stunden_kontingent_monat: customerData.stunden_kontingent_monat ? parseFloat(customerData.stunden_kontingent_monat) : null,
        terminfrequenz: customerData.terminfrequenz || null,
        termindauer_stunden: customerData.termindauer_stunden ? parseFloat(customerData.termindauer_stunden) : 1.5,
        startdatum: customerData.startdatum || null, eintritt: monthToDate(customerData.eintritt),
        austritt: monthToDate(customerData.austritt), angehoerige_ansprechpartner: customerData.angehoerige_ansprechpartner || null,
        kasse_privat: customerData.kasse_privat || null, verhinderungspflege_status: customerData.verhinderungspflege_status || null,
        kopie_lw: customerData.kopie_lw || null,
        rechnungskopie: customerData.rechnungskopie.length > 0 ? customerData.rechnungskopie : null,
        sonstiges: customerData.sonstiges || null,
        verhinderungspflege_aktiv: customerData.verhinderungspflege_aktiv,
        verhinderungspflege_beantragt: customerData.verhinderungspflege_beantragt,
        verhinderungspflege_genehmigt: customerData.verhinderungspflege_genehmigt,
        verhinderungspflege_budget: customerData.verhinderungspflege_budget ? parseFloat(customerData.verhinderungspflege_budget) : 3539,
        pflegesachleistung_aktiv: customerData.pflegesachleistung_aktiv,
        pflegesachleistung_beantragt: customerData.pflegesachleistung_beantragt,
        pflegesachleistung_genehmigt: customerData.pflegesachleistung_genehmigt,
        budget_prioritaet: budgetOrder.length > 0 ? budgetOrder : null,
      };

      if (customerData.rechnungskopie.includes('abweichende_adresse')) {
        insertData.rechnungskopie_adresse_name = customerData.rechnungskopie_adresse_name || null;
        insertData.rechnungskopie_adresse_strasse = customerData.rechnungskopie_adresse_strasse || null;
        insertData.rechnungskopie_adresse_plz = customerData.rechnungskopie_adresse_plz || null;
        insertData.rechnungskopie_adresse_stadt = customerData.rechnungskopie_adresse_stadt || null;
      }

      const { data: customer, error: customerError } = await supabase.from('kunden').insert([insertData]).select().single();
      if (customerError) throw customerError;
      setCreatedCustomerId(customer.id);

      if (customerData.zeitfenster.length > 0) {
        const { error } = await supabase.from('kunden_zeitfenster').insert(
          customerData.zeitfenster.map((w) => ({ kunden_id: customer.id, wochentag: w.wochentag, von: w.von, bis: w.bis }))
        );
        if (error) throw error;
      }

      const validKontakte = customerData.notfallkontakte.filter((k) => k.name.trim() && k.telefon.trim());
      if (validKontakte.length > 0) {
        const { error } = await supabase.from('notfallkontakte').insert(
          validKontakte.map((k) => ({ kunden_id: customer.id, name: k.name.trim(), bezug: k.bezug.trim() || null, telefon: k.telefon.trim() }))
        );
        if (error) throw error;
      }

      const allDocFiles = [
        ...documentFiles.vertrag.map((f) => ({ file: f, kategorie: 'vertrag' })),
        ...documentFiles.historie.map((f) => ({ file: f, kategorie: 'historie' })),
        ...documentFiles.antragswesen.map((f) => ({ file: f, kategorie: 'antragswesen' })),
      ];
      if (allDocFiles.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          for (const { file, kategorie } of allDocFiles) {
            const filePath = `kunden/${customer.id}/${kategorie}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('dokumente').upload(filePath, file);
            if (uploadError) { console.error('Upload error:', uploadError); continue; }
            await supabase.from('dokumente').insert({
              titel: file.name, dateiname: file.name, dateipfad: filePath,
              mime_type: file.type || 'application/octet-stream', groesse_bytes: file.size,
              kategorie, kunden_id: customer.id, hochgeladen_von: user.id,
            });
          }
        }
      }

      toast.success('Kundendaten gespeichert');
      if (customerData.has_regular_appointments && customerData.zeitfenster.length > 0) {
        setStep('employees');
      } else { handleClose(); onSuccess(); }
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast.error(error.message || 'Fehler beim Speichern');
    } finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 'customer' ? 'Schritt 1: Kundendaten' : 'Schritt 2: Mitarbeiter-Matching'}</DialogTitle>
          <DialogDescription>{step === 'customer' ? 'Erfassen Sie die Kundendaten und Zeitfenster' : 'KI-gestützte Mitarbeiter-Zuordnung'}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'customer' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <span className="font-medium">1</span><span className="hidden sm:inline">Kundendaten</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'employees' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <span className="font-medium">2</span><span className="hidden sm:inline">Mitarbeiter</span>
          </div>
        </div>

        {step === 'customer' && (
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stammdaten">Persönliche Daten</TabsTrigger>
                <TabsTrigger value="abrechnung"><Euro className="h-4 w-4 mr-1" />Abrechnung</TabsTrigger>
                <TabsTrigger value="dokumente"><FileText className="h-4 w-4 mr-1" />Dokumente</TabsTrigger>
              </TabsList>
              <TabsContent value="stammdaten">
                <StepStammdaten customerData={customerData} setCustomerData={setCustomerData} weekMatrix={weekMatrix} setWeekMatrix={setWeekMatrix} employees={employees} />
              </TabsContent>
              <TabsContent value="abrechnung">
                <StepAbrechnung customerData={customerData} setCustomerData={setCustomerData} budgetOrder={budgetOrder} setBudgetOrder={setBudgetOrder} draggedBudget={draggedBudget} setDraggedBudget={setDraggedBudget} />
              </TabsContent>
              <TabsContent value="dokumente">
                <StepDokumente documentFiles={documentFiles} setDocumentFiles={setDocumentFiles} />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button onClick={handleSaveCustomerAndTimeWindows} disabled={isLoading || !customerData.vorname || !customerData.nachname}>
                {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Speichern...</>) : customerData.has_regular_appointments && customerData.zeitfenster.length > 0 ? (<>Weiter zum Mitarbeiter-Matching<ArrowRight className="h-4 w-4 ml-2" /></>) : 'Kunden anlegen'}
              </Button>
            </div>
          </div>
        )}

        {step === 'employees' && createdCustomerId && (
          <StepEmployeeMatching customerData={customerData} createdCustomerId={createdCustomerId} onClose={handleClose} onSuccess={onSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}
