## Summary

All four files are largely correct and well-structured; three real issues were found across the reviewed scope — one medium and two low severity — along with one correctness gap in domain types.

---

## Issues

### Reporting.tsx

- **[low]** **Correctness**: The `Bar` component uses `className="fill-primary"` to set the bar color, but recharts does not process Tailwind class names — it renders SVG `<rect>` elements whose fill must be set via the `fill` prop or inline style. Each chart entry already has a `fill` field (the employee's `farbe_kalender` color) on the data object, but it is never applied. The bars will either render without color or fall back to a browser default. **Fix:** Remove `className="fill-primary"` from `<Bar>` and add `fill` prop: `<Bar dataKey="gesamtStunden" fill="var(--primary)" radius={[4,4,0,0]} />` — or use `<Cell>` per entry to apply per-employee colors from `chartData[n].fill`.

- **[low]** **Correctness**: The `dateTo` filter uses `.lte('start_at', dateTo.toISOString())`. `endOfMonth(now)` produces midnight of the last day (e.g. `2026-03-31T00:00:00`), so any appointment that _starts_ on the last day of the month (after 00:00) is excluded. **Fix in `useReportingData`:** Use `endOfDay(dateTo)` from date-fns before converting to ISO string, or append `T23:59:59` to the date boundary.

---

### AppointmentAttachments.tsx

- **[medium]** **Security / Correctness**: On upload, the storage path is constructed as `` `termine/${terminId}/${file.name}` `` and `upsert: true` is used. A user can deliberately upload a file whose name collides with another user's file for the same `terminId`, silently overwriting it in storage. The database row is then inserted (not upserted), so the old DB record remains, pointing to a now-replaced file. **Fix:** Prefix the path with a UUID or timestamp: `` `termine/${terminId}/${crypto.randomUUID()}-${file.name}` `` and set `upsert: false` (or omit it).

- **[low]** **Error handling**: In `handleDelete`, the storage file is deleted first, and then the database row is deleted. If the database delete fails after the storage delete succeeds, the DB row remains but the file is gone — the user sees the file listed but can never download it again. **Fix:** Delete the DB row first; if that succeeds, delete from storage. A failed storage delete is recoverable (stale blob), whereas a dangling DB row pointing to a missing blob is not.

---

### ProAppointmentCard.tsx

No issues found. `kategorie` is present in the `Pick` type (line 16), the Kategorie badge renders conditionally when set (lines 101-106), and the customer null-guard falls back to `appointment.titel` (line 97).

---

### domain.ts

- **[low]** **Correctness**: `TerminKategorie` (line 128) is defined as a narrow union: `'Erstgespräch' | 'Schulung' | 'Intern' | 'Regelbesuch' | 'Sonstiges'`. The project spec (CLAUDE.md §9.5) lists additional labels: `Standard (Kundentermin)`, `Meeting`, `Bewerbungsgespräch`, `Blocker`, `Absage Kunde (kurzfristig)`, `Absage Kunde (rechtzeitig)`, `Ausfall MA/Firma`. These values are not yet in the type, so any code or DB value using those labels will fail TypeScript or produce a runtime type mismatch. **Note:** This is a known gap per spec ("NOCH NICHT IMPLEMENTIERT"), so flag severity is low, but the type should be expanded when those labels land.

  All required domain.ts checks pass otherwise: `CalendarAppointment.kunden_id` is `string | null` (line 134), `kategorie` is present (line 140), `absage_datum` and `absage_kanal` are on `Appointment` (lines 155-156), and both `TerminKategorie` and `AbsageKanal` are exported (lines 128-129).

---

### Route & Sidebar Checklist

| Check | Result |
|---|---|
| Route in Dashboard.tsx (admin) | PASS — `/controlboard/reporting` at line 94 |
| Route in Dashboard.tsx (globaladmin/GF) | PASS — line 116 |
| Route missing for `buchhaltung` | Expected — buchhaltung has read-only access; Berichte not in their scope per spec |
| Sidebar item exists | PASS — `'Berichte'` at AppSidebar.tsx line 49 |
| Sidebar roles for Berichte | PASS — `globaladmin`, `geschaeftsfuehrer`, `admin` |

---

## Verdict

NEEDS CHANGES — the medium severity storage overwrite issue in `AppointmentAttachments` and the recharts bar color bug in `Reporting` should be fixed before shipping.
