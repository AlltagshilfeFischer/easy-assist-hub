import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Scissors, Copy, MapPin, Tag, MessageSquare } from "lucide-react";
import type { CalendarAppointment, TerminKategorie } from '@/types/domain';

interface DraggableAppointmentProps {
  appointment: Pick<CalendarAppointment, 'id' | 'titel' | 'start_at' | 'end_at' | 'mitarbeiter_id' | 'customer' | 'notizen' | 'ausweichort' | 'ausweichort_id' | 'status' | 'kategorie' | 'ma_kommentar'>;
  isDragging?: boolean;
  isConflicting?: boolean;
  onClick?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  cancelled:             'Kurzfristig',
  abgesagt_rechtzeitig:  'Abgesagt',
  nicht_angetroffen:     'N. angetr.',
  completed:             'Abgeschl.',
  abgerechnet:           'Abger.',
  bezahlt:               'Bezahlt',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  cancelled:             'bg-red-600/90',
  abgesagt_rechtzeitig:  'bg-slate-500/90',
  nicht_angetroffen:     'bg-amber-500/90',
  completed:             'bg-green-600/90',
  abgerechnet:           'bg-emerald-600/90',
  bezahlt:               'bg-teal-600/90',
};

const KATEGORIE_COLORS: Record<TerminKategorie, string> = {
  Kundentermin:         'bg-blue-500/80',
  Erstgespräch:         'bg-violet-500/80',
  Schulung:             'bg-indigo-500/80',
  Meeting:              'bg-cyan-600/80',
  Bewerbungsgespräch:   'bg-purple-500/80',
  Blocker:              'bg-red-700/80',
  Intern:               'bg-gray-500/80',
  Regelbesuch:          'bg-sky-500/80',
  Sonstiges:            'bg-stone-500/80',
};

const TERMINATED_STATUSES = new Set(['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig']);

export function DraggableAppointment({
  appointment,
  isDragging,
  isConflicting,
  onClick,
  onCut,
  onCopy,
}: DraggableAppointmentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({ id: appointment.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  const customerColor = appointment.customer?.farbe_kalender || '#10B981';
  const status = appointment.status ?? '';
  const isTerminated = TERMINATED_STATUSES.has(status);
  const statusLabel = STATUS_LABEL[status];
  const statusBadgeClass = STATUS_BADGE_CLASS[status];
  const kategorieColor = appointment.kategorie
    ? KATEGORIE_COLORS[appointment.kategorie as TerminKategorie] ?? 'bg-stone-500/80'
    : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            ...style,
            backgroundColor: customerColor,
            opacity: isDragging ? 0.5 : isTerminated ? 0.65 : 1,
          }}
          className={cn(
            "relative cursor-grab active:cursor-grabbing transition-all duration-200",
            "border border-white/20 rounded-md p-1.5 shadow-sm",
            "text-xs w-full min-h-[32px] flex-shrink-0 box-border overflow-hidden",
            isDragging && "scale-95 z-50",
            isConflicting && "border-destructive border-2"
          )}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {/* Indikator-Punkte oben rechts */}
          <div className="absolute top-1 right-1 z-10 flex gap-0.5">
            {appointment.notizen && (
              <div className="w-2 h-2 rounded-full bg-amber-300/90 shadow-sm" title={`Notiz: ${appointment.notizen}`} />
            )}
            {appointment.ma_kommentar && (
              <div className="w-2 h-2 rounded-full bg-white/80 shadow-sm" title={`MA-Kommentar: ${appointment.ma_kommentar}`} />
            )}
          </div>

          {/* Uhrzeit + Kundenname */}
          <div className="flex items-start justify-between gap-1 pr-4">
            <div className="font-semibold text-white truncate text-xs drop-shadow-sm leading-tight"
              style={{ textDecoration: isTerminated ? 'line-through' : 'none' }}
            >
              {appointment.customer?.name || appointment.titel}
            </div>
            <div className="text-white/90 text-xs flex-shrink-0 font-medium drop-shadow-sm leading-tight">
              {format(new Date(appointment.start_at), 'HH:mm')}
            </div>
          </div>

          {/* Ort: Ausweichort oder Stadtteil */}
          {appointment.ausweichort ? (
            <div className="flex items-center gap-0.5 mt-0.5">
              <MapPin className="h-2 w-2 text-amber-200 flex-shrink-0" />
              <span className="text-[9px] text-amber-200 truncate">{appointment.ausweichort.name}</span>
            </div>
          ) : appointment.customer?.stadtteil ? (
            <div className="flex items-center gap-0.5 mt-0.5">
              <MapPin className="h-2 w-2 text-white/70 flex-shrink-0" />
              <span className="text-[9px] text-white/70 truncate">{appointment.customer.stadtteil}</span>
            </div>
          ) : null}

          {/* Badges: Status + Kategorie */}
          {(statusLabel || kategorieColor) && (
            <div className="flex flex-wrap items-center gap-0.5 mt-1">
              {statusLabel && (
                <span className={cn(
                  "inline-block rounded px-1 py-0 text-[9px] font-semibold text-white leading-4",
                  statusBadgeClass ?? 'bg-gray-600/80'
                )}>
                  {statusLabel}
                </span>
              )}
              {appointment.kategorie && kategorieColor && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded px-1 py-0 text-[9px] font-medium text-white leading-4",
                  kategorieColor
                )}>
                  <Tag className="h-2 w-2 flex-shrink-0" />
                  {appointment.kategorie}
                </span>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={(e) => {
          e.stopPropagation();
          onCut?.();
        }}>
          <Scissors className="mr-2 h-4 w-4" />
          Ausschneiden
        </ContextMenuItem>
        <ContextMenuItem onClick={(e) => {
          e.stopPropagation();
          onCopy?.();
        }}>
          <Copy className="mr-2 h-4 w-4" />
          Kopieren
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
