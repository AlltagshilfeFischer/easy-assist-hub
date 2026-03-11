---
name: dienstplan
description: Arbeiten mit dem Dienstplan der Alltagshilfe Fischer. Laden wenn Kalender, Termine, Schichtplan, ScheduleBuilderModern, Regeltermine, Einzeltermine, Mitarbeiterzuweisung oder Terminplanung relevant sind.
---

# Dienstplan – Alltagshilfe Fischer

Hauptkomponente: `src/pages/controlboard/ScheduleBuilderModern.tsx`

## Termin-Typen

| Typ | vorlage_id | ist_ausnahme | Bedeutung |
|-----|-----------|--------------|-----------|
| Einzeltermin | NULL | - | Einmaliger Termin |
| Regeltermin (normal) | gesetzt | false | Automatisch generiert |
| Regeltermin (Ausnahme) | gesetzt | true | Manuell angepasste Instanz |

## Goldene Regel: NIEMALS überschreiben

```
Bestehende Termine IMMER erhalten.
Nur FEHLENDE Termine hinzufügen.
ist_ausnahme = true → NICHT überschreiben.
```

## Termin-Status (Workflow)

```
unassigned → scheduled → confirmed → in_progress → completed
                                              ↘ cancelled
```

## Regeltermine erstellen

1. Vorlage in `termin_vorlagen` speichern (wochentag, start_zeit, dauer_minuten, intervall)
2. `generate_termine_from_vorlagen()` aufrufen
3. Nur Termine für Daten erstellen, an denen noch KEIN Termin existiert
4. Maximum: 12 Monate Vorlauf wenn kein `gueltig_bis` gesetzt

```typescript
// Sicher: Existenz prüfen vor Insert
const exists = existingAppointments.some(apt => isSameDay(apt.start_at, date));
if (!exists) {
  await supabase.from('termine').insert({ vorlage_id: template.id, ist_ausnahme: false, ... });
}
```

## Einzeltermin aus Serie ändern

```typescript
// RICHTIG: Ausnahme markieren, NICHT neue Instanz erstellen
await supabase.from('termine').update({
  ist_ausnahme: true,
  ausnahme_grund: 'Zeit geändert', // dokumentieren
  start_at: neueZeit,
  end_at: neueEndzeit,
}).eq('id', terminId);
// vorlage_id bleibt erhalten!
```

## Zeitzone

Immer `Europe/Berlin`. Alle DB-Werte als `TIMESTAMPTZ` (UTC).

```typescript
// Datum + Zeit zusammenführen für DB
start_at: zonedTimeToUtc(combineDateAndTime(date, time), 'Europe/Berlin')
```

## Kalender-Darstellung

```typescript
if (appointment.vorlage_id && !appointment.ist_ausnahme) {
  // Serien-Icon <Repeat />
} else if (appointment.ist_ausnahme) {
  // Ausnahme-Icon <AlertCircle />
}
```

## Mitarbeiter-Matching (KI)

Edge Function `suggest-employees` – gibt passende Mitarbeiter zurück basierend auf:
- Verfügbarkeit (`mitarbeiter_verfuegbarkeit`)
- Abwesenheiten (`mitarbeiter_abwesenheiten`)
- max_termine_pro_tag
- Kundenwunsch (`kunden_zeitfenster`)

## Relevante Hooks & Komponenten

- `src/hooks/useAppointments.ts` – TanStack Query für Termin-Daten
- `src/components/schedule/dialogs/` – Alle Dialoge (Erstellen, Bearbeiten, Konflikte)
- `src/components/schedule/calendar/` – Kalenderansichten
- `src/components/schedule/panels/` – SmartAssignment, Konflikte

## Detailregeln

Vollständige Architektur: [termin-regeln.md](termin-regeln.md)
