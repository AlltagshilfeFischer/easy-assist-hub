# Termin-System Architektur

## Übersicht

Das Terminsystem unterstützt zwei Arten von Terminen:

### 1. **Einzeltermine**
- Werden direkt in der `termine` Tabelle gespeichert
- Einmalige Termine ohne Wiederholung
- Können jederzeit ohne Auswirkungen geändert oder gelöscht werden

### 2. **Regeltermine (Wiederkehrende Termine)**
- Vorlage wird in `termin_vorlagen` gespeichert
- Generiert automatisch Termine in der `termine` Tabelle
- Jeder generierte Termin hat eine Referenz (`vorlage_id`) zur Vorlage

## Datenbankstruktur

### Tabelle `termine`
```sql
- id: UUID (Primärschlüssel)
- titel: TEXT
- kunden_id: UUID (Fremdschlüssel zu kunden)
- mitarbeiter_id: UUID (Fremdschlüssel zu mitarbeiter)
- start_at: TIMESTAMPTZ
- end_at: TIMESTAMPTZ
- status: termin_status ENUM
- vorlage_id: UUID (Optional - Referenz zu termin_vorlagen)
- ist_ausnahme: BOOLEAN (Default: false)
- ausnahme_grund: TEXT (Optional)
```

### Tabelle `termin_vorlagen`
```sql
- id: UUID (Primärschlüssel)
- titel: TEXT
- kunden_id: UUID
- mitarbeiter_id: UUID
- wochentag: SMALLINT (0-6, Sonntag-Samstag)
- start_zeit: TIME
- dauer_minuten: INTEGER
- intervall: ENUM ('weekly', 'biweekly', 'monthly')
- gueltig_von: DATE
- gueltig_bis: DATE (Optional)
- ist_aktiv: BOOLEAN
- notizen: TEXT (Optional)
```

## Funktionsweise

### Einzeltermin erstellen
1. Benutzer klickt auf leeres Kalenderfeld
2. Wählt Tab "Einzeltermin"
3. Füllt Formular aus
4. Termin wird direkt in `termine` gespeichert
5. `vorlage_id` bleibt NULL

### Regeltermin erstellen
1. Benutzer klickt auf leeres Kalenderfeld
2. Wählt Tab "Regeltermin"
3. Füllt Formular aus (Wochentag, Intervall, Gültigkeitszeitraum)
4. Vorlage wird in `termin_vorlagen` gespeichert
5. Funktion `generate_termine_from_vorlagen()` wird aufgerufen
6. Termine werden für den Zeitraum generiert mit:
   - `vorlage_id` = ID der Vorlage
   - `ist_ausnahme` = false

### Einzelnen Termin aus Serie ändern
1. Benutzer bearbeitet einen Termin mit `vorlage_id`
2. Änderungen werden gespeichert
3. Felder werden aktualisiert:
   - `ist_ausnahme` = true
   - `ausnahme_grund` = "Zeit geändert" / "Mitarbeiter gewechselt" etc.
4. `vorlage_id` bleibt erhalten (wichtig!)
5. Die Serie (andere Termine) bleibt unberührt

## Wichtige Konzepte

### ⚠️ Ausnahme-Handling
- Ein Termin mit `vorlage_id` UND `ist_ausnahme=true` ist eine **individuelle Anpassung**
- Die Vorlage darf diesen Termin NICHT überschreiben
- Bei erneuter Generierung muss geprüft werden: Existiert bereits ein Termin zu diesem Datum?

### 🔄 Regenerierung von Terminen
```javascript
// Pseudocode für sichere Regenerierung
async function regenerateFromTemplate(templateId, fromDate, toDate) {
  const template = await getTemplate(templateId);
  const existingAppointments = await getAppointmentsForTemplate(templateId, fromDate, toDate);
  
  // Generiere alle theoretischen Termine
  const theoreticalDates = calculateDatesForTemplate(template, fromDate, toDate);
  
  for (const date of theoreticalDates) {
    // Prüfe ob bereits ein Termin existiert (auch Ausnahmen!)
    const exists = existingAppointments.some(apt => 
      isSameDay(apt.start_at, date)
    );
    
    if (!exists) {
      // Nur erstellen wenn KEIN Termin existiert
      await createAppointment({
        ...template,
        start_at: date,
        vorlage_id: template.id,
        ist_ausnahme: false
      });
    }
    // Existierende Termine (inkl. Ausnahmen) werden NICHT überschrieben
  }
}
```

## Potenzielle Gefahren & Lösungen

### ❌ GEFAHR 1: Doppelte Termine
**Problem:** Bei Regenerierung könnten doppelte Termine entstehen

**Lösung:**
```sql
-- Eindeutigkeits-Check vor INSERT
SELECT COUNT(*) FROM termine 
WHERE vorlage_id = ? 
AND DATE(start_at) = ?;

-- Nur einfügen wenn COUNT = 0
```

### ❌ GEFAHR 2: Ausnahmen werden überschrieben
**Problem:** Manuell geänderte Termine werden bei Regenerierung zurückgesetzt

**Lösung:**
- **NIEMALS** bestehende Termine überschreiben
- Bei Regenerierung nur fehlende Termine hinzufügen
- `ist_ausnahme` Flag respektieren

### ❌ GEFAHR 3: Vorlage wird gelöscht
**Problem:** Was passiert mit generierten Terminen wenn Vorlage gelöscht wird?

**Lösung:**
```sql
-- Foreign Key mit ON DELETE SET NULL
ALTER TABLE termine
ADD CONSTRAINT fk_vorlage
FOREIGN KEY (vorlage_id) 
REFERENCES termin_vorlagen(id)
ON DELETE SET NULL;
```
- Termine bleiben erhalten
- `vorlage_id` wird NULL
- Termine werden zu "normalen" Einzelterminen

### ❌ GEFAHR 4: Endlos-Serien
**Problem:** Regeltermin ohne Enddatum könnte unbegrenzt Termine generieren

**Lösung:**
```javascript
// Immer ein Maximum setzen
const MAX_GENERATION_MONTHS = 12;
const endDate = template.gueltig_bis || 
  addMonths(template.gueltig_von, MAX_GENERATION_MONTHS);
```

### ❌ GEFAHR 5: Überlappende Validierungen
**Problem:** `check_planungsregeln()` Trigger könnte mit Regelterminen in Konflikt geraten

**Lösung:**
- Trigger prüft bereits Verfügbarkeit, Abwesenheit, Tageslimit
- Bei Batch-Insert von Regelterminen: Transaktion verwenden
- Im Fehlerfall: Nur problematische Termine überspringen, nicht gesamte Serie abbrechen

### ❌ GEFAHR 6: Zeitverschiebungen
**Problem:** Sommer-/Winterzeit könnte Termine verschieben

**Lösung:**
```javascript
// Immer mit TIMESTAMPTZ arbeiten
// Zeitzone explizit setzen
const appointment = {
  start_at: zonedTimeToUtc(combineDateAndTime(date, time), 'Europe/Berlin'),
  end_at: zonedTimeToUtc(combineDateAndTime(date, endTime), 'Europe/Berlin')
};
```

## Best Practices

### ✅ Beim Erstellen von Regelterminen
1. Vorlage zuerst speichern
2. Dann Termine generieren mit Transaction
3. Bei Fehler: Rollback der Vorlage UND Termine

### ✅ Beim Ändern eines Termins aus Serie
1. Prüfen ob `vorlage_id` existiert
2. Wenn ja: `ist_ausnahme = true` setzen
3. Grund dokumentieren in `ausnahme_grund`
4. Benutzer informieren: "Dieser Termin wird als Ausnahme markiert"

### ✅ Beim Löschen einer Vorlage
1. Benutzer warnen: "X Termine sind mit dieser Serie verknüpft"
2. Optionen anbieten:
   - Serie behalten (Termine werden zu Einzelterminen)
   - Serie komplett löschen (alle Termine löschen)

### ✅ Bei Anzeige im Kalender
```javascript
// Visuell unterscheiden
if (appointment.vorlage_id && !appointment.ist_ausnahme) {
  // Zeige Serien-Icon
  icon = <Repeat />
} else if (appointment.ist_ausnahme) {
  // Zeige Ausnahme-Icon
  icon = <AlertCircle />
}
```

## Performance-Optimierungen

### Index für schnelle Lookups
```sql
CREATE INDEX idx_termine_vorlage_id 
ON termine(vorlage_id) 
WHERE vorlage_id IS NOT NULL;

CREATE INDEX idx_termine_date_range 
ON termine(start_at, end_at);
```

### Batch-Insert optimieren
```javascript
// Statt einzelner INSERTs
const appointments = theoreticalDates.map(date => ({
  titel: template.titel,
  // ... weitere Felder
  vorlage_id: template.id
}));

// Ein einziger Batch-Insert
await supabase.from('termine').insert(appointments);
```

## Monitoring & Wartung

### Regelmäßige Checks
```sql
-- Finde Termine ohne Vorlage obwohl vorlage_id gesetzt
SELECT * FROM termine 
WHERE vorlage_id IS NOT NULL 
AND vorlage_id NOT IN (SELECT id FROM termin_vorlagen);

-- Finde inaktive Vorlagen mit zukünftigen Terminen
SELECT v.*, COUNT(t.id) as future_appointments
FROM termin_vorlagen v
LEFT JOIN termine t ON t.vorlage_id = v.id AND t.start_at > NOW()
WHERE v.ist_aktiv = false
GROUP BY v.id
HAVING COUNT(t.id) > 0;
```

## Zusammenfassung

Das System ist robust designt mit:
- Klarer Trennung zwischen Vorlage und Instanz
- Flexible Ausnahme-Behandlung
- Datenintegrität durch Foreign Keys
- Performance durch Indizes
- Sicherheit durch Validierungen

Die wichtigste Regel: **Bestehende Termine NIEMALS überschreiben, sondern nur fehlende hinzufügen!**
