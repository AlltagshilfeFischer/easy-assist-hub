

## Plan: Offline-faehige Unterschrift im Leistungsnachweis

### Ziel
Die Unterschrift-Funktion soll auch bei schlechtem/fehlendem Internet funktionieren. Die Signatur wird lokal zwischengespeichert und bei Reconnect automatisch synchronisiert.

### Aenderungen in `src/pages/controlboard/Leistungsnachweise.tsx`

**1. Online-Status-Tracking hinzufuegen**
- State `isOnline` mit `navigator.onLine` initialisieren
- `useEffect` mit `online`/`offline` Event-Listenern auf `window`
- Bei Reconnect: pruefen ob eine unsynchronisierte Unterschrift im `localStorage` liegt und automatisch hochladen

**2. Sign-Mutation offline-faehig machen**
- Beim Unterschreiben: Canvas-DataURL immer zuerst in `localStorage` speichern (Key: `pending_signature_${selectedLN.id}`)
- Wenn online: sofort in die Datenbank schreiben wie bisher, bei Erfolg localStorage-Eintrag loeschen
- Wenn offline: Toast zeigen "Unterschrift wird synchronisiert, sobald Internet verfuegbar", lokalen State updaten damit die UI die Unterschrift sofort anzeigt

**3. Auto-Sync bei Reconnect**
- `useEffect` der auf `isOnline` reagiert: wenn online und pending signatures im localStorage existieren, diese nacheinander hochladen
- Nach erfolgreichem Sync: localStorage-Eintrag loeschen, Toast "Unterschrift erfolgreich synchronisiert", Query invalidieren

**4. UI-Feedback**
- Kleines Badge/Banner im Unterschrift-Bereich wenn offline: "Offline-Modus - Unterschrift wird lokal gespeichert"
- Nach lokalem Speichern: Erfolgs-Toast mit Hinweis auf spaeteren Sync
- Pending-Indicator wenn unsynced Signatures vorhanden

### Keine DB-Aenderungen noetig
Die bestehenden Felder `unterschrift_kunde_bild`, `unterschrift_kunde_zeitstempel`, `unterschrift_kunde_durch` reichen aus.

### Umfang
- 1 Datei: `src/pages/controlboard/Leistungsnachweise.tsx`
- Aenderungen: ~60 Zeilen (Online-State, localStorage-Logik, Auto-Sync, UI-Feedback)

