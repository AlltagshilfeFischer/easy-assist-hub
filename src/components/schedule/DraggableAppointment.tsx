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
import { Scissors, Copy, MapPin } from "lucide-react";
import type { CalendarAppointment } from '@/types/domain';

interface DraggableAppointmentProps {
  appointment: Pick<CalendarAppointment, 'id' | 'titel' | 'start_at' | 'end_at' | 'mitarbeiter_id' | 'customer' | 'notizen' | 'ausweichort' | 'ausweichort_id'>;
  isDragging?: boolean;
  isConflicting?: boolean;
  onClick?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
}

export function DraggableAppointment({
  appointment,
  isDragging,
  isConflicting,
  onClick,
  onCut,
  onCopy
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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{
            ...style,
            backgroundColor: customerColor,
            opacity: isDragging ? 0.5 : 1
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
          {/* Notiz-Indikator */}
          {appointment.notizen && (
            <div className="absolute top-1 right-1 z-10" title={`Notiz: ${appointment.notizen}`}>
              <div className="w-2 h-2 rounded-full bg-white/80 shadow-sm" />
            </div>
          )}

          {/* Compact layout for more appointments */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white truncate text-xs drop-shadow-sm">
                {appointment.customer?.name}
              </div>
              {appointment.ausweichort ? (
                <div className="flex items-center gap-0.5">
                  <MapPin className="h-2 w-2 text-amber-200 flex-shrink-0" />
                  <span className="text-[9px] text-amber-200 truncate">{appointment.ausweichort.name}</span>
                </div>
              ) : appointment.customer?.stadtteil ? (
                <div className="flex items-center gap-0.5">
                  <MapPin className="h-2 w-2 text-white/70 flex-shrink-0" />
                  <span className="text-[9px] text-white/70 truncate">{appointment.customer.stadtteil}</span>
                </div>
              ) : null}
            </div>
            <div className="text-white/90 text-xs flex-shrink-0 font-medium drop-shadow-sm">
              {format(new Date(appointment.start_at), 'HH:mm')}
            </div>
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