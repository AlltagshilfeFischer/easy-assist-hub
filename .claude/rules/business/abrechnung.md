# Abrechnungs-Regeln – Alltagshilfe Fischer

## Budget-Priorisierung

Standard-Reihenfolge (ueberschreibbar pro Kunde via abrechnungsregeln):
```
1. Kombileistung (§45a, monatlich, verfaellt)
2. Vorjahresrest Entlastung (FIFO, verfaellt 01.07.)
3. Verhinderungspflege (§39, jaehrlich, 3.539€)
4. Entlastungsbetrag (§45b, 131€/Monat)
5. Privat (Fallback, unbegrenzt)
```

## Steuerlogik

```
pflegegrad > 0  → 0% MwSt (§4 Nr. 16 UStG)
pflegegrad = 0 && leistungsart = 'privat' → 19% MwSt
```

## Leistungsnachweis = Kassenrechnung

**Der LN IST das Abrechnungsdokument das an die Pflegekasse geht** — kein separates Rechnungsdokument.
Unterschrieben vom Kunden + GF-Stempel → rechtswirksam fuer Kassenabrechnung.
Ein LN pro Kunde x Monat x Kostentraeger.

```
cb_entlastungsleistung   → §45b Entlastungsbetrag
cb_kombinationsleistung  → §45a Kombileistung
cb_verhinderungspflege   → §39 Verhinderungspflege
cb_haushaltshilfe        → §38 Haushaltshilfe (noch nicht implementiert)
cb_deckeln_45b           → §45b auf Betrag deckeln
ist_privat               → Privatrechnung (direkter Rechnungsempfaenger)

Status: entwurf → veroeffentlicht → unterschrieben → abgeschlossen
```

**rechnungen-Tabelle + Rechnungs-UI: NICHT MEHR VORHANDEN / NICHT VERWENDEN.**
Das DB-Schema hat noch Tabellen (rechnungen, rechnungspositionen) — diese sind veraltet und werden
nicht mehr genutzt. Kein Code schreiben der rechnungen erstellt oder anzeigt.

## Goldene Regeln

- Keine Doppelabrechnung: Ein Termin NIEMALS in zwei Toepfen voll berechnet
- Restbetrags-Split: Bei Budget < Einsatzkosten → splitten (z.B. 20€ Kasse + 19€ Privat)
- Nur 'completed' Termine sind abrechenbar
- 'abgesagt_rechtzeitig' Termine sind NICHT abrechenbar
- 'cancelled' (kurzfristig) Termine SIND abrechenbar
- Leistungsnachweis-Unterschrift ist Voraussetzung fuer Kassenabrechnung
