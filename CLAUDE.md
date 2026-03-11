# Easy Assist Hub – Claude Code Instructions

## Projektübersicht

**Alltagshilfe Fischer** – Care-Management-System für ambulante Pflegedienste.
Verwaltet Mitarbeiter, Kunden, Termine und Abrechnung.

- **Standorte:** Hannover, Hildesheim, Peine
- **Benutzerrollen:** `admin`, `geschaeftsfuehrer`, `mitarbeiter`
- **Sprache UI:** Deutsch | **Sprache Code:** Englisch

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite (Port 8080) |
| UI | shadcn/ui (Radix UI) + Tailwind CSS |
| State | TanStack React Query v5 + Context API |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |
| AI | OpenAI GPT-4o-mini via Supabase Edge Functions |
| Email | Resend API (Fallback: Supabase Auth) |
| DnD | @dnd-kit |
| Dates | date-fns (German locale) |

---

## Wichtige Datei-Pfade

```
src/
├── integrations/supabase/types.ts   # Generierte DB-Typen – IMMER nutzen
├── hooks/useAuth.tsx                # Auth Context
├── hooks/useUserRole.tsx            # Rollen & Permissions
├── hooks/useAppointments.ts         # Termin-Queries
├── types/domain.ts                  # Business Domain Types
└── pages/controlboard/
    └── ScheduleBuilderModern.tsx    # Haupt-Kalenderansicht

supabase/functions/
├── _shared/                         # Shared utilities (CORS, OpenAI, errors)
├── parse-appointment-text/          # AI: Text → Termin
├── parse-kunden-text/               # AI: Text → Kunden
├── parse-mitarbeiter-text/          # AI: Text → Mitarbeiter
├── suggest-employees/               # AI: Mitarbeiter-Matching
└── dashboard-assistant/             # AI: Chat-Assistent (SSE streaming)
```

---

## Code-Konventionen

### TypeScript
- **Kein `any`** – immer konkrete Typen aus `src/integrations/supabase/types.ts` oder `src/types/domain.ts`
- Interfaces über Type-Aliases für Objekte bevorzugen
- Supabase-generierte Typen mit `Database['public']['Tables']['tabelle']['Row']` nutzen

### React
- Business-Logik in Custom Hooks auslagern, nicht in Render-Funktionen
- Verwandte States als Reducer oder Objekt gruppieren (nicht 15+ einzelne `useState`)
- `useMemo`/`useCallback` bei teuren Berechnungen (Filter, Sortierung)
- Komponenten max. ~150 Zeilen – sonst aufteilen

### Error Handling
- **Nie silent swallow:** kein `catch (_) {}` oder leerer Catch-Block
- User-Feedback: immer `toast()` aus `sonner` oder `use-toast`
- Logging: `console.error()` für unerwartete Fehler
- Supabase: immer `const { data, error } = await supabase...` dann `if (error) throw error`

### Supabase Edge Functions
- **Shared Utilities** in `supabase/functions/_shared/utils.ts` nutzen für:
  - CORS Headers
  - OpenAI-Initialisierung
  - Standard-Error-Responses (429, 402, 500)
- Input immer validieren bevor Processing
- Keine internen Error-Messages direkt an den Client zurückgeben

### UI
- Ausschließlich shadcn/ui-Komponenten – keine eigenen UI-Primitives
- Tailwind CSS für Styling – keine `style={{}}`-Props ohne Tailwind
- Icons: nur `lucide-react`
- Toasts: `sonner` (nicht `use-toast` für neue Features)

---

## Datenbankarchitektur

### Termin-System (KRITISCH)
Zwei Typen:
- **Einzeltermine**: `vorlage_id = NULL` in `termine`
- **Regeltermine**: Template in `termin_vorlagen` → generiert Einträge in `termine`

**Goldene Regel:** Bestehende Termine NIEMALS überschreiben – nur fehlende hinzufügen!

```
ist_ausnahme = true  → manuell geänderte Serieninstanz → NICHT überschreiben
ist_ausnahme = false → normaler Serientermin
vorlage_id = NULL    → Einzeltermin
```

Mehr Details: `docs/TERMIN_SYSTEM_ARCHITECTURE.md`

### Rollen-Hierarchie
```
globaladmin > geschaeftsfuehrer > admin > mitarbeiter
```

### Kern-Tabellen
- `termine` – Einzelappointments
- `termin_vorlagen` – Wiederkehrende Vorlagen
- `mitarbeiter` – Mitarbeiter-Profile
- `kunden` – Kunden-Profile
- `benutzer` – Auth-verknüpfte User-Accounts
- `audit_log` – Sicherheits-Audit-Trail

---

## Entwicklungs-Workflow

```bash
npm run dev        # Dev-Server (Port 8080)
npm run build      # Production Build
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript-Check ohne Build
```

### Supabase Functions lokal testen
```bash
supabase functions serve <function-name> --env-file .env.local
```

---

## Regeln-Dateien

Detaillierte Regeln in:
- `.claude/rules/code-style.md` – TypeScript & allgemeine Code-Qualität
- `.claude/rules/frontend/react.md` – React-spezifische Patterns
