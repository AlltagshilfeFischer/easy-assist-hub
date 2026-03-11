---
name: review
description: Code-Review für das Alltagshilfe Fischer Projekt. Checkliste für TypeScript, React, Supabase und projektspezifische Konventionen prüfen.
disable-model-invocation: true
argument-hint: "[Datei oder Komponente]"
---

# Code-Review – $ARGUMENTS

Geänderte Dateien prüfen (`git diff HEAD`) und anhand dieser Checkliste reviewen.

## TypeScript

- [ ] Kein `any` – nur konkrete Typen aus `types.ts` oder `domain.ts`
- [ ] Supabase-Typen genutzt: `Database['public']['Tables']['x']['Row']`
- [ ] Interfaces statt Type-Aliases für Objekte
- [ ] Keine `as unknown as X`-Casts ohne Kommentar warum

## React

- [ ] Business-Logik in Custom Hook, nicht direkt in Komponente
- [ ] Nicht mehr als 5–6 einzelne `useState` – ggf. als Objekt/Reducer
- [ ] `useMemo`/`useCallback` bei teuren Berechnungen (Filter, Sortierung > 100 Elemente)
- [ ] Komponente ≤ ~150 Zeilen – ggf. aufteilen
- [ ] Kein `useEffect` für Daten-Fetching – TanStack Query nutzen

## Supabase / Datenbankzugriff

- [ ] Immer `const { data, error } = await supabase...` dann `if (error) throw error`
- [ ] Kein silent swallow: kein leerer `catch {}` Block
- [ ] Query-Keys konsistent: `['termine']`, `['kunden']`, `['mitarbeiter']`
- [ ] `queryClient.invalidateQueries` nach Mutationen aufgerufen
- [ ] RLS beachtet: Tabellen mit sensiblen Daten haben Policies

## Termin-System (falls betroffen)

- [ ] `ist_ausnahme = true` Termine werden NICHT überschrieben
- [ ] Einzeltermin: `vorlage_id = null` gesetzt
- [ ] Regeltermin-Generierung prüft auf bereits existierende Termine
- [ ] Zeitzone: `Europe/Berlin` → UTC für DB-Speicherung

## UI / Styling

- [ ] Nur `shadcn/ui`-Komponenten – keine eigenen Primitives (kein raw `<input>`)
- [ ] Nur `lucide-react` Icons
- [ ] Kein `style={{}}` ohne Not – nur Tailwind
- [ ] Toast: `import { toast } from 'sonner'` (nicht `use-toast`)

## Fehlerbehandlung

- [ ] User-Feedback bei Fehlern: `toast.error(...)`
- [ ] Unerwartete Fehler: `console.error(error)`
- [ ] Ladezustand behandelt (`isLoading`, Skeleton oder Spinner)
- [ ] Leere Zustände behandelt (keine leere Liste ohne Hinweis)

## Sicherheit

- [ ] Kein direkter User-Input in SQL (Supabase-Client verhindert das, aber prüfen)
- [ ] Kein Hardcoded Secret / API-Key
- [ ] Edge Functions: Input validiert bevor Verarbeitung
- [ ] Rollen-Schutz für Admin-Funktionen: `useUserRole()` prüfen

## Rollen-Schutz

```typescript
import { useUserRole } from '@/hooks/useUserRole';
const { isAdmin, isGeschaeftsfuehrer } = useUserRole();
// Sensible Aktionen (Löschen, Preise, etc.) nur für Admins freigeben
```

## Performance

- [ ] Listen mit `key={item.id}` (keine Index-Keys bei sortierbaren Listen)
- [ ] Keine unnötigen Re-Renders durch neue Objekt-Referenzen in Render
- [ ] Große Datensätze: Pagination oder virtuelles Scrollen vorhanden?

## Schnell-Commands

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript ohne Build
git diff HEAD         # Was wurde geändert?
git diff HEAD --stat  # Welche Dateien?
```
