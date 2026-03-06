

## Plan: Dokumentenverwaltung - Suche und Upload reparieren

### Gefundene Probleme

**Problem 1: Suchfeld-Kollision**
Die Sidebar-Suche (Kunde/Mitarbeiter filtern, Zeile 861) und die Dokumenten-Suche (Zeile 953) teilen denselben State `searchQuery`. Wenn man in der Sidebar einen Kundennamen sucht, filtert das gleichzeitig die Dokumente -- und umgekehrt. Die Sidebar-Entities werden gar nicht gefiltert, da `searchQuery` nur im `entityDocuments`-useMemo auf Dokumente angewandt wird. Die Entity-Liste zeigt immer alle Eintraege.

**Problem 2: Dokumenten-Suche nur bei "intern" sichtbar**
Das Dokumenten-Suchfeld (Zeile 947-957) wird nur angezeigt wenn `activeTab === 'intern'`. Bei Kunde/Mitarbeiter-Tabs gibt es kein Suchfeld fuer Dokumente -- nur das Sidebar-Suchfeld, das faelschlicherweise Dokumente filtert statt Entities.

**Problem 3: Upload -- kein offensichtlicher Code-Bug sichtbar**
Die Upload-Logik (Zeilen 225-350) sieht korrekt aus: Storage-Upload + Metadaten-Insert. Potenzielle Probleme: Storage-Bucket-Berechtigungen oder RLS auf der `dokumente`-Tabelle. Der Code selbst ist funktional. Ich pruefe das genauer und stelle sicher, dass Fehlermeldungen korrekt angezeigt werden.

### Aenderungen

**`src/pages/controlboard/Dokumentenverwaltung.tsx`**

1. **Neuen State `entitySearchQuery` einfuehren** -- getrennt von `searchQuery` (das fuer Dokumente bleibt)
2. **Sidebar-Entity-Liste filtern** mit `entitySearchQuery`: Kunden/Mitarbeiter-Liste im Sidebar nach Name filtern
3. **Sidebar-Suchfeld** auf `entitySearchQuery` umverdrahten
4. **Dokumenten-Suchfeld immer anzeigen** -- nicht nur bei `intern`, sondern auch bei Kunde/Mitarbeiter-Tabs (im rechten Panel-Header)
5. **Tab-Wechsel**: Beide Suchfelder zuruecksetzen
6. **Upload-Fehlerbehandlung verbessern**: Detailliertere Fehlermeldungen bei Storage- und RLS-Fehlern ausgeben, damit der Nutzer sehen kann was schiefgeht

### Keine DB-Aenderungen noetig

