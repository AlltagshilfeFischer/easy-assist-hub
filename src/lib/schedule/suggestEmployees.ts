/**
 * Clientseitiger Algorithmus für MA-Vorschläge bei offenen Terminen.
 * Keine React-Abhängigkeit — reine Funktion.
 *
 * Zwei Stufen:
 *  1. Pool-MAs (in_scheduling_pool !== false): vollständige Prüfung
 *  2. GF-Fallback (rolle GF/GA oder pool=false): nur Konflikt + Abwesenheit
 */

import type { Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';
import type { Employee, CalendarAppointment } from '@/types/domain';
import { toBerlinWeekdayAndMinutes } from '@/lib/timezone';

interface Abwesenheit {
  mitarbeiter_id: string;
  zeitraum: unknown;
  von?: string | null;
  bis?: string | null;
  status: string;
}

const PAUSE_MINUTES = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm ?? 0);
}

function toBerlinParts(isoUtc: string): { date: Date; weekdayIso: number; minutesSinceMidnight: number } {
  const { weekday, minutes } = toBerlinWeekdayAndMinutes(isoUtc);
  return { date: new Date(isoUtc), weekdayIso: weekday, minutesSinceMidnight: minutes };
}

function isGfRole(employee: Employee): boolean {
  return employee.rolle === 'geschaeftsfuehrer' || employee.rolle === 'globaladmin';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuggestionInput {
  appointment: CalendarAppointment;
  allAppointments: CalendarAppointment[];
  employees: Employee[];
  verfuegbarkeiten: Verfuegbarkeit[];
  abwesenheiten?: Abwesenheit[];
}

export interface ScoredEmployee {
  employee: Employee;
  score: number;
  reason: string;
  hasConflict: boolean;
  isFallback: boolean;
}

// ─── Absence check ────────────────────────────────────────────────────────────

function isEmployeeAbsent(abwesenheiten: Abwesenheit[], employeeId: string, date: Date): boolean {
  return abwesenheiten.some(a => {
    if (a.mitarbeiter_id !== employeeId) return false;
    const match = (a.zeitraum as string)?.match(/[\[(](.+?),(.+?)[\])]/);
    if (match) {
      const rangeStart = new Date(match[1].trim());
      const rangeEnd = new Date(match[2].trim());
      return date >= rangeStart && date < rangeEnd;
    }
    if (a.von && a.bis) {
      const von = new Date(a.von);
      const bis = new Date(a.bis);
      bis.setHours(23, 59, 59, 999);
      return date >= von && date <= bis;
    }
    return false;
  });
}

// ─── Core matcher ─────────────────────────────────────────────────────────────

function matchCandidates(
  candidates: Employee[],
  appointment: CalendarAppointment,
  allAppointments: CalendarAppointment[],
  verfuegbarkeiten: Verfuegbarkeit[],
  abwesenheiten: Abwesenheit[],
  isFallback: boolean,
): ScoredEmployee[] {
  const apptStart = new Date(appointment.start_at);
  const apptEnd = new Date(appointment.end_at);
  const { weekdayIso: apptWeekday, minutesSinceMidnight: apptStartMinutes } = toBerlinParts(appointment.start_at);
  const apptEndMinutes = apptStartMinutes + Math.round((apptEnd.getTime() - apptStart.getTime()) / 60000);
  const pauseMs = PAUSE_MINUTES * 60 * 1000;

  const results: ScoredEmployee[] = [];

  for (const employee of candidates) {
    if (!employee.ist_aktiv) continue;

    if (isEmployeeAbsent(abwesenheiten, employee.id, apptStart)) continue;

    const empAppts = allAppointments.filter(
      a => a.mitarbeiter_id === employee.id && a.id !== appointment.id,
    );

    const sameDayAppts = empAppts.filter(a => {
      const { weekdayIso } = toBerlinParts(a.start_at);
      return weekdayIso === apptWeekday;
    });

    // Hard block: time overlap
    const hasOverlap = empAppts.some(a => {
      const aStart = new Date(a.start_at);
      const aEnd = new Date(a.end_at);
      return aStart < apptEnd && aEnd > apptStart;
    });
    if (hasOverlap) continue;

    // Hard block: 15-min pause violation
    const hasPauseViolation = sameDayAppts.some(a => {
      const aStart = new Date(a.start_at);
      const aEnd = new Date(a.end_at);
      if (aStart < apptEnd && aEnd > apptStart) return false;
      const gapBefore = apptStart.getTime() - aEnd.getTime();
      const gapAfter = aStart.getTime() - apptEnd.getTime();
      return (gapBefore >= 0 && gapBefore < pauseMs) || (gapAfter >= 0 && gapAfter < pauseMs);
    });
    if (hasPauseViolation) continue;

    // For pool employees: check availability windows (GF fallback skips this)
    if (!isFallback) {
      const empVerfueg = verfuegbarkeiten.filter(v => v.mitarbeiter_id === employee.id);
      const hasAnyVerfueg = empVerfueg.length > 0;
      const weekdayVerfueg = empVerfueg.filter(v => v.wochentag === apptWeekday);
      if (hasAnyVerfueg && weekdayVerfueg.length === 0) continue;
      const withinWindow = weekdayVerfueg.length === 0
        ? true
        : weekdayVerfueg.some(v => {
            const vStart = timeToMinutes(v.von);
            const vEnd = timeToMinutes(v.bis);
            return apptStartMinutes >= vStart && apptEndMinutes <= vEnd;
          });
      if (!withinWindow) continue;
    }

    // Scoring
    let score = 0;
    const reasonParts: string[] = [];

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

    if (!isFallback) {
      score += 15;
      reasonParts.push('Im Verfügbarkeitsfenster');
    }

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
    } else {
      score += 5;
      reasonParts.push('Noch keine Termine heute');
    }

    if (isFallback) {
      reasonParts.push('GF-Einsatz');
    }

    const countLabel = `${todayCount} Termin${todayCount !== 1 ? 'e' : ''} heute`;

    results.push({
      employee,
      score,
      reason: reasonParts.length > 0
        ? `${reasonParts.join(', ')} (${countLabel})`
        : countLabel,
      hasConflict: false,
      isFallback,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function suggestEmployees(input: SuggestionInput): ScoredEmployee[] {
  const { appointment, allAppointments, employees, verfuegbarkeiten, abwesenheiten = [] } = input;

  // Pool-MAs: explizit nicht als Fallback markiert
  const poolEmployees = employees.filter(e =>
    e.ist_aktiv && e.in_scheduling_pool !== false && !isGfRole(e),
  );

  // GF-Kandidaten: Rolle ist GF/GA, oder in_scheduling_pool=false
  const gfEmployees = employees.filter(e =>
    e.ist_aktiv && (isGfRole(e) || e.in_scheduling_pool === false),
  );

  const poolResults = matchCandidates(
    poolEmployees, appointment, allAppointments, verfuegbarkeiten, abwesenheiten, false,
  );

  if (poolResults.length > 0) return poolResults;

  // Kein Pool-MA verfügbar → GF-Fallback (ohne strenge Verfügbarkeitsfenster-Prüfung)
  return matchCandidates(
    gfEmployees, appointment, allAppointments, verfuegbarkeiten, abwesenheiten, true,
  );
}
