/** Systemweite Zeitzone — unveränderlich, wird nicht konfiguriert. */
export const APP_TIMEZONE = 'Europe/Berlin' as const;

/**
 * Gibt Wochentag (0=Mo … 6=So) und Minuten seit Mitternacht
 * für einen UTC-ISO-String in der App-Timezone zurück.
 * Verwendet numerische Felder statt Locale-Kurzstrings — robust gegen CLDR-Versionen.
 */
export function toBerlinWeekdayAndMinutes(isoUtc: string): { weekday: number; minutes: number } {
  const utcDate = new Date(isoUtc);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

  const year = get('year');
  const month = get('month') - 1;
  const day = get('day');
  const hours = get('hour') % 24; // guard: hour12:false kann 24 zurückgeben
  const minutes = get('minute');

  // JS getDay(): 0=So, 1=Mo … 6=Sa → 0=Mo … 6=So
  const jsDay = new Date(year, month, day).getDay();
  const weekday = (jsDay + 6) % 7;

  return { weekday, minutes: hours * 60 + minutes };
}
