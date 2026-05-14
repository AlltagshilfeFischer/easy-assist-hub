# Abrechnungs-Regeln – Alltagshilfe Fischer

## Budget-Priorisierung (Korrekte Reihenfolge)

Standard-Reihenfolge (ueberschreibbar pro Kunde via abrechnungsregeln):
```
0. Haushaltshilfe-Verordnung (§38) — wenn aktive Verordnung vorhanden, geht ALLES darueber
1. Angesparter Entlastungsbetrag (§45b) > 500€ — automatisch abrechnen
2. Verhinderungspflege (§39) — 3.539€/Jahr, nur nach Beantragung verfuegbar
3. Monatlicher Entlastungsbetrag (§45b) — 131€/Monat, Standardwert konservativ
4. Kombinationsleistung (§45a) — nur ab PG2, nur nach Beantragung verfuegbar
5. Privat (Fallback, unbegrenzt)
```

**WICHTIG:** Verhinderungspflege und Kombinationsleistung sind NICHT automatisch verfuegbar.
Sie muessen beantragt werden — die Dokumente werden im Dokumententeil der Software hinterlegt.
Standard-Einstellung: nicht verfuegbar, bis manuell freigeschaltet.

## Kombinationsleistung (§45a)

- **Nur ab Pflegegrad 2** — bei PG1 komplett deaktiviert/nicht anzeigen
- 40% der Pflegesachleistung wird in Entlastungsbetrag umgewandelt
- Betraege nach Pflegegrad:

| Pflegegrad | Pflegesachleistung | Kombileistungs-Anteil (40%) |
|------------|-------------------|------------------------------|
| PG 1       | –                 | nicht verfuegbar             |
| PG 2       | 796,00 €          | 318,40 €                    |
| PG 3       | 1.497,00 €        | 598,80 €                    |
| PG 4       | 1.859,00 €        | 743,60 €                    |
| PG 5       | 2.299,00 €        | 916,60 €                    |

- Manuelle Anpassung muss moeglich sein (Pflegedienst koennte >60% abrufen → Engpass;
  oder Kunde moechte Pflegegeld-Kuerzung minimieren)
- Meist nur anteilig genutzt (z.B. 131€ EB + Rest Kombileistung)

## Verhinderungspflege (§39)

- Standard: 3.539€/Kalenderjahr
- Nur nach Beantragung verfuegbar (Default: gesperrt)
- Manchmal muss Betrag angepasst werden wenn Angehoerige den Topf ebenfalls nutzen
- Manuelle Anpassung muss moeglich sein

## Entlastungsbetrag (§45b)

- 131€/Monat — Standard-Einstellung (konservativ gewahlt)
- Verfaellt: angesparter Vorjahresbetrag verfaellt am 01.07. des Folgejahres
  (Stand im Juli typischerweise: 6 × 131 = 786€ — das ist der Anteil seit Januar, der NICHT verfaellt)
- **Automatische Abrechnung:** Wenn angesparter Betrag > 500€, wird automatisch abgerechnet
  (500€ = Sicherheitspuffer, eigentliche Verfalls-Grenze waere 786€)
- Muss im Erstgespraech abgefragt werden — Budgetabfrage als Teil der Kunden-Anlage-Maske

## Haushaltshilfe (§38)

- Kein Geldbetrag — sondern **Stundenkontingent** auf Basis einer aerztlichen Verordnung
- Parameter pro Verordnung:
  - Gueltigkeit: exaktes Start- und Enddatum (z.B. 03.06.–28.06.)
  - Termine/Woche: Standard 3x
  - Max. Termindauer: Standard 2 Stunden (Abrechnung 2h, tatsaechlich oft 1,5h)
- Bei Verordnungsende mitten im Monat: **zwei separate Abrechnungen**
  - Verordnungszeitraum: ueber Haushaltshilfe-Verordnung abrechnen
  - Restlicher Monat: ueber normale Budgets / Privat abrechnen
- Wenn Verordnung aktiv: NUR darueber abrechnen (hat hoechste Prioritaet)

## Privatzahlungen

Unterschied zwischen zwei Faellen:

**1. Reine Privatzahler** (kein Pflegegrad / keine Kasse)
- Abrechnung mit Satz fuer Entlastungsleistungen
- Keine Kassenabrechnung

**2. Privatversicherte** (private Kranken-/Pflegeversicherung)
- LN wird wie Kassenabrechnung erstellt (Kreuz auf dem LN), mit Vermerk "privat"
- Rechnung geht zum Kunden (nicht direkt an Kasse)
- Muss eindeutig hervorgehen:
  1. Rechnung geht nach Hause zum Kunden
  2. Welcher Betrag wird abgerechnet (VP-Satz unterscheidet sich von anderen Budgets!)
  3. Ueber welchen Topf die Kasse dem Kunden erstatten soll

## Steuerlogik

```
pflegegrad > 0  → 0% MwSt (§4 Nr. 16 UStG)
pflegegrad = 0 && leistungsart = 'privat' → 19% MwSt
```

## Fahrtkostenpauschale

Aktuell: 6€ | Geplante Erhoehung auf 7€ — Kunde gibt Bescheid wenn durch.

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
- VP + Kombileistung: nie ohne Beantragung aktiv schalten
