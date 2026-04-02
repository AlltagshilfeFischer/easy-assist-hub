## Summary
Two real bugs found across the three files — both in the absence management components — plus one correctness gap shared by both; the panel component is clean.

---

## Issues

### Datei 2 & 3 (shared) — AbwesenheitVerwaltung + AbwesenheitGenehmigung

- **[severity: high] Correctness — `termin.update` error is silently swallowed**

  In both components the `termine` update call is not checked for errors:

  ```typescript
  await supabase
    .from('termine')
    .update({ mitarbeiter_id: null, status: 'unassigned' })
    .in('id', ids);
  // no `const { error } = ...` and no `if (error) throw error`
  ```

  If Supabase returns an error (RLS block, network issue, etc.) the function continues, writes history entries that reference termine that were never actually unassigned, and reports success to the user. The history and the real data are then out of sync. Fix: destructure `{ error }` and throw if set — same pattern already used correctly for the `mitarbeiter_abwesenheiten` update two lines above.

- **[severity: high] Correctness — `termin_aenderungen.insert` error is silently swallowed**

  Same problem one step further: the history insert is also never checked:

  ```typescript
  await supabase.from('termin_aenderungen').insert( ids.map(...) );
  ```

  A failed insert produces no error feedback and no retry. Given the insert is the audit trail, a silent failure means the action happened but is not recorded. Fix: same pattern — `const { error } = await supabase...` then `if (error) throw error`.

---

### Datei 3 — AbwesenheitGenehmigung only

- **[severity: medium] Correctness — `isPending` disables buttons for all rows, not just the active one**

  ```typescript
  const isPending = approveMutation.isPending || rejectMutation.isPending;
  ```

  `isPending` is declared inside the `.map()` loop but it reflects the mutation state globally. Clicking "Genehmigen" on row A correctly disables its own buttons, but also disables the approve/reject buttons on rows B, C, etc. for the entire duration of the request.

  This is not a data-integrity bug — only one approval can be in flight at a time by design — but it will visually block the user from acting on other rows. If that is the intended UX it should be documented; if not, track the `id` of the pending request and compare per row.

---

### Datei 1 — UnassignedAppointmentsPanel

No issues found. `useMemo` dependencies are correct, the `suggestEmployees` return type (`ScoredEmployee[]`) is properly destructured, role check is done once in the parent and passed down as a plain boolean — this is correct.

---

## Verdict
NEEDS CHANGES — the two silent-swallow bugs in the DB writes are blocking. A failed `termine` update followed by a successful-looking history insert creates irrecoverable audit drift.
