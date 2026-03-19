## Summary

The component satisfies most requirements correctly, but has two real bugs: the Kategorie auto-intern logic does not reset `isInternTermin` back to false when switching away from Schulung/Intern, and the `kategorie` state type is wider than the `TerminKategorie` union, leaking a type inconsistency. Several smaller issues also apply.

## Issues

- **[severity: high]** Correctness – Requirement 4 partial bug: When the user changes Kategorie from `Schulung` or `Intern` to a different value (e.g. `Regelbesuch`), `isInternTermin` is NOT reset to false. The `onValueChange` handler only sets `isInternTermin(true)` for the two auto-intern values; it has no corresponding `setIsInternTermin(false)` branch for the other values. This means a user who first selects "Schulung", then changes their mind and picks "Regelbesuch", will still have the intern path active — the Kunde selector stays hidden and `kunden_id: null` is submitted.

  Suggested fix:
  ```tsx
  onValueChange={(val) => {
    setKategorie(val);
    if (val === 'Schulung' || val === 'Intern') {
      setIsInternTermin(true);
    } else {
      setIsInternTermin(false); // <-- missing branch
    }
  }}
  ```

- **[severity: medium]** Correctness – The `kategorie` state is typed as `string` (line 58), but the component imports and uses `TerminKategorie` for `KATEGORIE_OPTIONS` and for the `CalendarAppointment` domain type. The `onSubmit` prop also declares `kategorie?: string | null`, which is deliberately looser. The disconnect means TypeScript will not catch if a non-union value is accidentally stored. Change the state type to `TerminKategorie | ''` to match actual usage:
  ```tsx
  const [kategorie, setKategorie] = useState<TerminKategorie | ''>('');
  ```
  And update the `onValueChange` cast: `setKategorie(val as TerminKategorie)`.

- **[severity: medium]** Error handling – The `catch` block in `handleSubmit` (line 130) only does `console.error`. There is no user-facing feedback on failure. According to project conventions, a `toast.error(...)` call is required so the user knows the submission failed. Without it, the dialog stays open and the loading spinner disappears silently, leaving the user confused.

  Suggested fix:
  ```tsx
  } catch (error) {
    console.error('Error creating appointment:', error);
    toast.error('Termin konnte nicht erstellt werden.');
  }
  ```
  Add `import { toast } from 'sonner';` at the top.

- **[severity: low]** Correctness – The submit button disabled condition (line 321) correctly allows submission when `isInternTermin` is true and no Kunde is selected. However, the `isNewInteressent` guard `(isNewInteressent && !newInteressentName.trim())` in `handleSubmit` (line 64) can also cause a silent early return with no user feedback — the form just does nothing. This is a poor UX but not a blocking logic error since the button label and required attribute on the Input field (line 219) give implicit guidance.

- **[severity: low]** Readability – The indentation of the Mitarbeiter `<div>` block (lines 225–242) is inconsistent with the rest of the form (4 spaces vs 2 spaces offset). It appears to have been left at a different indentation level, suggesting it was conditionally rendered at some point and the condition was removed. No functional impact, but it is visually jarring.

- **[severity: low]** Readability – The `employees.filter((emp) => emp)` call on line 234 is a no-op truthy filter. If the array can contain `null` or `undefined` entries, the type `EmployeeSummary[]` does not reflect that and TypeScript would already catch misuse. If the array cannot, the filter is dead code. Either fix the type or remove the filter.

## Verdict

NEEDS CHANGES — the missing `setIsInternTermin(false)` branch when switching Kategorie away from Schulung/Intern is a correctness bug that can cause wrong data submission. The missing error toast is a project-convention violation. Both should be fixed before shipping.
