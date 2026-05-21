import type { Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';
import { toBerlinWeekdayAndMinutes } from '@/lib/timezone';

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm ?? 0);
}

export interface VerfuegbarkeitCheckResult {
  outsideWindow: boolean;
  hasEntries: boolean;
  noEntryForDay: boolean;
}

/**
 * Prüft ob ein Termin innerhalb der eingetragenen Verfügbarkeit des MAs liegt.
 * Keine Einträge = unverfügbar (outsideWindow: true).
 */
export function checkVerfuegbarkeit(
  mitarbeiterId: string | null,
  startAt: string,
  endAt: string,
  verfuegbarkeiten: Verfuegbarkeit[],
): VerfuegbarkeitCheckResult {
  if (!mitarbeiterId) return { outsideWindow: false, hasEntries: false, noEntryForDay: false };

  const empVerfueg = verfuegbarkeiten.filter(v => v.mitarbeiter_id === mitarbeiterId);
  if (empVerfueg.length === 0) return { outsideWindow: true, hasEntries: false, noEntryForDay: true };

  const { weekday, minutes: startMinutes } = toBerlinWeekdayAndMinutes(startAt);
  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime();
  const endMinutes = startMinutes + Math.round(durationMs / 60000);

  const dayVerfueg = empVerfueg.filter(v => v.wochentag === weekday);
  if (dayVerfueg.length === 0) {
    return { outsideWindow: true, hasEntries: true, noEntryForDay: true };
  }

  const withinWindow = dayVerfueg.some(v => {
    const vStart = timeToMinutes(v.von);
    const vEnd = timeToMinutes(v.bis);
    return startMinutes >= vStart && endMinutes <= vEnd;
  });

  return { outsideWindow: !withinWindow, hasEntries: true, noEntryForDay: false };
}
