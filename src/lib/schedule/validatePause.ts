/**
 * Validates the 15-minute minimum break rule between appointments of the same employee.
 * Pure function — no React dependencies.
 */

import type { CalendarAppointment } from '@/types/domain';

export const PAUSE_MINUTES = 15;

export interface PauseConflictResult {
  hasConflict: boolean;
  /** Appointments that cause a pause violation (gap < 15 min, but no direct overlap) */
  violatingAppointments: CalendarAppointment[];
  /** Appointments that directly overlap */
  overlappingAppointments: CalendarAppointment[];
  /** Minimum gap found in minutes (0 if overlap, positive if pause too short) */
  minGapMinutes: number;
}

/**
 * Check whether placing an appointment for a given employee at the given time
 * violates the 15-minute minimum break rule or causes a direct overlap.
 *
 * @param mitarbeiterId  The employee to check for
 * @param newStart       Start of the new/moved appointment (UTC Date)
 * @param newEnd         End of the new/moved appointment (UTC Date)
 * @param allTermine     All appointments currently in state
 * @param excludeTerminId  ID of the appointment being edited (excluded from check)
 */
export function checkPauseConflict(
  mitarbeiterId: string,
  newStart: Date,
  newEnd: Date,
  allTermine: CalendarAppointment[],
  excludeTerminId?: string,
): PauseConflictResult {
  const pauseMs = PAUSE_MINUTES * 60 * 1000;

  const sameEmployee = allTermine.filter(
    (t) => t.mitarbeiter_id === mitarbeiterId && t.id !== excludeTerminId,
  );

  const overlappingAppointments = sameEmployee.filter(
    (t) => new Date(t.start_at) < newEnd && new Date(t.end_at) > newStart,
  );

  const violatingAppointments = sameEmployee.filter((t) => {
    const existStart = new Date(t.start_at);
    const existEnd = new Date(t.end_at);

    // Skip direct overlaps — already captured above
    if (existStart < newEnd && existEnd > newStart) return false;

    const gapBefore = newStart.getTime() - existEnd.getTime(); // new starts after existing ends
    const gapAfter = existStart.getTime() - newEnd.getTime();  // existing starts after new ends

    return (
      (gapBefore >= 0 && gapBefore < pauseMs) ||
      (gapAfter >= 0 && gapAfter < pauseMs)
    );
  });

  // Compute the smallest gap among all violations
  let minGapMs = Infinity;
  for (const t of [...overlappingAppointments, ...violatingAppointments]) {
    const existStart = new Date(t.start_at);
    const existEnd = new Date(t.end_at);
    // Overlap: gap is negative / 0
    if (existStart < newEnd && existEnd > newStart) {
      minGapMs = 0;
    } else {
      const gapBefore = newStart.getTime() - existEnd.getTime();
      const gapAfter = existStart.getTime() - newEnd.getTime();
      const gap = Math.min(
        gapBefore >= 0 ? gapBefore : Infinity,
        gapAfter >= 0 ? gapAfter : Infinity,
      );
      if (gap < minGapMs) minGapMs = gap;
    }
  }

  const hasConflict =
    overlappingAppointments.length > 0 || violatingAppointments.length > 0;

  return {
    hasConflict,
    violatingAppointments,
    overlappingAppointments,
    minGapMinutes: minGapMs === Infinity ? PAUSE_MINUTES : Math.round(minGapMs / 60_000),
  };
}
