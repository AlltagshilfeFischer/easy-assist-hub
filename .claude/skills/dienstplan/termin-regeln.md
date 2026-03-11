# Dienstplan – Detailregeln & Gefahren

## Gefahren & Lösungen

### Doppelte Termine
```sql
SELECT COUNT(*) FROM termine
WHERE vorlage_id = $1 AND DATE(start_at) = $2;
-- Nur einfügen wenn COUNT = 0
```

### Ausnahmen werden überschrieben
- `ist_ausnahme = true` → NIEMALS in Regenerierung einbeziehen
- Trigger `check_planungsregeln` prüft Konflikte automatisch

### Endlos-Serien
```typescript
const MAX_GENERATION_MONTHS = 12;
const endDate = template.gueltig_bis ?? addMonths(template.gueltig_von, MAX_GENERATION_MONTHS);
```

### Vorlage gelöscht
- FK `ON DELETE SET NULL` → Termine bleiben, `vorlage_id` wird NULL
- Warnung an Benutzer: "X Termine sind mit dieser Serie verknüpft"

## Batch-Insert Optimierung
```typescript
// Ein einziger Insert statt Schleife
const appointments = dates.map(date => ({
  titel: template.titel,
  kunden_id: template.kunden_id,
  mitarbeiter_id: template.mitarbeiter_id,
  start_at: zonedTimeToUtc(combine(date, template.start_zeit), 'Europe/Berlin'),
  end_at: zonedTimeToUtc(combine(date, endTime), 'Europe/Berlin'),
  vorlage_id: template.id,
  ist_ausnahme: false,
  status: 'unassigned',
}));
await supabase.from('termine').insert(appointments);
```

## Best Practices

- Vorlage zuerst speichern, dann Termine generieren (in Transaction)
- Bei Fehler: Rollback beider Operationen
- Konflikte werden durch `check_planungsregeln` Trigger abgefangen
- Für Batch-Insert: Bei einzelnem Fehler nur problematisches Datum überspringen

## Monitoring-Queries
```sql
-- Verwaiste vorlage_id Referenzen
SELECT * FROM termine
WHERE vorlage_id IS NOT NULL
AND vorlage_id NOT IN (SELECT id FROM termin_vorlagen);

-- Inaktive Vorlagen mit zukünftigen Terminen
SELECT v.*, COUNT(t.id) as future_count
FROM termin_vorlagen v
LEFT JOIN termine t ON t.vorlage_id = v.id AND t.start_at > NOW()
WHERE v.ist_aktiv = false
GROUP BY v.id HAVING COUNT(t.id) > 0;
```
