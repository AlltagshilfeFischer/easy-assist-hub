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
    status: string;
    customer?: Customer;
  };
  isDragging?: boolean;
  isAssigned?: boolean;
  isConflicting?: boolean;
  onClick?: () => void;
}

export function DraggableAppointment({ 
  appointment, 
  isDragging = false, 
  isAssigned = false,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unassigned':
        return 'bg-gradient-to-r from-amber-100 to-orange-200 border-2 border-orange-400 shadow-lg hover:shadow-xl ring-2 ring-orange-200';
      case 'scheduled':
        return 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300';
      case 'in_progress':
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300';
      case 'completed':
        return 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 hover:border-green-300';
      case 'cancelled':
        return 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 hover:border-red-300';
      default:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unassigned':
        return <Badge className="bg-orange-500 text-white border-0 text-xs px-2 py-1 font-bold animate-pulse">ZUORDNUNG ERFORDERLICH</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-700 border-blue-300 text-xs px-1 py-0">Geplant</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-xs px-1 py-0">In Bearbeitung</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-700 border-green-300 text-xs px-1 py-0">Abgeschlossen</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-700 border-red-300 text-xs px-1 py-0">Abgesagt</Badge>;
      default:
        return <Badge variant="outline" className="text-xs px-1 py-0">Unbekannt</Badge>;
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={cn(
        'p-3 border-2 transition-all duration-300 cursor-grab active:cursor-grabbing hover:shadow-lg text-xs group rounded-lg',
        getStatusColor(appointment.status),
        isDragging && 'opacity-50 scale-105 shadow-xl ring-2 ring-primary/20 z-50',
        isAssigned && 'border-dashed',
        isConflicting && 'ring-2 ring-red-500 ring-opacity-50 border-red-300 animate-pulse',
        'hover:scale-105 hover:shadow-xl active:scale-95 transform',
        !isDragging && 'hover:border-primary/40',
        appointment.status === 'unassigned' && 'hover:scale-110 hover:rotate-1 hover:shadow-2xl'
      )}
    >
      <div className="space-y-2">
        {/* Status Badge prominently displayed at top */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
              <GripVertical className="h-4 w-4" />
            </div>
            {appointment.status === 'unassigned' && (
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            )}
          </div>
          {getStatusBadge(appointment.status)}
        </div>

        {/* Appointment Title - Large and prominent */}
        <h4 className={cn(
          "font-bold text-sm leading-tight group-hover:text-primary transition-colors",
          appointment.status === 'unassigned' && "text-orange-800 text-base"
        )}>
          {appointment.titel}
        </h4>
        
        {/* Customer Info - Very prominent for unassigned */}
        {appointment.customer && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-md bg-white/50",
            appointment.status === 'unassigned' && "bg-orange-50 border border-orange-200"
          )}>
            <User className={cn(
              "h-4 w-4 flex-shrink-0",
              appointment.status === 'unassigned' ? "text-orange-600" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-semibold text-sm",
              appointment.status === 'unassigned' ? "text-orange-800" : "text-muted-foreground"
            )}>
              {appointment.customer.vorname} {appointment.customer.nachname}
            </span>
          </div>
        )}
        
        {/* Time Info */}
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">
            {format(new Date(appointment.start_at), 'HH:mm')} - {format(new Date(appointment.end_at), 'HH:mm')}
          </span>
        </div>

        {/* Assignment Instruction for unassigned appointments */}
        {appointment.status === 'unassigned' && (
          <div className="text-xs text-orange-700 font-medium bg-orange-100 p-1 rounded text-center">
            ⤴ Auf Mitarbeiter ziehen
          </div>
        )}
      </div>
    </Card>
  );
}