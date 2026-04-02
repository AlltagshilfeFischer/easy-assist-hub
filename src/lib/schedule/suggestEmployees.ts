/**
 * Clientseitiger Algorithmus für MA-Vorschläge bei offenen Terminen.
 * Keine React-Abhängigkeit — reine Funktion.
 */

import type { Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';
import type { Employee, CalendarAppointment } from '@/types/domain';

const BERLIN_TZ = 'Europe/Berlin';
const PAUSE_MINUTES = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "HH:MM" or "HH:MM:SS" into total minutes since midnight */
function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm ?? 0);
}

/**
 * Convert a UTC ISO string to a Date object representing the local Berlin time.
 * Uses Intl.DateTimeFormat to determine the correct offset.
 */
function toBerlinParts(isoUtc: string): { date: Date; weekdayIso: number; minutesSinceMidnight: number } {
  const utcDate = new Date(isoUtc);

  // Intl gives us the local parts in Berlin timezone
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN_TZ,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour12: false,
  }).formatToParts(utcDate);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';

  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  const minutesSinceMidnight = hours * 60 + minutes;

  // weekday short in de-DE: 'Mo.' or 'Mo' depending on CLDR version — strip trailing period
  const weekdayMap: Record<string, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };
  const weekdayIso = weekdayMap[get('weekday').replace('.', '')] ?? 0;

  return { date: utcDate, weekdayIso, minutesSinceMidnight };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuggestionInput {
  appointment: CalendarAppointment;
  allAppointments: CalendarAppointment[];
  employees: Employee[];
  verfuegbarkeiten: Verfuegbarkeit[];
}

export interface ScoredEmployee {
  employee: Employee;
  score: number;
  reason: string;
  hasConflict: boolean;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function suggestEmployees(input: SuggestionInput): ScoredEmployee[] {
  const { appointment, allAppointments, employees, verfuegbarkeiten } = input;

  const apptStart = new Date(appointment.start_at);
  const apptEnd = new Date(appointment.end_at);
  const { weekdayIso: apptWeekday, minutesSinceMidnight: apptStartMinutes } = toBerlinParts(appointment.start_at);
  const apptEndMinutes = apptStartMinutes + Math.round((apptEnd.getTime() - apptStart.getTime()) / 60000);

  const pauseMs = PAUSE_MINUTES * 60 * 1000;

  const results: ScoredEmployee[] = [];

  for (const employee of employees) {
    if (!employee.ist_aktiv) continue;

    // ── Appointments for this employee on the same day ─────────────────────
    const empAppts = allAppointments.filter(
      a => a.mitarbeiter_id === employee.id && a.id !== appointment.id,
    );

    // Same-day appointments (Berlin weekday)
    const sameDayAppts = empAppts.filter(a => {
      const { weekdayIso } = toBerlinParts(a.start_at);
      return weekdayIso === apptWeekday;
    });

    // ── Disqualification: time overlap ─────────────────────────────────────
    const hasOverlap = empAppts.some(a => {
      const aStart = new Date(a.start_at);
      const aEnd = new Date(a.end_at);
      return aStart < apptEnd && aEnd > apptStart;
    });
    if (hasOverlap) continue;

    // ── Disqualification: 15-min pause violation (same-day only) ───────────
    const hasPauseViolation = sameDayAppts.some(a => {
      const aStart = new Date(a.start_at);
      const aEnd = new Date(a.end_at);
      // Skip if overlap (already caught above)
      if (aStart < apptEnd && aEnd > apptStart) return false;
      const gapBefore = apptStart.getTime() - aEnd.getTime();
      const gapAfter = aStart.getTime() - apptEnd.getTime();
      return (gapBefore >= 0 && gapBefore < pauseMs) || (gapAfter >= 0 && gapAfter < pauseMs);
    });
    if (hasPauseViolation) continue;

    // ── Disqualification: employee not available on this weekday ───────────
    const empVerfueg = verfuegbarkeiten.filter(v => v.mitarbeiter_id === employee.id);
    const hasAnyVerfueg = empVerfueg.length > 0;

    // Only disqualify if the employee has availability entries but none match the weekday
    const weekdayVerfueg = empVerfueg.filter(v => v.wochentag === apptWeekday);
    if (hasAnyVerfueg && weekdayVerfueg.length === 0) continue;

    // ── Scoring ────────────────────────────────────────────────────────────
    let score = 0;
    const reasonParts: string[] = [];

    // Workload scoring
    const maxPerDay = employee.max_termine_pro_tag ?? 8;
    const todayCount = sameDayAppts.length;
    const workloadPct = (todayCount / maxPerDay) * 100;

    if (workloadPct < 50) {
      score += 20;
      reasonParts.push('Geringe Auslastung');
    } else if (workloadPct < 80) {
      score += 10;
      reasonParts.push('Mittlere Auslastung');
    }
    // >= 80% no workload bonus

    // Availability window check
    const withinWindow = weekdayVerfueg.some(v => {
      const vStart = timeToMinutes(v.von);
      const vEnd = timeToMinutes(v.bis);
      return apptStartMinutes >= vStart && apptEndMinutes <= vEnd;
    });
    if (withinWindow) {
      score += 15;
      reasonParts.push('Im Verfügbarkeitsfenster');
    }

    // 15-min buffer after last appointment on this day
    const lastEndMs = sameDayAppts.reduce((max, a) => {
      const t = new Date(a.end_at).getTime();
      return t > max ? t : max;
    }, 0);

    if (lastEndMs > 0) {
      const gapToNext = apptStart.getTime() - lastEndMs;
      if (gapToNext >= pauseMs) {
        score += 5;
        reasonParts.push('Ausreichend Pause');
      }
      // < pauseMs is already disqualified above
    } else {
      // No appointments today — small bonus
      score += 5;
      reasonParts.push('Noch keine Termine heute');
    }

    const countLabel = `${todayCount} Termin${todayCount !== 1 ? 'e' : ''} heute`;

    results.push({
      employee,
      score,
      reason: reasonParts.length > 0
        ? `${reasonParts.join(', ')} (${countLabel})`
        : countLabel,
      hasConflict: false,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
