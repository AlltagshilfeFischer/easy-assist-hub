import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, User, MapPin, GripVertical, Calendar } from 'lucide-react';
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
    customer?: Customer & {
      availability?: Array<{
        wochentag: number;
        von: string;
        bis: string;
        prioritaet: number;
      }>;
    };
  };
  isDragging?: boolean;
  isConflicting?: boolean;
  onClick?: () => void;
}

export function DraggableAppointment({ 
  appointment, 
  isDragging = false, 
  isConflicting = false,
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

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd.MM');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200",
        "border rounded-md p-2 bg-card hover:bg-accent/50 shadow-sm",
        "min-w-[100px] text-xs",
        isDragging && "opacity-60 scale-95",
        isConflicting && "border-destructive bg-destructive/10"
      )}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {/* Customer Name - most prominent */}
      <div className="font-medium text-foreground truncate">
        {appointment.customer?.vorname} {appointment.customer?.nachname}
      </div>
      
      {/* Date and Time - essential info */}
      <div className="text-muted-foreground mt-1">
        {formatDate(appointment.start_at)} • {formatTime(appointment.start_at)}
      </div>

      {/* Title if different from customer name */}
      {appointment.titel && (
        <div className="text-muted-foreground/70 mt-1 truncate">
          {appointment.titel}
        </div>
      )}
    </div>
  );
}