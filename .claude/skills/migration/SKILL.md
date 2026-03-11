---
name: migration
description: Supabase-Datenbankmigration erstellen und anwenden im Alltagshilfe Fischer Projekt. Verwenden bei neuen Tabellen, Spalten, Indizes, RLS-Policies oder Enum-Änderungen.
disable-model-invocation: true
allowed-tools: Bash(supabase *), Bash(npx supabase *), Bash(bun *)
argument-hint: "[Beschreibung der Änderung]"
---

# Datenbankmigration – $ARGUMENTS

## Schritt 1: Migration erstellen

```bash
supabase migration new <name_der_aenderung>
# Beispiele:
# supabase migration new add_notizen_to_kunden
# supabase migration new create_dokumente_table
# supabase migration new add_index_termine_start_at
```

Erzeugt: `supabase/migrations/<timestamp>_<name>.sql`

## Schritt 2: SQL schreiben

### Neue Spalte

```sql
-- Immer IF NOT EXISTS / IF EXISTS für Idempotenz
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS notizen TEXT;
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS interne_bemerkung TEXT DEFAULT '';
```

### Neue Tabelle mit RLS

```sql
CREATE TABLE IF NOT EXISTS neue_tabelle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fremdschlüssel
  kunden_id UUID REFERENCES kunden(id) ON DELETE CASCADE,
  mitarbeiter_id UUID REFERENCES mitarbeiter(id) ON DELETE SET NULL,
  -- Felder
  inhalt TEXT NOT NULL,
  erstellt_am TIMESTAMPTZ DEFAULT now(),
  -- Audit
  erstellt_von UUID REFERENCES auth.users(id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_neue_tabelle_kunden ON neue_tabelle(kunden_id);

-- RLS aktivieren
ALTER TABLE neue_tabelle ENABLE ROW LEVEL SECURITY;

-- Policies (Muster – anpassen!)
CREATE POLICY "Admins können alles" ON neue_tabelle
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Mitarbeiter lesen eigene" ON neue_tabelle
  FOR SELECT USING (
    mitarbeiter_id IN (
      SELECT id FROM mitarbeiter WHERE benutzer_id = auth.uid()
    )
  );
```

### Neues ENUM

```sql
-- Neuen Wert zu bestehendem Enum hinzufügen
ALTER TYPE termin_status ADD VALUE IF NOT EXISTS 'pausiert';
-- ACHTUNG: Enum-Werte können nicht entfernt werden!
```

### Index hinzufügen

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_termine_vorlage
  ON termine(vorlage_id)
  WHERE vorlage_id IS NOT NULL;
```

## Schritt 3: Lokal testen

```bash
supabase db reset          # Komplett neu initialisieren (Vorsicht: löscht Daten!)
# ODER nur neue Migration anwenden:
supabase migration up
```

## Schritt 4: TypeScript-Typen regenerieren

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Danach TypeScript-Check:
```bash
npx tsc --noEmit
# oder: npm run lint
```

## Schritt 5: Production deployen

```bash
supabase db push
```

## RLS-Muster für dieses Projekt

```sql
-- Helper-Funktion nutzen
public.is_admin(auth.uid())       -- true für admin/geschaeftsfuehrer/globaladmin
public.get_user_rolle(auth.uid()) -- gibt Rolle als Text zurück

-- Mitarbeiter findet seine eigene ID
SELECT id FROM mitarbeiter WHERE benutzer_id = auth.uid()

-- Standard-Policies:
-- Admin: FOR ALL USING (public.is_admin(auth.uid()))
-- Mitarbeiter lesen: FOR SELECT USING (mitarbeiter_id = (SELECT id FROM mitarbeiter WHERE benutzer_id = auth.uid()))
-- Mitarbeiter schreiben: FOR INSERT WITH CHECK (...)
```

## Checkliste

- [ ] Migration-Datei in `supabase/migrations/` erstellt
- [ ] SQL ist idempotent (IF NOT EXISTS / IF EXISTS)
- [ ] RLS aktiviert und Policies erstellt
- [ ] Indizes für Fremdschlüssel gesetzt
- [ ] `supabase gen types` ausgeführt → `types.ts` aktualisiert
- [ ] TypeScript-Fehler geprüft (`npx tsc --noEmit`)
- [ ] Lokal getestet
- [ ] Commit: `db: <Beschreibung der Migration>`

## Wichtig

- NIEMALS `DROP TABLE` oder `DROP COLUMN` ohne explizite Bestätigung
- ENUMs: Werte können nur hinzugefügt, nicht entfernt werden
- `CONCURRENTLY` bei Indizes auf großen Tabellen (verhindert Lock)
- Migration-Dateien NIEMALS nachträglich bearbeiten – neue Migration erstellen
