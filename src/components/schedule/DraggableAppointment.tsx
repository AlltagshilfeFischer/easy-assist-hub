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
      return 'bg-gradient-to-r from-amber-100 to-orange-200 border-2 border-orange-400 shadow-lg hover:shadow-xl ring-2 ring-orange-200';
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
        'p-3 transition-all duration-300 cursor-grab active:cursor-grabbing hover:shadow-lg text-xs group rounded-lg',
        getCardStyle(),
        isDragging && 'opacity-50 scale-105 shadow-xl ring-2 ring-primary/20 z-50',
        isConflicting && 'ring-2 ring-red-500 ring-opacity-50 border-red-300 animate-pulse',
        'hover:scale-105 hover:shadow-xl active:scale-95 transform',
        isUnassigned && 'hover:scale-110 hover:rotate-1 hover:shadow-2xl'
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
              <GripVertical className="h-4 w-4" />
            </div>
            {isUnassigned && (
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            )}
          </div>
          {isUnassigned && (
            <Badge className="bg-orange-500 text-white border-0 text-xs px-2 py-1 font-bold animate-pulse">
              ZUORDNUNG ERFORDERLICH
            </Badge>
          )}
        </div>

        <h4 className={cn(
          "font-bold text-sm leading-tight group-hover:text-primary transition-colors",
          isUnassigned && "text-orange-800 text-base"
        )}>
          {appointment.titel}
        </h4>
        
        {appointment.customer && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-md bg-white/50",
            isUnassigned && "bg-orange-50 border border-orange-200"
          )}>
            <User className={cn(
              "h-4 w-4 flex-shrink-0",
              isUnassigned ? "text-orange-600" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-semibold text-sm",
              isUnassigned ? "text-orange-800" : "text-muted-foreground"
            )}>
              {appointment.customer.vorname} {appointment.customer.nachname}
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">
            {format(new Date(appointment.start_at), 'HH:mm')} - {format(new Date(appointment.end_at), 'HH:mm')}
          </span>
        </div>

        {isUnassigned && (
          <div className="text-xs text-orange-700 font-medium bg-orange-100 p-1 rounded text-center">
            ⤴ Auf Mitarbeiter ziehen
          </div>
        )}
      </div>
    </Card>
  );
}