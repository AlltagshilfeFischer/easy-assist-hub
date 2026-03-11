---
name: neuer-termin
description: Neuen Termin korrekt erstellen im Alltagshilfe Fischer System. Verwenden wenn ein Termin, eine Sitzung oder ein Einsatz angelegt werden soll.
disable-model-invocation: true
argument-hint: "[Einzeltermin|Regeltermin] [Kunde] [Datum] [Uhrzeit]"
---

# Neuen Termin erstellen – $ARGUMENTS

## Schritt 1: Typ bestimmen

Frage falls nicht angegeben: **Einzeltermin oder Regeltermin (Serie)?**

- **Einzeltermin**: einmaliger Einsatz → `vorlage_id = NULL`
- **Regeltermin**: wiederkehrend (wöchentlich/zweiwöchentlich/monatlich) → Vorlage + generierte Termine

## Schritt 2: Pflichtfelder prüfen

```typescript
// Beide Typen benötigen:
{
  titel: string,         // z.B. "Grundpflege Müller"
  kunden_id: string,     // UUID aus kunden-Tabelle
  mitarbeiter_id?: string, // nullable – kann unassigned sein
  start_at: timestamptz, // Europe/Berlin → UTC
  end_at: timestamptz,
  status: 'unassigned' | 'scheduled',
}
```

## Schritt 3a: Einzeltermin anlegen

```typescript
const { data, error } = await supabase
  .from('termine')
  .insert({
    titel,
    kunden_id,
    mitarbeiter_id: mitarbeiterId ?? null,
    start_at: zonedTimeToUtc(startDateTime, 'Europe/Berlin').toISOString(),
    end_at:   zonedTimeToUtc(endDateTime,   'Europe/Berlin').toISOString(),
    status: mitarbeiterId ? 'scheduled' : 'unassigned',
    vorlage_id: null,   // Einzeltermin – IMMER null
    ist_ausnahme: false,
  })
  .select()
  .single();
if (error) throw error;
```

## Schritt 3b: Regeltermin anlegen

```typescript
// 1. Vorlage speichern
const { data: vorlage, error: vError } = await supabase
  .from('termin_vorlagen')
  .insert({
    titel,
    kunden_id,
    mitarbeiter_id: mitarbeiterId ?? null,
    wochentag,          // 0=Sonntag … 6=Samstag
    start_zeit,         // "HH:mm:ss"
    dauer_minuten,
    intervall,          // 'weekly' | 'biweekly' | 'monthly'
    gueltig_von,
    gueltig_bis: gueltigBis ?? null, // null → max. 12 Monate
    ist_aktiv: true,
  })
  .select().single();
if (vError) throw vError;

// 2. Termine generieren (nur FEHLENDE!)
const dates = calculateDatesForTemplate(vorlage, gueltigVon, gueltigBis ?? addMonths(gueltigVon, 12));
const existing = await supabase.from('termine')
  .select('start_at')
  .eq('vorlage_id', vorlage.id);

const toInsert = dates
  .filter(d => !existing.data?.some(e => isSameDay(parseISO(e.start_at), d)))
  .map(d => ({
    titel: vorlage.titel,
    kunden_id: vorlage.kunden_id,
    mitarbeiter_id: vorlage.mitarbeiter_id,
    start_at: zonedTimeToUtc(combine(d, vorlage.start_zeit), 'Europe/Berlin').toISOString(),
    end_at:   zonedTimeToUtc(combine(d, addMinutes(vorlage.start_zeit, vorlage.dauer_minuten)), 'Europe/Berlin').toISOString(),
    vorlage_id: vorlage.id,
    ist_ausnahme: false,
    status: vorlage.mitarbeiter_id ? 'scheduled' : 'unassigned',
  }));

if (toInsert.length > 0) {
  const { error: iError } = await supabase.from('termine').insert(toInsert);
  if (iError) throw iError;
}
```

## Schritt 4: Feedback

- Toast: `toast.success('Termin wurde erstellt')` (sonner)
- Query invalidieren: `queryClient.invalidateQueries({ queryKey: ['termine'] })`
- Bei Regeltermin: Anzahl erstellter Termine ausgeben

## Wichtig

- NIEMALS `ist_ausnahme = true` beim Erstellen setzen
- NIEMALS bestehende Termine überschreiben bei Regeltermin-Generierung
- Status `'unassigned'` wenn kein Mitarbeiter, sonst `'scheduled'`
