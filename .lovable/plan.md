

# Leistungsnachweis-System: Aufgeteilte Implementierungs-Prompts

Deine Anforderungen sind komplex und umfassen mehrere Bereiche. Hier sind sie in **4 getrennte, aufeinander aufbauende Prompts** zerlegt:

---

## Prompt 1: Termin-Status erweitern (Basis)

**Ziel:** Neue Termin-Status-Typen einfuehren, die zwischen "nicht angetroffen" und "puenktlich abgesagt" unterscheiden.

**Was gemacht wird:**
- Datenbank-Enum `termin_status` um zwei Werte erweitern: `nicht_angetroffen` (eigenverschuldet durch Kunden, wird abgerechnet) und `abgesagt_rechtzeitig` (korrekt abgesagt, nur Info, keine Abrechnung)
- Kalender-Ansicht und Termin-Detail-Dialog aktualisieren: farbliche Labels und Icons fuer die neuen Status
- Der bestehende "Nicht geklappt zuschulden des Kunden"-Dialog wird auf den neuen Status `nicht_angetroffen` umgestellt
- Neuer Button "Rechtzeitig abgesagt" neben dem bestehenden Absage-Button

---

## Prompt 2: Leistungsnachweis-Tabelle und Datenmodell

**Ziel:** Datenbank-Tabelle `leistungsnachweise` erstellen und Grundlogik implementieren.

**Was gemacht wird:**
- Neue Tabelle `leistungsnachweise` mit: Kunde, Monat/Jahr, geplante Stunden, geleistete Stunden, Status (entwurf/offen/unterschrieben/abgeschlossen), abweichende Rechnungsadresse (Boolean + Adressfelder), privat (Boolean), Empfaenger-Info (Kostentraeger-Referenz oder Privatperson), Unterschrift-Daten (Zeitstempel, digital signiert durch), vorausgefuellte GF-Unterschrift (Template-Feld)
- RLS-Policies: Admins voll, Mitarbeiter koennen Leistungsnachweise ihrer (jemals) zugeordneten Kunden lesen
- Automatische Generierung: Pro Kunde pro Monat wird ein Leistungsnachweis erstellt, der alle Termine des Monats aggregiert

---

## Prompt 3: Leistungsnachweis-UI (Controlboard-Seite)

**Ziel:** Neue Seite "Leistungsnachweise" im Controlboard mit Uebersicht und Detail-Ansicht.

**Was gemacht wird:**
- Neuer Sidebar-Eintrag "Leistungsnachweise" im Controlboard
- Uebersichtsseite: Gruppiert nach Kunde, pro Kunde pro Monat ein Block mit allen Terminen (Status-Labels: stattgefunden, nicht angetroffen, rechtzeitig abgesagt)
- Detail-Ansicht pro Leistungsnachweis: geplante vs. geleistete Stunden, Termin-Liste, Checkbox "Abweichende Rechnungsadresse" (zeigt Adressfelder wenn aktiviert), Checkbox "Privat" (aendert Empfaenger auf Privatperson statt Kasse)
- PDF-/Druck-Ansicht des Leistungsnachweises mit vorausgefuellter GF-Unterschrift

---

## Prompt 4: Unterschrift-Flow (Mitarbeiter-Ansicht)

**Ziel:** Separater Unterschrift-Bildschirm fuer den Mitarbeiter vor Ort beim Kunden.

**Was gemacht wird:**
- Mitarbeiter-Dashboard: Bereich "Leistungsnachweise" zeigt alle Kunden, mit denen der Mitarbeiter je Kontakt hatte
- Unterschrift-Screen (separate Ansicht, nicht auf dem Dokument): Text "Ich bestaetige, dass folgende Termine stattgefunden haben..." mit Auflistung der bisherigen und geplanten Termine des aktuellen Monats
- Touch-faehiges Unterschriftfeld (Canvas-basiert)
- Nach Unterschrift: Status des Leistungsnachweises auf "unterschrieben" setzen, Unterschrift-Bild speichern

---

## Technische Abhaengigkeiten

```text
Prompt 1 (Status-Erweiterung)
    |
    v
Prompt 2 (Datenmodell)
    |
    v
Prompt 3 (Admin-UI)  +  Prompt 4 (Mitarbeiter-Unterschrift)
         (parallel moeglich)
```

## Empfohlene Reihenfolge

Prompt 1 zuerst ausfuehren, da alle weiteren Schritte auf den erweiterten Termin-Status aufbauen. Danach Prompt 2 fuer das Datenmodell. Prompts 3 und 4 koennen danach in beliebiger Reihenfolge umgesetzt werden.

Soll ich mit **Prompt 1** (Termin-Status erweitern) beginnen?
