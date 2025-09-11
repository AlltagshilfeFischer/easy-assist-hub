import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
}

interface DraggableAppointmentProps {
  appointment: {
    id: string;
    titel: string;
    start_at: string;
    end_at: string;
    mitarbeiter_id: string | null;
    customer?: Customer;
  };
  isDragging?: boolean;
  isConflicting?: boolean;
  onClick?: () => void;
}

export function DraggableAppointment({
  appointment,
  isDragging,
  isConflicting,
  onClick
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200",
        "border border-muted bg-card hover:bg-accent/30 rounded-md p-2 shadow-sm",
        "text-xs min-w-[90px] max-w-[120px]",
        isDragging && "opacity-50 scale-95 z-50",
        isConflicting && "border-destructive bg-destructive/5"
      )}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {/* Customer Name */}
      <div className="font-medium text-foreground truncate mb-1">
        {appointment.customer?.vorname} {appointment.customer?.nachname}
      </div>
      
      {/* Time */}
      <div className="text-muted-foreground">
        {format(new Date(appointment.start_at), 'HH:mm')}
      </div>

      {/* Title if meaningful */}
      {appointment.titel && appointment.titel !== 'Aktueller Termin' && (
        <div className="text-muted-foreground/70 mt-1 truncate text-xs">
          {appointment.titel}
        </div>
      )}
    </div>
  );
}