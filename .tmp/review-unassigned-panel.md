## Summary

The implementation is largely correct and well-structured, but contains one critical business-rule bug in the weekday mapping, one medium correctness issue in the scope of the 15-min pause check, and a few low-severity issues worth noting.

---

## Issues

### BUG 1 — HIGH | Correctness / Business Rule: Weekday mapping mismatch between `suggestEmployees` and the DB schema

**File:** `src/lib/schedule/suggestEmployees.ts`, line 46

`useVerfuegbarkeiten.ts` documents the DB convention explicitly:

```ts
wochentag: number; // 0=Mo, 1=Di, ..., 6=So
```

`toBerlinParts()` builds its own map from the German short-day names returned by `Intl.DateTimeFormat`:

```ts
const weekdayMap: Record<string, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };
```

This matches the DB convention (0 = Monday), so the mapping is correct.

**However**, there is a subtle trap: `Intl.DateTimeFormat` with `weekday: 'short'` and locale `de-DE` returns `'Mo.'`, `'Di.'`, etc. — **with a trailing period** — in most modern browser/Node environments (CLDR data ≥ 42). The map keys have no period, so `get('weekday')` will never match and `weekdayMap[...]` will always return `undefined`, falling through to the `?? 0` default. This means **every appointment is treated as Monday**, silently disqualifying or wrongly qualifying employees on all other days.

**Suggested fix:** Strip the trailing period before lookup.

```ts
const rawWeekday = get('weekday').replace('.', '');
const weekdayIso = weekdayMap[rawWeekday] ?? 0;
```

Alternatively, derive the weekday numerically from the UTC date adjusted to Berlin midnight, which avoids the locale string entirely.

---

### BUG 2 — MEDIUM | Correctness: 15-min pause check in `suggestEmployees` uses ALL employee appointments, not just same-day ones

**File:** `src/lib/schedule/suggestEmployees.ts`, lines 105–113

The pause-violation loop iterates over `empAppts` — all appointments for the employee across the loaded date window (up to 6 months). A 2-month-old appointment can never be adjacent to today's appointment, so this is functionally harmless most of the time, but:

1. It creates unnecessary false-positives if two appointments from different calendar days have timestamps that are mathematically within 15 minutes of midnight boundaries when compared as raw epoch values. This is unlikely but not impossible (e.g., an appointment ending at 23:58 the day before vs. one starting at 00:05 the next day would show a 7-minute "gap" in UTC).
2. The scoring section's "buffer after last appointment" bonus (line 154) correctly uses only `sameDayAppts` — the disqualification check should match this scope for consistency.

**Suggested fix:** Change the pause disqualification loop to operate on `sameDayAppts` instead of `empAppts`:

```ts
const hasPauseViolation = sameDayAppts.some(a => { ... });
```

---

### Issue 3 — LOW | Correctness: `unassignedAppointments` prop in `ScheduleBuilderModern` is re-filtered inline instead of using the memoized value

**File:** `src/pages/controlboard/ScheduleBuilderModern.tsx`, line 1336

```tsx
unassignedAppointments={appointments.filter(a => !a.mitarbeiter_id || a.status === 'unassigned')}
```

The file already computes `unassignedAppointments` as a memoized value at line 335 (scoped to the current week). The inline prop filter has no week-scope filter, so the panel receives all unassigned appointments across the 6-month window — potentially far more items than intended. The memoized value `unassignedAppointments` (which applies the week-scope filter) should be passed instead.

This also means the panel badge count can disagree with the sidebar badge from `useQuery(['unassigned-count'])` (DB-level, global), but that is a separate design choice and not a bug per se.

**Suggested fix:**

```tsx
unassignedAppointments={unassignedAppointments}
```

---

### Issue 4 — LOW | React: `suggestEmployees` is called inside `AppointmentAccordionItem` with full `allAppointments` as a dependency

**File:** `src/components/schedule/panels/UnassignedAppointmentsPanel.tsx`, lines 119–128

The `useMemo` in `AppointmentAccordionItem` lists `allAppointments` as a dependency. Since `allAppointments` is the full `appointments` array from parent state (a new reference on every state update), the memo is invalidated on every mutation in `ScheduleBuilderModern`. This is fine at the moment given all items are only expanded one at a time via the Accordion, but if multiple items are open simultaneously the algorithm runs for each on every keystroke/state update.

This is **not blocking** — `suggestEmployees` is a pure O(n×m) in-memory function and `n` (employees) and `m` (appointments-per-employee) are small. Flagged for awareness only.

---

### Issue 5 — LOW | TypeScript: `useAllVerfuegbarkeiten` does not filter for active employees

**File:** `src/hooks/useAllVerfuegbarkeiten.ts`, line 11

The query fetches ALL rows from `mitarbeiter_verfuegbarkeit` without filtering by `ist_aktiv`. Inactive employees' availability entries will be fetched and passed into `suggestEmployees`, but those employees are filtered out early (`if (!employee.ist_aktiv) continue`), so there is no correctness impact. It is a minor data-over-fetch that can be resolved by joining or filtering in the future if the table grows large.

---

### Issue 6 — LOW | Consistency: `['unassigned-count']` query key in `AppSidebar` is never invalidated after assignment

**File:** `src/components/dashboard/AppSidebar.tsx`, line 76

The sidebar badge query `['unassigned-count']` has `staleTime: 60_000`. When an appointment is assigned via the panel (`assignAppointment`), `queryClient.invalidateQueries({ queryKey: ['unassigned-count'] })` is never called. The badge will lag up to 60 seconds behind reality. This is cosmetically noticeable after a user assigns an appointment from the panel.

**Suggested fix:** Call `queryClient.invalidateQueries({ queryKey: ['unassigned-count'] })` inside `assignAppointment`'s success path in `ScheduleBuilderModern`.

---

## Verdict

NEEDS CHANGES — Bug 1 (weekday `Intl` period mismatch) is a silent correctness failure that will make availability matching non-functional for all days except Monday in production. Bug 2 is medium risk. Issue 3 (wrong array passed as prop) is a correctness mismatch that should also be fixed before shipping.
