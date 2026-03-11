---
name: commit
description: Git-Commit für das Alltagshilfe Fischer Projekt erstellen mit deutschen Commit-Messages und Projektkonventionen.
disable-model-invocation: true
allowed-tools: Bash(git *)
---

# Commit erstellen

## Schritt 1: Status prüfen

```bash
git status
git diff --staged
git log --oneline -5
```

## Schritt 2: Dateien stagen

Nur relevante Dateien stagen – keine sensiblen Dateien (.env, secrets):

```bash
git add src/components/... src/hooks/... supabase/...
# NICHT: git add -A oder git add .
```

## Schritt 3: Commit-Message verfassen

**Sprache: Deutsch**
**Format:**

```
<typ>: <Kurzbeschreibung auf Deutsch>

[Optionaler längerer Beschreibungstext]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**Typen:**
| Typ | Bedeutung |
|-----|-----------|
| `feat` | Neue Funktion |
| `fix` | Bugfix |
| `refactor` | Refactoring ohne funktionale Änderung |
| `ui` | Nur UI/Style-Änderungen |
| `db` | Datenbankmigrationen |
| `chore` | Build, Konfiguration, Abhängigkeiten |
| `docs` | Dokumentation |

**Beispiele:**
```
feat: Dienstplan-Wochenansicht für Mitarbeiter hinzugefügt
fix: Regeltermin-Ausnahmen werden nicht mehr überschrieben
ui: Kalenderfarben für Standorte angepasst
db: Spalte 'farbe_kalender' zu kunden-Tabelle hinzugefügt
refactor: Termin-Hook in useAppointments ausgelagert
```

## Schritt 4: Commit ausführen

```bash
git commit -m "$(cat <<'EOF'
<typ>: <Beschreibung>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Wichtige Regeln

- KEINE Commits ohne explizite Aufforderung
- KEIN `--no-verify` (Hooks nicht überspringen)
- KEIN `git add -A` (versehentliche Dateien vermeiden)
- KEIN Force-Push auf main
- Bei fehlgeschlagenem Hook: Problem beheben, neuen Commit erstellen (KEIN --amend)
