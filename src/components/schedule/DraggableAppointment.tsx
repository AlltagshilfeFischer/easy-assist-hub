import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Scissors, MapPin } from "lucide-react";
import type { CalendarAppointment } from '@/types/domain';

interface DraggableAppointmentProps {
  appointment: Pick<CalendarAppointment, 'id' | 'titel' | 'start_at' | 'end_at' | 'mitarbeiter_id' | 'customer'>;
  isDragging?: boolean;
  isConflicting?: boolean;
  onClick?: () => void;
  onCut?: () => void;
}

export function DraggableAppointment({
  appointment,
  isDragging,
  isConflicting,
  onClick,
  onCut
}: DraggableAppointmentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: appointment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
            "cursor-grab active:cursor-grabbing transition-all duration-200",
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
          {/* Compact layout for more appointments */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white truncate text-xs drop-shadow-sm">
                {appointment.customer?.name}
              </div>
              {appointment.customer?.stadtteil && (
                <div className="flex items-center gap-0.5">
                  <MapPin className="h-2 w-2 text-white/70 flex-shrink-0" />
                  <span className="text-[9px] text-white/70 truncate">{appointment.customer.stadtteil}</span>
                </div>
              )}
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
      </ContextMenuContent>
    </ContextMenu>
  );
}