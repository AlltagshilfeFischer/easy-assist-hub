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
import { Scissors, Copy, AlertCircle, MapPin, Tag } from "lucide-react";
import type { CalendarAppointment } from '@/types/domain';

interface ProAppointmentCardProps {
  appointment: Pick<CalendarAppointment, 'id' | 'titel' | 'start_at' | 'end_at' | 'mitarbeiter_id' | 'customer' | 'notizen' | 'kategorie' | 'status'>;
  isDragging?: boolean;
  isConflicting?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
}

export function ProAppointmentCard({
  appointment,
  isDragging,
  isConflicting,
  isHighlighted,
  onClick,
  onCut,
  onCopy,
}: ProAppointmentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({ id: appointment.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const startTime = format(new Date(appointment.start_at), 'HH:mm');
  const endTime = format(new Date(appointment.end_at), 'HH:mm');
  const getBorderColor = () => {
    if (isConflicting) return 'border-l-destructive';
    switch (appointment.status) {
      case 'unassigned':            return 'border-l-orange-400';
      case 'scheduled':             return 'border-l-blue-400';
      case 'in_progress':           return 'border-l-yellow-400';
      case 'completed':             return 'border-l-green-500';
      case 'cancelled':             return 'border-l-red-500';
      case 'nicht_angetroffen':     return 'border-l-amber-500';
      case 'abgesagt_rechtzeitig':  return 'border-l-slate-400';
      case 'abgerechnet':           return 'border-l-emerald-500';
      case 'bezahlt':               return 'border-l-teal-500';
      default:                      return 'border-l-border';
    }
  };

  const isTerminated = ['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig'].includes(appointment.status ?? '');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          data-appointment-id={appointment.id}
          className={cn(
            "relative cursor-grab active:cursor-grabbing transition-all duration-200",
            "bg-card border border-border rounded-md overflow-hidden",
            "border-l-4 shadow-sm hover:shadow-md",
            getBorderColor(),
            isDragging && "opacity-50 scale-95 z-50 shadow-lg",
            isHighlighted && "ring-2 ring-primary ring-offset-1 animate-pulse",
            isConflicting && "bg-destructive/5"
          )}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {/* Notiz-Indikator — kleiner Punkt oben rechts */}
          {appointment.notizen && (
            <div className="absolute top-1.5 right-1.5 z-10" title={`Notiz: ${appointment.notizen}`}>
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
            </div>
          )}

          <div className="p-2">
            {/* Time Range */}
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className={cn("text-[11px] font-semibold text-foreground", isTerminated && "line-through opacity-60")}>
                {startTime} - {endTime}
              </span>
              {isConflicting && (
                <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
              )}
            </div>

            {/* Customer Name or Intern label */}
            <div className={cn("font-medium text-xs text-foreground truncate", isTerminated && "line-through opacity-60")}>
              {appointment.customer?.name || appointment.titel}
            </div>

            {/* Kategorie Badge */}
            {appointment.kategorie && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Tag className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{appointment.kategorie}</span>
              </div>
            )}

            {/* Stadtteil Badge */}
            {appointment.customer?.stadtteil && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{appointment.customer.stadtteil}</span>
              </div>
            )}
          </div>
          
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
