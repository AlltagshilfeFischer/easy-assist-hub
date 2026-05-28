import { toBerlinWeekdayAndMinutes } from '@/lib/timezone';

export interface KundenZeitfensterEintrag {
  kunden_id: string;
  wochentag: number;
  von: string;
  bis: string;
}

export interface KundenZeitfensterResult {
  outsideWindow: boolean;
  hasEntries: boolean;
  noEntryForDay: boolean;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm ?? 0);
}

/**
 * Prüft ob ein Termin innerhalb der bevorzugten Zeitfenster des Kunden liegt.
 * Kein Eintrag = keine Präferenz hinterlegt (kein Hinweis — kein Blocker).
 */
export function checkKundenZeitfenster(
  kundenId: string | null | undefined,
  startAt: string,
  endAt: string,
  zeitfenster: KundenZeitfensterEintrag[],
): KundenZeitfensterResult {
  if (!kundenId) return { outsideWindow: false, hasEntries: false, noEntryForDay: false };

  const kundenFenster = zeitfenster.filter(z => z.kunden_id === kundenId);
  if (kundenFenster.length === 0) return { outsideWindow: false, hasEntries: false, noEntryForDay: false };

  const { weekday, minutes: startMinutes } = toBerlinWeekdayAndMinutes(startAt);
  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime();
  const endMinutes = startMinutes + Math.round(durationMs / 60000);

  const dayFenster = kundenFenster.filter(z => z.wochentag === weekday);
  if (dayFenster.length === 0) {
    return { outsideWindow: true, hasEntries: true, noEntryForDay: true };
  }

  const withinWindow = dayFenster.some(z => {
    const zStart = timeToMinutes(z.von);
    const zEnd = timeToMinutes(z.bis);
    return startMinutes >= zStart && endMinutes <= zEnd;
  });

  return { outsideWindow: !withinWindow, hasEntries: true, noEntryForDay: false };
}
