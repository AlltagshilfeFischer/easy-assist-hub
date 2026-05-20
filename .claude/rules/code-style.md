# Code Style – Alltagshilfe Fischer

## Regex & Validierung
- **`\b` (Word-Boundary) NICHT mit optionalem Punkt kombinieren**: `\bDr\.?\b` matcht "Dr." NICHT,
  weil `.` kein `\w`-Zeichen ist — nach dem Punkt gibt es keinen `\w`→`\W`-Übergang mehr.
  Stattdessen: positional anchors verwenden, z.B. `(?:^|\s)Dr\.?\s` (Titel muss von Leerzeichen gefolgt werden).
- **Stilistische Validierungen nicht als Blocker einbauen**: Regeln wie "Mixed Case" oder "kein Allcaps"
  haben zu viele Ausnahmen (kurze Namen, internationale Namen, Abkürzungen) und frustrieren Nutzer.
  Nur Regeln mit klarer Semantik als harte Fehler behandeln (z.B. "kein Titel im Namensfeld").

## TypeScript
- **Kein `any`** — immer Typen aus `src/integrations/supabase/types.ts` oder `src/types/domain.ts`
- Interfaces ueber Type-Aliases fuer Objekte bevorzugen
- DB-Typen: `Database['public']['Tables']['tabelle']['Row']`
- Kein `as unknown as X` ohne Kommentar

## React
- Business-Logik in Custom Hooks, nicht in Render-Funktionen
- Max 5-6 einzelne `useState` — sonst Reducer oder Objekt
- `useMemo`/`useCallback` bei teuren Berechnungen
- Komponenten max ~150 Zeilen
- Kein `useEffect` fuer Daten-Fetching — TanStack Query nutzen

## Supabase
- Immer: `const { data, error } = await supabase...` dann `if (error) throw error`
- Kein silent swallow (`catch {}`)
- Query-Keys konsistent: `['termine']`, `['kunden']`, `['mitarbeiter']`
- `queryClient.invalidateQueries` nach Mutationen

## UI
- Nur shadcn/ui Komponenten
- Nur `lucide-react` Icons
- Nur Tailwind CSS (kein `style={{}}`)
- Toast: `import { toast } from 'sonner'`

## Error Handling
- User-Feedback: `toast.error(...)` oder `toast.success(...)`
- Unerwartete Fehler: `console.error(error)`
- Ladezustand: immer `isLoading` behandeln
- Leere Zustaende: nie leere Liste ohne Hinweis
