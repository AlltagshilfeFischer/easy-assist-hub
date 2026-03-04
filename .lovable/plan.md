

## Plan: Druckfunktion basierend auf der Vorlage "Leistungsnachweis Alltagshilfe Fischer" umbauen

### Vorlage-Analyse (aus dem Foto)

Das Dokument enthaelt folgende Bereiche:
1. **Kopf**: "Leistungsnachweis Alltagshilfe Fischer" + Logo "Alltagshilfe Fischer" (rechts oben)
2. **Kundendaten**: Leistungsnehmer, Adresse, Geburtsdatum, Pflegekasse, Vers. Nr., Pflegegrad, Monat
3. **Termintabelle**: Zwei Spalten nebeneinander (Tag 01-15 links, Tag 16-31 rechts), jeweils mit "Tag | Uhrzeit | Std"
4. **USt-Hinweis**: "Die Leistungen sind nach §4 Nr. 16 Buchst. g UstG von der Umsatzsteuer befreit."
5. **Leistungsart-Checkboxen**: Kombinationsleistung §38 SGB XI, Entlastungsleistung §45b SGB XI, Verhinderungspflege §39 SGB XI, Haushaltshilfe §38 SGB XI, Deckeln §45b ___ EUR Rest privat
6. **Privat-Checkbox** + **Abweichende Adresse-Checkbox**
7. **Abtretungserklaerung**: Rechtstext zur Abrechnung mit Pflegekasse
8. **Unterschriften**: "Handzeichen" (links) + "Unterschrift Leistungsnehmer" (rechts)
9. **Fusszeile**: Firmenadresse, Bankdaten, IK-Nummer

### Technische Umsetzung

**1. Neue Datei: `src/components/leistungsnachweis/LeistungsnachweisPreview.tsx`**

Eine reine Print-Vorschau-Komponente die das Dokument exakt nachbaut:
- A4-Layout mit `@media print` CSS
- Kundendaten aus `kunden`-Tabelle (vorname, nachname, adresse, geburtsdatum, pflegekasse, versichertennummer, pflegegrad)
- Termintabelle: Tage 01-31 aufgeteilt in zwei Spalten, befuellt mit Termine-Daten (Uhrzeit + Stunden)
- Checkboxen fuer Leistungsarten (aus `leistungsnachweise`-Flags bzw. Kunden-Daten)
- Privat/Abweichende Adresse Checkboxen (aus `leistungsnachweise`)
- Unterschriftsfelder mit gespeicherter Signatur (`unterschrift_kunde_bild`)
- Feste Firmendaten im Footer

**2. Aenderung in `src/pages/controlboard/Leistungsnachweise.tsx`**

- Detail-Panel: Drucker-Button oeffnet einen Fullscreen-Dialog mit `LeistungsnachweisPreview`
- Erweiterte Kunden-Query: Zusaetzlich `adresse, geburtsdatum, pflegekasse, versichertennummer` laden
- Print-Button ruft `window.print()` auf waehrend der Dialog offen ist (nur Dialog-Inhalt druckt)

**3. Print-CSS in `src/index.css`**

- `@media print` Regeln: Alles ausser `.print-area` ausblenden
- A4-Seitenformat, Raender, Schriftgroessen
- Tabellen-Rahmen fuer sauberen Druck

### Datenfluss

```text
Kunden-Tabelle ──┐
                  ├──▶ LeistungsnachweisPreview
Termine-Query ────┤        (A4 Print Layout)
                  │            │
LN-Row ───────────┘       window.print()
```

### Details der Termintabelle

- 31 Zeilen, aufgeteilt: Links Tag 01-15, Rechts Tag 16-31
- Pro Tag: Uhrzeit (z.B. "09:00-11:00") und Stunden (z.B. "2,0")
- Nur Tage mit Terminen werden befuellt, Rest bleibt leer
- Termine mit Status `cancelled` oder `abgesagt_rechtzeitig` werden uebersprungen oder markiert

