/** Systemweite Zeitzone — unveränderlich, wird nicht konfiguriert. */
export const APP_TIMEZONE = 'Europe/Berlin' as const;

// Singleton — einmalig erstellt, wiederverwendet für jede Berechnung
const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// en-CA gibt stabile englische Kurzformen: Mon, Tue, Wed, Thu, Fri, Sat, Sun
const WEEKDAY_MAP: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/**
 * Gibt Wochentag (0=Mo … 6=So) und Minuten seit Mitternacht
 * für einen UTC-ISO-String in der App-Timezone zurück.
 * Rein auf Intl.DateTimeFormat basierend — kein sekundäres Date-Objekt,
 * keine Abhängigkeit von der lokalen System-Zeitzone.
 */
export function toBerlinWeekdayAndMinutes(isoUtc: string): { weekday: number; minutes: number } {
  const parts = berlinFormatter.formatToParts(new Date(isoUtc));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  const weekday = WEEKDAY_MAP[get('weekday')];
  if (weekday === undefined) throw new Error(`Unbekannter Wochentag-Token: ${get('weekday')}`);

  const hours = parseInt(get('hour'), 10) % 24; // guard: hour12:false kann 24 liefern
  const minutes = parseInt(get('minute'), 10);

  return { weekday, minutes: hours * 60 + minutes };
}
