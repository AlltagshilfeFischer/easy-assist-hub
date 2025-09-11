import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, User, MapPin, GripVertical } from 'lucide-react';
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

  const isUnassigned = !appointment.mitarbeiter_id;
  
  const getCardStyle = () => {
    if (isUnassigned) {
      return 'bg-muted/50 border border-muted-foreground/20 hover:border-muted-foreground/40';
    }
    return 'bg-card border border-border hover:border-primary/40';
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={cn(
        'transition-all duration-200 cursor-grab active:cursor-grabbing text-xs group rounded-md',
        getCardStyle(),
        isDragging && 'opacity-50 scale-105 shadow-lg ring-2 ring-primary/20 z-50',
        isConflicting && 'ring-2 ring-red-500 ring-opacity-50 border-red-300',
        isUnassigned ? 'p-2 hover:scale-102' : 'p-3 hover:scale-105 hover:shadow-lg'
      )}
    >
      <div className={cn("space-y-1", isUnassigned && "space-y-1")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
              <GripVertical className={cn("h-3 w-3", isUnassigned && "h-2.5 w-2.5")} />
            </div>
          </div>
          {isUnassigned && (
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
          )}
        </div>

        <h4 className={cn(
          "font-medium leading-tight group-hover:text-primary transition-colors",
          isUnassigned ? "text-xs text-muted-foreground" : "text-sm"
        )}>
          {appointment.titel}
        </h4>
        
        {appointment.customer && (
          <div className={cn(
            "flex items-center gap-1",
            isUnassigned ? "p-1" : "p-2 rounded-md bg-white/50"
          )}>
            <User className={cn(
              "flex-shrink-0 text-muted-foreground",
              isUnassigned ? "h-2.5 w-2.5" : "h-4 w-4"
            )} />
            <span className={cn(
              "font-medium",
              isUnassigned ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"
            )}>
              {appointment.customer.vorname} {appointment.customer.nachname}
            </span>
          </div>
        )}
        
        <div className={cn("flex items-center gap-1", isUnassigned ? "text-xs" : "text-xs")}>
          <Clock className={cn(
            "flex-shrink-0 text-muted-foreground",
            isUnassigned ? "h-2.5 w-2.5" : "h-3 w-3"
          )} />
          <span className="font-medium text-muted-foreground">
            {format(new Date(appointment.start_at), 'HH:mm')} - {format(new Date(appointment.end_at), 'HH:mm')}
          </span>
        </div>
      </div>
    </Card>
  );
}