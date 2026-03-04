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
import { Scissors, AlertCircle, MapPin } from "lucide-react";
import type { CalendarAppointment } from '@/types/domain';

interface ProAppointmentCardProps {
  appointment: Pick<CalendarAppointment, 'id' | 'titel' | 'start_at' | 'end_at' | 'mitarbeiter_id' | 'customer'>;
  isDragging?: boolean;
  isConflicting?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  onCut?: () => void;
}

export function ProAppointmentCard({
  appointment,
  isDragging,
  isConflicting,
  isHighlighted,
  onClick,
  onCut
}: ProAppointmentCardProps) {
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

  const startTime = format(new Date(appointment.start_at), 'HH:mm');
  const endTime = format(new Date(appointment.end_at), 'HH:mm');
  const customerColor = appointment.customer?.farbe_kalender || '#10B981';
  
  // Determine border color based on status
  const getBorderColor = () => {
    if (isConflicting) return 'border-l-destructive';
    return 'border-l-success';
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "cursor-grab active:cursor-grabbing transition-all duration-200",
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
          <div className="p-2">
            {/* Time Range */}
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[11px] font-semibold text-foreground">
                {startTime} - {endTime}
              </span>
              {isConflicting && (
                <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
              )}
            </div>
            
            {/* Customer Name */}
            <div className="font-medium text-xs text-foreground truncate">
              {appointment.customer?.name || appointment.titel}
            </div>

            {/* Stadtteil Badge */}
            {appointment.customer?.stadtteil && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{appointment.customer.stadtteil}</span>
              </div>
            )}
            
            {/* Optional: Titel/Type */}
            {appointment.titel && appointment.customer?.name && appointment.titel !== appointment.customer.name && (
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                {appointment.titel}
              </div>
            )}
          </div>
          
          {/* Color indicator bar at bottom */}
          <div 
            className="h-1 w-full" 
            style={{ backgroundColor: customerColor }}
          />
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
