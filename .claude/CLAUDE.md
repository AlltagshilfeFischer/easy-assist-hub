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

## Agents

| Agent | Wann aktivieren |
|-------|-----------------|
| `eah-dienstplan` | Schedule-Bugs, Kalender-Features |
| `eah-abrechnung` | Budget, Billing, LN, Rechnungen |
| `eah-rollen` | Permissions, RLS, Route Guards |
