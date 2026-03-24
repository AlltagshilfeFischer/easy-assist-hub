import React, { useMemo, useState } from 'react';
import { format, isSameDay, getWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ProAppointmentCard } from '../ProAppointmentCard';
import { EnhancedDropZone } from '../EnhancedDropZone';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { Settings2, GripVertical, Eye, EyeOff, UserX, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Employee, CalendarAppointment } from '@/types/domain';

const ROLE_LABELS: Record<string, string> = {
  globaladmin: 'Admin (geschützt)',
  geschaeftsfuehrer: 'GF',
  admin: 'Manager',
  buchhaltung: 'Buchhaltung',
  mitarbeiter: 'Mitarbeiter',
};

// Types imported from @/types/domain

interface Abwesenheit {
  id: string;
  mitarbeiter_id: string;
  grund: string;
  zeitraum: string; // tstzrange from DB
  typ?: string;
  status?: string;
}

const TYP_LABELS: Record<string, string> = {
  urlaub: 'Urlaub',
  krank: 'Krankheit',
  fortbildung: 'Fortbildung',
  sonstiges: 'Sonstiges',
};

interface ProScheduleCalendarProps {
  employees: Employee[];
  allEmployees?: Employee[];
  appointments: CalendarAppointment[];
  abwesenheiten?: Abwesenheit[];
  weekDates: Date[];
  activeAppointmentId: string | null;
  onEditAppointment: (appointment: CalendarAppointment) => void;
  onSlotClick: (employeeId: string, date: Date) => void;
  conflictingAppointments: Set<string>;
  onCut: (appointment: CalendarAppointment) => void;
  onCopy?: (appointment: CalendarAppointment) => void;
  highlightedAppointmentId?: string | null;
  hiddenEmployeeIds?: Set<string>;
  onToggleEmployee?: (id: string) => void;
  onReorderEmployees?: (orderedIds: string[]) => void;
}

// Inline sortable item for the popover
function SortablePopoverItem({ emp, isHidden, onToggle }: { emp: Employee; isHidden: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: emp.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors',
        isHidden && 'opacity-70',
        isDragging && 'opacity-85 bg-muted shadow-sm ring-1 ring-primary/30 z-50'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        aria-label={`Reihenfolge für ${emp.name} ändern`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-primary-foreground shrink-0"
        style={{ backgroundColor: emp.farbe_kalender || 'hsl(var(--primary))' }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{emp.name}</p>
        <p className="text-xs text-muted-foreground">{isHidden ? 'Ausgeblendet' : 'Sichtbar im Kalender'}</p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
        aria-label={isHidden ? `${emp.name} einblenden` : `${emp.name} ausblenden`}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Popover employee filter + list
function PopoverEmployeeFilter({
  allEmployees,
  hiddenEmployeeIds,
  onToggleEmployee,
  popoverSensors,
  handlePopoverDragEnd,
}: {
  allEmployees: Employee[];
  hiddenEmployeeIds: Set<string>;
  onToggleEmployee: (id: string) => void;
  popoverSensors: ReturnType<typeof useSensors>;
  handlePopoverDragEnd: (event: DragEndEvent) => void;
}) {
  const [search, setSearch] = useState('');
  const visibleCount = allEmployees.filter((e) => !hiddenEmployeeIds.has(e.id)).length;

  const filtered = useMemo(() => {
    if (!search.trim()) return allEmployees;
    const q = search.toLowerCase();
    return allEmployees.filter((e) => e.name.toLowerCase().includes(q));
  }, [allEmployees, search]);

  return (
    <>
      {/* Suchfeld */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Mitarbeiter suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
            onKeyDown={(e) => e.stopPropagation()}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Schnellfilter-Chips */}
      <div className="px-3 pb-1 flex flex-wrap gap-1.5">
        {filtered.map((emp) => {
          const isVisible = !hiddenEmployeeIds.has(emp.id);
          const initials = emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => onToggleEmployee(emp.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all',
                isVisible
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-border text-muted-foreground bg-muted/30 opacity-50'
              )}
              style={isVisible ? { backgroundColor: emp.farbe_kalender || '#3B82F6' } : undefined}
              title={isVisible ? `${emp.name} ausblenden` : `${emp.name} einblenden`}
            >
              {initials}
            </button>
          );
        })}
      </div>

      {/* Alle ein/aus + Counter */}
      <div className="px-3 pb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{visibleCount}/{allEmployees.length} sichtbar</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => allEmployees.forEach((e) => { if (!hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id); })}
            className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
          >
            Keine
          </button>
          <button
            type="button"
            onClick={() => allEmployees.forEach((e) => { if (hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id); })}
            className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
          >
            Alle
          </button>
        </div>
      </div>

      {/* Sortierbare Liste */}
      <DndContext sensors={popoverSensors} collisionDetection={closestCenter} onDragEnd={handlePopoverDragEnd}>
        <SortableContext items={filtered.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="max-h-[300px] overflow-y-auto p-3 space-y-2 bg-popover border-t">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Kein Mitarbeiter gefunden</p>
            ) : (
              filtered.map((emp) => (
                <SortablePopoverItem
                  key={emp.id}
                  emp={emp}
                  isHidden={hiddenEmployeeIds.has(emp.id)}
                  onToggle={() => onToggleEmployee(emp.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

// Drop cell for the "Nicht zugeordnet" row — shows "Zuordnung entfernen" on hover
function UnassignedDropCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative h-full min-h-[60px] p-2 transition-all duration-200',
        isOver && 'bg-amber-100/60 dark:bg-amber-900/30 ring-2 ring-inset ring-amber-400'
      )}
    >
      {isOver && (
        <div className="absolute inset-0 border-2 border-amber-400 border-dashed rounded-lg animate-pulse z-10 flex items-center justify-center pointer-events-none">
          <span className="text-amber-700 dark:text-amber-300 font-semibold text-xs px-2 py-1 bg-background/90 rounded">
            Zuordnung entfernen
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

export function ProScheduleCalendar({
  employees,
  allEmployees,
  appointments,
  abwesenheiten = [],
  weekDates,
  activeAppointmentId,
  onEditAppointment,
  onSlotClick,
  conflictingAppointments,
  onCut,
  onCopy,
  highlightedAppointmentId,
  hiddenEmployeeIds = new Set(),
  onToggleEmployee,
  onReorderEmployees,
}: ProScheduleCalendarProps) {

  const popoverSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedAllEmployees = useMemo(() => {
    return [...(allEmployees || employees)].filter((e) => e.ist_aktiv);
  }, [allEmployees, employees]);

  const handlePopoverDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && onReorderEmployees) {
      const oldIndex = sortedAllEmployees.findIndex(e => e.id === active.id);
      const newIndex = sortedAllEmployees.findIndex(e => e.id === over.id);
      const reordered = arrayMove(sortedAllEmployees, oldIndex, newIndex);
      onReorderEmployees(reordered.map(e => e.id));
    }
  };
  
  const getAppointmentsForEmployeeAndDate = (employeeId: string, date: Date) => {
    return appointments
      .filter((app) => app.mitarbeiter_id === employeeId && isSameDay(new Date(app.start_at), date))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  const getUnassignedForDate = (date: Date) =>
    appointments
      .filter((app) => !app.mitarbeiter_id && isSameDay(new Date(app.start_at), date))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const hasUnassignedThisWeek = weekDates.some((d) => getUnassignedForDate(d).length > 0);

  // Calculate weekly hours for each employee
  const getWeeklyHours = (employeeId: string) => {
    const weekApps = appointments.filter(app => 
      app.mitarbeiter_id === employeeId &&
      weekDates.some(d => isSameDay(new Date(app.start_at), d))
    );
    
    const totalMinutes = weekApps.reduce((sum, app) => {
      const start = new Date(app.start_at);
      const end = new Date(app.end_at);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);
    
    return Math.round(totalMinutes / 60);
  };

  // Check if employee has absence on a date
  const getAbwesenheit = (employeeId: string, date: Date): Abwesenheit | undefined => {
    return abwesenheiten.find(a => {
      if (a.mitarbeiter_id !== employeeId) return false;
      // Parse tstzrange - format: ["2024-02-12","2024-02-18"]
      try {
        const rangeMatch = a.zeitraum.match(/\[?"?(\d{4}-\d{2}-\d{2}).*?,.*?"?(\d{4}-\d{2}-\d{2})/);
        if (rangeMatch) {
          const start = new Date(rangeMatch[1]);
          const end = new Date(rangeMatch[2]);
          return date >= start && date <= end;
        }
      } catch {
        return false;
      }
      return false;
    });
  };

  const today = new Date();

  return (
    <div className="bg-card">
      {/* Header Row — sticky */}
      <div className="grid border-b border-border bg-card sticky top-0 z-20"
           style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}>
        {/* Mitarbeiter Header with Settings */}
        <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border flex items-center justify-between">
          <span>Mitarbeiter</span>
          {onToggleEmployee && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-0" sideOffset={8}>
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mitarbeiter verwalten</p>
                  <p className="text-xs text-muted-foreground mt-1">Ziehen zum Sortieren · Auge zum Ein-/Ausblenden</p>
                </div>

                <PopoverEmployeeFilter
                  allEmployees={sortedAllEmployees}
                  hiddenEmployeeIds={hiddenEmployeeIds}
                  onToggleEmployee={onToggleEmployee!}
                  popoverSensors={popoverSensors}
                  handlePopoverDragEnd={handlePopoverDragEnd}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
        
        {/* Day Headers */}
        {weekDates.map((date) => {
          const isToday = isSameDay(date, today);
          const dayName = format(date, 'EEE', { locale: de }).toUpperCase();
          
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "px-2 py-3 text-center border-r border-border last:border-r-0",
                isToday && "bg-primary/10"
              )}
            >
              <div className={cn(
                "text-xs font-medium",
                isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {dayName}
              </div>
              <div className={cn(
                "text-lg font-bold",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {format(date, 'dd.MM.')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unzugeordnete Termine — immer sichtbar, sticky unter dem Header */}
      <div
        className={cn(
          "grid border-b sticky z-10",
          hasUnassignedThisWeek
            ? "border-amber-300/70 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950"
            : "border-border bg-card"
        )}
        style={{ gridTemplateColumns: '220px repeat(7, 1fr)', top: '65px' }}
      >
        <div className={cn(
          "px-4 border-r border-border flex items-center gap-2",
          hasUnassignedThisWeek ? "py-2 min-h-[48px]" : "py-1.5"
        )}>
          <UserX className={cn("h-3.5 w-3.5 shrink-0", hasUnassignedThisWeek ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/50")} />
          <div className="text-xs font-medium text-muted-foreground leading-tight">
            Offen
            {hasUnassignedThisWeek && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                ({appointments.filter(a => !a.mitarbeiter_id).length})
              </span>
            )}
          </div>
        </div>
        {weekDates.map((date) => {
          const unassigned = getUnassignedForDate(date);
          const dropId = `unassigned-${format(date, 'yyyy-MM-dd')}`;
          const isToday = isSameDay(date, today);
          return (
            <div
              key={date.toISOString()}
              className={cn(
                'border-r border-border last:border-r-0',
                isToday && 'bg-primary/5'
              )}
            >
              <UnassignedDropCell id={dropId}>
                <div className="space-y-1.5">
                  {unassigned.map((appointment) => (
                    <ProAppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      isDragging={activeAppointmentId === appointment.id}
                      isConflicting={false}
                      isHighlighted={highlightedAppointmentId === appointment.id}
                      onClick={() => onEditAppointment(appointment)}
                      onCut={() => onCut(appointment)}
                    />
                  ))}
                </div>
              </UnassignedDropCell>
            </div>
          );
        })}
      </div>

      {/* Employee Rows */}
      <div className="divide-y divide-border">
        {employees.map((employee) => {
          const weekHours = getWeeklyHours(employee.id);
          const sollStunden = employee.soll_wochenstunden || 40;
          const initials = employee.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          
          // Check for week-spanning absence
          const hasAbsenceThisWeek = weekDates.some(d => getAbwesenheit(employee.id, d));
          
          return (
            <div 
              key={employee.id} 
              className="grid hover:bg-muted/20 transition-colors"
              style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}
            >
              {/* Employee Info Column */}
              <div className="px-4 py-3 border-r border-border bg-card flex items-center gap-3">
                <div 
                  className="relative"
                  style={{ '--ring-color': employee.farbe_kalender } as React.CSSProperties}
                >
                  <Avatar className="h-10 w-10 ring-2 ring-offset-2 ring-offset-background" style={{ boxShadow: `0 0 0 2px ${employee.farbe_kalender}` }}>
                    <AvatarImage src={employee.avatar_url || undefined} alt={employee.name} />
                    <AvatarFallback 
                      className="text-white font-semibold text-sm"
                      style={{ backgroundColor: employee.farbe_kalender }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {employee.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-xs font-medium",
                      weekHours > sollStunden ? "text-destructive" : "text-primary"
                    )}>
                      {weekHours}/{sollStunden} Std.
                    </span>
                    {employee.rolle && employee.rolle !== 'mitarbeiter' && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        {ROLE_LABELS[employee.rolle] || employee.rolle}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Day Cells */}
              {weekDates.map((date) => {
                const dayAppointments = getAppointmentsForEmployeeAndDate(employee.id, date);
                const abwesenheit = getAbwesenheit(employee.id, date);
                const dropZoneId = `${employee.id}-${format(date, 'yyyy-MM-dd')}`;
                const isToday = isSameDay(date, today);

                return (
                  <div 
                    key={date.toISOString()} 
                    className={cn(
                      "min-h-[100px] border-r border-border last:border-r-0 relative",
                      isToday && "bg-primary/5"
                    )}
                  >
                    {abwesenheit ? (
                      <div className="h-full flex items-center justify-center p-2">
                        <div className="text-xs text-muted-foreground italic text-center">
                          <span className="text-primary/70">{TYP_LABELS[abwesenheit.typ || 'urlaub'] || 'Abwesenheit'}</span>
                          <br />
                          {abwesenheit.grund || ''}
                        </div>
                      </div>
                    ) : (
                      <EnhancedDropZone
                        id={dropZoneId}
                        isEmpty={dayAppointments.length === 0}
                        isWeekend={false}
                        employeeName={employee.name}
                        date={format(date, 'dd.MM.yyyy')}
                        onClick={() => onSlotClick(employee.id, date)}
                        className="h-full p-2"
                      >
                        <div className="space-y-1.5">
                          {dayAppointments.map((appointment) => (
                            <ProAppointmentCard
                              key={appointment.id}
                              appointment={appointment}
                              isDragging={activeAppointmentId === appointment.id}
                              isConflicting={conflictingAppointments.has(appointment.id)}
                              isHighlighted={highlightedAppointmentId === appointment.id}
                              onClick={() => onEditAppointment(appointment)}
                              onCut={() => onCut(appointment)}
                            />
                          ))}
                        </div>
                      </EnhancedDropZone>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
