

## Plan: Bestehenden "Mitarbeiter anlegen"-Dialog durch SmartDataImport ersetzen + Build-Fehler beheben

### Ueberblick
Der bestehende `AddMitarbeiterDialog` (Zeilen 1015-1377 in `BenutzerverwaltungNeu.tsx`) wird durch eine neue `MitarbeiterSmartImport`-Komponente ersetzt, die das bewährte `SmartDataImport`-Spreadsheet-System nutzt (wie bei `KundenSmartImport`). Es gibt weiterhin nur **einen** "Mitarbeiter anlegen"-Button.

### Aenderungen

**1. Neue Datei: `src/components/import/MitarbeiterSmartImport.tsx`**
- Nutzt `SmartDataImport<MitarbeiterRow>` (wie `KundenSmartImport`)
- Spalten: Vorname (Pflicht), Nachname (Pflicht), Telefon, Strasse, PLZ (5-Ziffern-Validierung), Stadt, Zustaendigkeitsbereich, Soll-Wochenstunden (numerische Validierung), Qualifikation, Beschaeftigungsart
- Duplikatspruefung auf Vorname + Nachname gegen DB
- `batchSize: 200`, `initialRowCount: 50`
- KI-Parsing via `aiParseFunction="parse-mitarbeiter-text"`, `aiParseResultKey="mitarbeiter"`
- Nach Import: `queryClient.invalidateQueries({ queryKey: ['mitarbeiter'] })` + `onSuccess` Callback

**2. `src/pages/controlboard/BenutzerverwaltungNeu.tsx`**
- Den alten `AddMitarbeiterDialog` (Zeilen 1015-1377) komplett entfernen
- Stattdessen `MitarbeiterSmartImport` importieren und an gleicher Stelle einbinden
- Button bleibt gleich: "Mitarbeiter anlegen" oeffnet jetzt den SmartImport-Dialog
- Hilfscode (`ManualRow`, `VerfuegbarkeitSlot`, `emptyRow`, `formatVerfuegbarkeit`) wird nicht mehr benoetigt

**3. Build-Fehler beheben (15 Fehler)**

Edge Functions -- `(error as Error).message` in 9 Dateien:
- `approve-benutzer`, `create-user-manual`, `delete-mitarbeiter`, `force-signout`, `parse-kunden-text`, `parse-mitarbeiter-text`, `parse-time-windows`, `reject-benutzer`, `send-email`, `suggest-employees`

`batch-billing/index.ts`:
- Zeile 200: `as unknown as TerminForBilling[]`
- Zeile 202/214: `(leistungen as any[]).filter(...)` / `.find(...)`
- Zeile 231: `(matchingLeistung as any).kostentraeger?.typ`
- Zeile 397: `.catch()` durch try/catch ersetzen

