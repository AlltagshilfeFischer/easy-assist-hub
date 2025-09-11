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
        return 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300';
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
        return <Badge variant="outline" className="text-orange-700 border-orange-300 text-xs px-1 py-0">Unzugewiesen</Badge>;
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
        'p-2 border-2 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-md text-xs group',
        getStatusColor(appointment.status),
        isDragging && 'opacity-50 scale-105 shadow-xl ring-2 ring-primary/20 z-50',
        isAssigned && 'border-dashed',
        isConflicting && 'ring-2 ring-red-500 ring-opacity-50 border-red-300 animate-pulse',
        'hover:scale-102 hover:shadow-lg active:scale-95',
        !isDragging && 'hover:border-primary/40'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="text-muted-foreground group-hover:text-primary transition-colors mt-0.5 flex-shrink-0">
          <GripVertical className="h-3 w-3" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <h4 className="font-semibold text-sm truncate leading-tight group-hover:text-primary transition-colors">{appointment.titel}</h4>
            <div className="flex-shrink-0">
              {getStatusBadge(appointment.status)}
            </div>
          </div>
          
          <div className="space-y-1">
            {appointment.customer && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate font-medium">
                  {appointment.customer.vorname} {appointment.customer.nachname}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className="truncate font-medium">
                {format(new Date(appointment.start_at), 'HH:mm')} - {format(new Date(appointment.end_at), 'HH:mm')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}