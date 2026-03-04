

## Plan: Leistungsnachweis-Preview umbauen

### Anforderungen
1. Preview breiter/groesser darstellen - fullscreen Dialog statt max-w-2xl
2. Nur Termine des Monats anzeigen (geplante + vergangene, keine abgesagten)
3. Link zum Dienstplan einbauen (nicht stoerend)
4. Unterschrift direkt in der Preview erfassen (Canvas-Feld), nicht im Druckdokument
5. Unterschrift wird ins Druckdokument uebertragen, dann ist es fertig

### Aenderungen

**1. `src/pages/controlboard/Leistungsnachweise.tsx`**

- Detail-Dialog von `max-w-2xl` auf `max-w-5xl` (oder fullscreen) aendern
- Terminliste breiter darstellen mit mehr Spalten (Datum, Zeit, MA, Status, Stunden)
- Link zum Dienstplan hinzufuegen: kleiner Button/Link unter der Terminliste mit `react-router-dom` Link zu `/dashboard/dienstplan` mit Query-Param fuer die richtige Woche
- Unterschrift-Canvas direkt in den Detail-Dialog einbauen (unterhalb der Terminliste):
  - Canvas-Zeichenfeld (wie in `LeistungsnachweisSignature.tsx`)
  - "Unterschreiben"-Button speichert die Signatur als Base64 in `unterschrift_kunde_bild` + setzt `unterschrift_kunde_zeitstempel` und `unterschrift_kunde_durch`
  - Nur anzeigen wenn Status `veroeffentlicht` (bereit zur Unterschrift)
  - Nach Unterschrift wird Status auf `unterschrieben` gesetzt
- Druckvorschau-Dialog bleibt, zeigt die gespeicherte Unterschrift automatisch an

**2. `src/components/leistungsnachweis/LeistungsnachweisPreview.tsx`**

- Keine Aenderungen noetig - zeigt bereits `unterschrift_kunde_bild` an
- Die Unterschrift kommt jetzt aus dem Detail-Dialog statt aus dem Druckdokument

**3. Workflow-Zusammenfassung**

```text
Admin oeffnet Nachweis
    → Breiter Detail-Dialog mit Terminuebersicht
    → Link zum Dienstplan zur Kontrolle
    → Mitarbeiter geht mit Preview zum Kunden
    → Kunde sieht Termine, unterschreibt im Canvas
    → Unterschrift wird gespeichert
    → Drucken erzeugt fertiges Dokument mit Unterschrift
```

### Umfang
- 2 Dateien: `Leistungsnachweise.tsx` (Detail-Dialog umbauen, Canvas hinzufuegen, Dienstplan-Link) und ggf. kleinere Anpassungen an `LeistungsnachweisPreview.tsx`

