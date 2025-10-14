import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { User, Phone, Mail, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  vorname?: string;
  nachname?: string;
  name: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  farbe_kalender: string;
  workload: number;
  benutzer?: {
    email: string;
    vorname: string;
    nachname: string;
  };
}

interface EmployeeCardProps {
  employee: Employee;
  currentAppointments?: number;
  className?: string;
}

export function EmployeeCard({ employee, currentAppointments = 0, className }: EmployeeCardProps) {
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
    <Card className={cn('transition-all duration-200 hover:shadow-sm border', className)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-3">
          <div 
            className="w-3 h-3 rounded-full border border-white shadow-sm mt-0.5 flex-shrink-0" 
            style={{ backgroundColor: employee.farbe_kalender }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{employee.name}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {employee.benutzer?.vorname && employee.benutzer?.nachname 
                ? `${employee.benutzer.vorname} ${employee.benutzer.nachname}` 
                : 'Kein Name'}
            </p>
          </div>
          <Badge 
            variant={employee.ist_aktiv ? "default" : "secondary"}
            className="text-xs flex-shrink-0"
          >
            {employee.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{employee.telefon}</span>
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