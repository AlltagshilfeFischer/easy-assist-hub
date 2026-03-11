---
name: kunden-anlegen
description: Neuen Kunden im Alltagshilfe Fischer System anlegen. Verwenden wenn ein Kunde, Pflegebedürftiger oder Klient erfasst werden soll – manuell oder per Import.
disable-model-invocation: true
argument-hint: "[Name] [Pflegegrad] [Standort]"
---

# Neuen Kunden anlegen – $ARGUMENTS

## Wege zur Anlage

| Weg | Komponente | Wann |
|-----|-----------|------|
| Wizard | `CreateCustomerWizard` | Einzelner Kunde, vollständige Erfassung |
| Smart Import | `KundenSmartImport` → `SmartDataImport` | Mehrere Kunden, Tabelle/Excel |
| KI-Import | Edge Function `parse-kunden-text` | Freitext → strukturierte Daten |

## Wizard-Schritte

1. **Stammdaten** (`StepStammdaten`) – Name, Geburtsdatum, Kontakt, Adresse
2. **Abrechnung** (`StepAbrechnung`) – Pflegegrad, Pflegekasse, Versichertennummer, Kontingent
3. **Dokumente** (`StepDokumente`) – Optionaler Datei-Upload
4. **Mitarbeiter-Matching** (`StepEmployeeMatching`) – KI-Vorschlag für Hauptbetreuer

## Pflichtfelder (Datenbank)

```typescript
{
  // Mindestanforderung:
  nachname: string,           // oder name
  aktiv: true,                // Default

  // Empfohlen:
  vorname?: string,
  geburtsdatum?: string,      // ISO "YYYY-MM-DD"
  pflegegrad?: number,        // 1-5
  pflegekasse?: string,
  versichertennummer?: string,
  telefonnr?: string,
  strasse?: string,
  plz?: string,
  stadt?: string,
  standort?: 'Hannover' | 'Hildesheim' | 'Peine',
  stunden_kontingent_monat?: number,
  mitarbeiter?: string,       // UUID – Hauptbetreuer
  farbe_kalender?: string,    // Default '#10B981'
}
```

## Mutation (React Query)

```typescript
// aus useCustomerMutations.ts
const { mutate: createCustomer } = useMutation({
  mutationFn: async (data: KundeInsert) => {
    const { data: kunde, error } = await supabase
      .from('kunden')
      .insert({ ...data, aktiv: true })
      .select()
      .single();
    if (error) throw error;
    return kunde;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['kunden'] });
    toast.success('Kunde wurde angelegt');
  },
  onError: (error) => {
    console.error('Fehler beim Anlegen:', error);
    toast.error('Fehler beim Anlegen des Kunden');
  },
});
```

## KI-Import Workflow

```typescript
// Edge Function aufrufen
const response = await supabase.functions.invoke('parse-kunden-text', {
  body: { text: freitextInput }
});
// Gibt strukturierte Kunden-Daten zurück → in SmartDataImport befüllen
```

## Zeitfenster erfassen

Nach Kundenanlage können Verfügbarkeitsfenster gesetzt werden:

```typescript
await supabase.from('kunden_zeitfenster').insert({
  kunden_id: kunde.id,
  wochentag: 1, // Montag
  von: '08:00',
  bis: '12:00',
  prioritaet: 1, // 1 = höchste Priorität
});
```

## Typen

```typescript
import { Database } from '@/integrations/supabase/types';
type KundeRow    = Database['public']['Tables']['kunden']['Row'];
type KundeInsert = Database['public']['Tables']['kunden']['Insert'];
```
