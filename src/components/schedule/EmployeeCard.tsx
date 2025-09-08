import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { User, Phone, Mail, TrendingUp, AlertTriangle } from 'lucide-react';
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
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
            style={{ backgroundColor: employee.farbe_kalender }}
          />
          <div className="flex-1">
            <h3 className="font-medium text-sm">{employee.name}</h3>
            <p className="text-xs text-muted-foreground">{employee.email}</p>
          </div>
          <Badge 
            variant={employee.ist_aktiv ? "default" : "secondary"}
            className="text-xs"
          >
            {employee.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Phone className="h-3 w-3" />
          <span>{employee.telefon}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            {getWorkloadIcon(workloadPercentage)}
            <span className={cn('px-2 py-1 rounded-full font-medium', getWorkloadColor(workloadPercentage))}>
              {currentAppointments}/{employee.max_termine_pro_tag || 8} Termine
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}