// =============================================================
// Shared Date Utilities — eliminates duplicate date logic
// =============================================================

import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  getWeek,
  differenceInMinutes,
  parseISO,
} from 'date-fns';
import { de } from 'date-fns/locale';

/** Monday-based week start */
const WEEK_OPTIONS = { weekStartsOn: 1 as const };

/**
 * Returns an array of 7 Date objects (Mon–Sun) for the week containing `date`.
 */
export function getWeekDates(date: Date): Date[] {
  const weekStart = startOfWeek(date, WEEK_OPTIONS);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Returns the Monday of the week containing `date`.
 */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, WEEK_OPTIONS);
}

/**
 * Returns the Sunday of the week containing `date`.
 */
export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, WEEK_OPTIONS);
}

/**
 * Returns the ISO week number (Monday-based, German locale).
 */
export function getWeekNumber(date: Date): number {
  return getWeek(date, { locale: de, weekStartsOn: 1 });
}

/**
 * Format a date for display, using German locale by default.
 */
export function formatDE(date: Date | string, pattern: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: de });
}

/**
 * Duration in hours between two ISO date-time strings.
 */
export function durationInHours(startISO: string, endISO: string): number {
  return differenceInMinutes(parseISO(endISO), parseISO(startISO)) / 60;
}

/**
 * German day abbreviations (Mo–So).
 */
export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/**
 * Full German day names.
 */
export const WEEKDAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

/**
 * Map a JS Date.getDay() value (0=Sun … 6=Sat) to our Monday-based index (0=Mon … 6=Sun).
 */
export function toMondayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}
