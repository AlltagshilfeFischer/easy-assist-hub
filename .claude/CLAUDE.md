# Easy Assist Hub

**Alltagshilfe Fischer GbR** — Care-Management fuer ambulante Alltagshilfe.
Standort: Hannover. Migration von Lovable abgeschlossen (Apr 2026).
Sprache UI: Deutsch | Code: Englisch

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite 5 (Port 8080) |
| UI | shadcn/ui (Radix UI) + Tailwind CSS 3 |
| Routing | React Router v6 (client-side, **kein Next.js**) |
| State | TanStack React Query v5 + Context API |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) — extern gehostet |
| Hosting | Vercel (GitHub: AlltagshilfeFischer/easy-assist-hub) |
| DnD | @dnd-kit |
| Dates | date-fns v4 (de locale) |
| Charts | recharts |

**Path Alias:** `@` → `src/`
**Env (Vercel + lokal):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
**Supabase Secrets (Edge Functions):** `OPENAI_API_KEY`, `RESEND_API_KEY`, `MASTER_ADMIN_PASSWORD`, `SITE_URL`

> **WICHTIG:** Dies ist eine **Vite SPA** — kein Next.js, kein App Router.
> `"use client"`, `"use server"`, Server Components, `getServerSideProps` — alles irrelevant und verboten.
> Alle Komponenten sind Client-Komponenten by default.

## Commands

```bash
npm run dev        # Port 8080
npm run build      # Production
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript-Check
```

## Architektur

Provider-Reihenfolge: `AuthProvider → ForcePasswordChange → QueryClientProvider → BrowserRouter → Routes`

### Routing

```
/                       → Login
/dashboard              → DashboardHome
/dashboard/mein-bereich → MitarbeiterDashboard (mitarbeiter)
/dashboard/controlboard/
  schedule-builder      → ScheduleBuilderModern (gf+)
  master-data           → MasterData (gf+)
  admin                 → BenutzerverwaltungNeu (gf/globaladmin)
  dokumentenverwaltung  → Dokumentenverwaltung (gf+)
  leistungsnachweise    → Leistungsnachweise (gf+)
  budgettracker         → BudgetTracker (gf+, buchhaltung)
  reporting             → Reporting (gf+, buchhaltung)
  aktivitaetslog        → AktivitaetsLog (globaladmin)
/dashboard/settings     → Settings (gf/globaladmin)
/chat                   → ChatPage (AI)
```

### Data Layer

- **Client:** `src/integrations/supabase/client.ts`
- **Typen:** `src/integrations/supabase/types.ts` — IMMER nutzen
- **Domain:** `src/types/domain.ts`
- **Hooks:** `src/hooks/` — alle DB-Zugriffe
- **Auth:** `useAuth()` (Session, Token-Refresh) + `useUserRole()` (Rollen, Permissions)

## Kern-Dateien

```
src/
├── App.tsx                                # Provider-Setup + Routes
├── integrations/supabase/                 # Client + generierte Types
├── hooks/                                 # useAuth, useUserRole, useAppointments, useCustomers, useEmployees, useBudgetTransactions
├── lib/pflegebudget/budgetCalculations.ts # Budget FIFO + Priorisierung
├── types/domain.ts                        # Business Types
├── components/schedule/                   # Kalender (calendar/, dialogs/, panels/, ai/)
└── pages/controlboard/                    # Hauptseiten

supabase/functions/                        # 18 Edge Functions (batch-billing, AI-Parser, Email, etc.)
```

## Domain-Wissen

Detailwissen wird ueber Rules und Skills bereitgestellt — NICHT hier duplizieren:

| Thema | Rule (immer geladen) | Skill (bei Bedarf) |
|-------|---------------------|--------------------|
| Code-Style | `.claude/rules/code-style.md` | — |
| Rollen | `.claude/rules/business/rollen.md` | — |
| Dienstplan | `.claude/rules/business/dienstplan.md` | `/dienstplan` |
| Abrechnung | `.claude/rules/business/abrechnung.md` | `/abrechnung` |
| DB-Schema | — | `/db-schema` (auto) |
| Reporting | — | `/reporting` (auto) |

## Abrechnung — WICHTIG

**Der Leistungsnachweis (LN) IST die Rechnung** — das Dokument das an die Pflegekasse geht.
Kein separates Rechnungsdokument für Kassenabrechnung.

**rechnungen-Tabelle + rechnungspositionen: NICHT VERWENDEN.**
Das DB-Schema hat diese Tabellen noch — sie sind veraltet und werden nicht genutzt.
Kein Code schreiben der `rechnungen` erstellt, anzeigt oder verwaltet.

Abrechnungsfluss: `batch-billing` → upsert `leistungsnachweise` + `budget_transactions` → Termine auf `abgerechnet`.

## Agents

| Agent | Wann aktivieren |
|-------|-----------------|
| `eah-dienstplan` | Schedule-Bugs, Kalender-Features |
| `eah-abrechnung` | Budget, Billing, Leistungsnachweise |
| `eah-rollen` | Permissions, RLS, Route Guards |


1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.