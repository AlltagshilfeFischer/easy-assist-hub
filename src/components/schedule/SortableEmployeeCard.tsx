import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { User, Phone, Mail, TrendingUp, AlertTriangle, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  vorname: string;
  nachname: string;
  name: string;
  email: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  farbe_kalender: string;
  workload: number;
}

interface SortableEmployeeCardProps {
  employee: Employee;
  currentAppointments?: number;
  className?: string;
}

export function SortableEmployeeCard({ employee, currentAppointments = 0, className }: SortableEmployeeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `employee-sort-${employee.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const workloadPercentage = (currentAppointments / (employee.max_termine_pro_tag || 8)) * 100;
  
  const getWorkloadColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600 bg-red-100';
    if (percentage >= 80) return 'text-orange-600 bg-orange-100';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getWorkloadIcon = (percentage: number) => {
    if (percentage >= 100) return <AlertTriangle className="h-4 w-4" />;
    return <TrendingUp className="h-4 w-4" />;
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-200 hover:shadow-sm border cursor-move',
        isDragging && 'opacity-50 scale-105 shadow-lg z-50',
        className
      )}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2 mb-2">
          <div
            {...attributes}
            {...listeners}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div 
            className="w-4 h-4 rounded-full border border-white shadow-sm flex-shrink-0" 
            style={{ backgroundColor: employee.farbe_kalender }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{employee.name}</h3>
          </div>
          <Badge 
            variant={employee.ist_aktiv ? "default" : "secondary"}
            className="text-xs flex-shrink-0"
          >
            {employee.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-1 truncate">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{employee.telefon}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            {getWorkloadIcon(workloadPercentage)}
            <span className="text-muted-foreground">Auslastung:</span>
          </div>
          <span className={cn('px-2 py-1 rounded-full font-medium text-xs', getWorkloadColor(workloadPercentage))}>
            {currentAppointments}/{employee.max_termine_pro_tag || 8}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}