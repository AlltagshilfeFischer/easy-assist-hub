

## Plan: Kundendetails fuer Geschaeftsfuehrer erweitern

### Ansatz
Neuen `KundenDetailDialog` erstellen, der alle relevanten Informationen auf einen Blick zeigt - inklusive Abrechnungsdaten, die der Mitarbeiter-Dialog (`KundenInfoDialog`) bewusst ausschliesst. Der Dialog wird von zwei Stellen aus aufrufbar: (1) AppointmentDetailDialog im Dienstplan, (2) CustomerTable in der Kundenuebersicht.

### Aenderungen

**1. Neue Komponente `src/components/customers/KundenDetailDialog.tsx`**
- Umfassender Dialog mit Tabs oder Accordion-Sektionen:
  - **Stammdaten**: Vorname, Nachname, Kundennummer, Geburtsdatum, Geschlecht, Kategorie, Adresse (mit Google Maps Link), Telefon, E-Mail, Kontaktweg
  - **Pflege & Versicherung**: Pflegegrad, Pflegekasse, Versichertennummer, Kasse/Privat
  - **Abrechnung**: Verhinderungspflege (aktiv/beantragt/genehmigt/Budget), Pflegesachleistung (aktiv/beantragt/genehmigt), Budget-Prioritaet (Reihenfolge), Stundenkontingent
  - **Zeitfenster**: Aus `kunden_zeitfenster` geladen (wie im KundenInfoDialog)
  - **Notfallkontakte**: Aus `notfallkontakte` geladen
  - **Hauptbetreuer**: Aus `mitarbeiter` via `kunden.mitarbeiter` FK geladen (Name anzeigen)
  - **Aktive Leistungen**: Aus `leistungen` geladen (Art, Status, Kontingent, Gueltigkeitszeitraum)
  - **Besondere Hinweise**: Feld `sonstiges`
- Daten werden per Supabase-Queries beim Oeffnen geladen (Kunde komplett, Notfallkontakte, Zeitfenster, Leistungen, Hauptbetreuer)
- Props: `{ isOpen, onClose, kundenId: string }`

**2. `src/components/schedule/dialogs/AppointmentDetailDialog.tsx`**
- Button "Kundendetails anzeigen" im Kundeninfo-Block hinzufuegen
- Oeffnet `KundenDetailDialog` mit der `kunden_id` des Termins
- Nur sichtbar fuer GF/Admin (via `useUserRole`)

**3. `src/components/customers/CustomerTable.tsx`**
- Neuen Button (Auge/Info-Icon) pro Zeile hinzufuegen neben dem Edit-Button
- Props erweitern: `onViewDetail: (customerId: string) => void`

**4. `src/pages/controlboard/MasterData.tsx`**
- State fuer `KundenDetailDialog` (selectedDetailId)
- `KundenDetailDialog` rendern, Callback an CustomerTable uebergeben

### Keine DB-Aenderungen noetig
Alle Tabellen und RLS-Policies existieren bereits. GF/Admin hat Lesezugriff auf alle relevanten Tabellen.

