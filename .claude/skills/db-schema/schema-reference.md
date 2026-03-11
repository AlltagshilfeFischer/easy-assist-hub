# Vollständige Schema-Referenz

## RLS (Row Level Security)

Supabase RLS ist aktiv. Queries laufen mit dem angemeldeten Nutzer-Kontext.
`SECURITY DEFINER` Funktionen laufen mit Superuser-Rechten.

## Trigger

- `sync_mitarbeiter_name` – Synchronisiert vorname/nachname zwischen benutzer ↔ mitarbeiter
- `check_planungsregeln` – Validiert Verfügbarkeit, Abwesenheit, Tageslimit vor INSERT/UPDATE in termine

## Zeitzonenhandling

Alle Zeitstempel: `TIMESTAMPTZ` (UTC gespeichert).
Für Anzeige immer `Europe/Berlin` verwenden:

```typescript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
const berlinTime = utcToZonedTime(utcDate, 'Europe/Berlin');
```

## Migrationspfad

Migrations: `supabase/migrations/*.sql` (67+ Dateien, Aug 2025 – Feb 2026)

Neue Migration erstellen:
```bash
supabase migration new <beschreibung>
```

## Standorte

```typescript
const STANDORTE = ['Hannover', 'Hildesheim', 'Peine'] as const;
```

## Wochentage (SMALLINT)

```
0 = Sonntag
1 = Montag
2 = Dienstag
3 = Mittwoch
4 = Donnerstag
5 = Freitag
6 = Samstag
```

## Supabase Edge Functions

| Function | Zweck |
|----------|-------|
| `parse-appointment-text` | KI: Text → Termin-Daten |
| `parse-kunden-text` | KI: Text → Kunden-Daten |
| `parse-mitarbeiter-text` | KI: Text → Mitarbeiter-Daten |
| `parse-time-windows` | KI: Text → Zeitfenster |
| `suggest-employees` | KI: Mitarbeiter-Matching |
| `dashboard-assistant` | KI: Chat (SSE Streaming) |
| `approve-benutzer` | Benutzer genehmigen |
| `reject-benutzer` | Benutzer ablehnen |
| `batch-billing` | Sammelabrechnung |
| `send-email` | E-Mail versenden (Resend API) |
