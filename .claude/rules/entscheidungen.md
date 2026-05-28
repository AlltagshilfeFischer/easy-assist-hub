# Architekturentscheidungen – Easy Assist Hub

Hier werden alle bewusst getroffenen Produkt- und Technikentscheidungen dokumentiert.
Jede Regel hat genau eine Quelle: eine explizite Absprache oder einen behobenen Bug.
Neue Entscheidungen bitte immer hier ergänzen (Datum + kurze Begründung).

---

## Dienstplan

### Mitarbeiter-Verfügbarkeit: Warnung, kein harter Blocker
**Entschieden:** Mai 2026

Liegt ein Termin außerhalb der hinterlegten Verfügbarkeitszeiten eines Mitarbeiters,
erscheint beim Speichern ein Bestätigungs-Dialog ("Trotzdem speichern" / "Abbrechen").
Der Termin wird **nicht** automatisch abgelehnt — die Planung bleibt flexibel.

Kein Verfügbarkeitseintrag = Mitarbeiter gilt als **nicht verfügbar** (Warnung erscheint ebenfalls).
Standard-Verfügbarkeit für neue Mitarbeiter: Mo–Fr 08:00–17:00 Uhr.

### Kunden-Zeitfenster-Präferenz: Nur Hinweis (kein Dialog)
**Entschieden:** Mai 2026

Hat ein Kunde eine Zeitfenster-Präferenz hinterlegt und der Termin liegt außerhalb,
wird ein **amber Badge** in den Termin-Dialogen angezeigt — kein Popup, kein Blocker.
Hat der Kunde keine Präferenz eingetragen, erscheint kein Badge (nicht gleichbedeutend
mit "überall verfügbar", sondern einfach keine Information vorhanden).

**Unterschied zur MA-Verfügbarkeit:** MA-Verletzung → Bestätigungs-Dialog (stärker).
Kunden-Präferenz → Stiller Hinweis (schwächer), weil Kundenwünsche keine Arbeitszeiten sind.

### Erstgespräch: Nur Geschäftsführer
**Entschieden:** Mai 2026

Erstgespräch-Termine können nur von Nutzern mit der Rolle `geschaeftsfuehrer`
(oder `globaladmin`) erstellt und per Drag & Drop bewegt werden. Mitarbeiter
sehen diese Termine, können sie aber nicht verändern oder auf sich ziehen.

### Zeitzone: Immer Europe/Berlin
**Entschieden:** Mai 2026

Alle Zeitberechnungen im Frontend nutzen `APP_TIMEZONE = 'Europe/Berlin'`
aus `src/lib/timezone.ts`. Alle Termine werden in der Datenbank als UTC (`TIMESTAMPTZ`)
gespeichert und erst bei der Anzeige in Berliner Zeit umgerechnet.
Niemals duplizierte Zeitzonenkonstanten einführen.

### Serien-Termine: Nur fehlende hinzufügen
**Goldene Regel (nie ändern)**

Beim Regenerieren einer Terminserie werden **niemals bestehende Termine überschrieben**.
Termine mit `ist_ausnahme = true` werden vollständig aus der Regenerierung ausgeschlossen.
Maximaler Vorlauf: 12 Monate.

---

## Leistungsnachweise

### LN nur für Kunden mit Terminen im Monat
**Entschieden:** April 2026

Ein Leistungsnachweis wird nur automatisch generiert, wenn der Kunde im gewählten
Monat mindestens einen abzurechnenden Termin hat. Für Kunden ohne Termine im Monat
wird kein LN erstellt — kein leerer "Phantom-LN".

### DB-Trigger verhindert LN ohne Termine
**Entschieden:** Mai 2026

Ein Datenbank-Trigger (`check_ln_has_termine`) blockiert jeden INSERT in die
`leistungsnachweise`-Tabelle, wenn kein passender Termin im gleichen Monat existiert.
Die Edge Function `generate-leistungsnachweise` ist deaktiviert (HTTP 410) — sie war
Quelle von 161 Phantom-LNs am 28.04.2026 und wird nicht mehr verwendet.

### Termine ohne Kunden-Zuordnung blockieren LN
**Entschieden:** Mai 2026

Termine ohne `kunden_id` (Erstgespräche, interne Termine) werden bei der
LN-Generierung übersprungen und lösen keinen Fehler aus.

---

## Abrechnung

### rechnungen-Tabelle: nicht verwenden
**Entschieden:** April 2026

Die Tabellen `rechnungen` und `rechnungspositionen` existieren noch im DB-Schema,
werden aber nicht mehr genutzt. Der **Leistungsnachweis IST das Abrechnungsdokument**,
das unterschrieben an die Pflegekasse geht. Kein neuer Code darf `rechnungen` anlegen
oder anzeigen.

### VP und Kombileistung: gesperrt bis Beantragung
**Entschieden:** Projektstart

Verhinderungspflege (§39) und Kombinationsleistung (§45a) sind per Default
für jeden Kunden deaktiviert. Sie werden erst freigeschaltet, wenn die Beantragung
abgeschlossen und das Genehmigungsdokument hochgeladen wurde.

### Kombileistung: ab Pflegegrad 2
**Entschieden:** Projektstart

Kombileistung ist für Kunden mit Pflegegrad 1 oder ohne Pflegegrad komplett
ausgeblendet und nicht buchbar.

---

## Stammdaten

### Titel/Präfix: nur bei Kunden
**Entschieden:** Mai 2026

Das Feld "Titel" (Dr., Prof. etc.) gibt es nur im Kunden-Formular, nicht im
Mitarbeiter-Formular. Mitarbeiter-Namen werden ohne Titelpräfix gespeichert.

### Interessent → Kunde: rückgängig machbar
**Entschieden:** Mai 2026

Eine versehentliche Konvertierung von Interessent zu Kunde kann rückgängig gemacht werden.
Die Funktion setzt alle kundenbezogenen Felder zurück und stellt den `interessent`-Status wieder her.

---

## Rollen & Berechtigungen

### Aktivitätslog: nur GlobalAdmin
Die Seite `/dashboard/controlboard/aktivitaetslog` ist ausschließlich für
Nutzer mit der Rolle `globaladmin` sichtbar und erreichbar.

### Admin-Rolle: wird nicht mehr vergeben
Die Rolle `admin` (ehemaliger Disponent) bleibt technisch im PostgreSQL-Enum,
wird aber an keine neuen Nutzer mehr vergeben und wird nirgends mehr geprüft.
Alle Disponenten-Rechte sind in `geschaeftsfuehrer` aufgegangen.

---

## Realtime

### Dienstplan: Live-Synchronisierung für alle
**Entschieden:** Mai 2026

Der Dienstplan-Kalender synchronisiert Änderungen in Echtzeit über Supabase Realtime
für alle eingeloggten Nutzer. Ladeanzeigen beim Realtime-Reload wurden entfernt —
Updates passieren still im Hintergrund ohne die Benutzeroberfläche zu unterbrechen.
