import type { Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';
import { APP_TIMEZONE } from '@/lib/timezone';

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm ?? 0);
}

function toBerlinWeekdayAndMinutes(isoUtc: string): { weekday: number; minutes: number } {
  const utcDate = new Date(isoUtc);
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: APP_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(utcDate);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);

  const weekdayMap: Record<string, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };
  const weekday = weekdayMap[get('weekday').replace('.', '')] ?? 0;

  return { weekday, minutes: hours * 60 + minutes };
}

export interface VerfuegbarkeitCheckResult {
  outsideWindow: boolean;
  hasEntries: boolean;
  noEntryForDay: boolean;
}

/**
 * Prüft ob ein Termin innerhalb der eingetragenen Verfügbarkeit des MAs liegt.
 * Gibt outsideWindow=false zurück wenn keine Verfügbarkeiten hinterlegt (keine Restriktion).
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
