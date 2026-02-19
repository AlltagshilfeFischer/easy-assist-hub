import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarStatsProps {
  totalAppointments: number;
  assignedAppointments: number;
  unassignedAppointments: number;
  conflictCount: number;
  activeEmployees: number;
  totalEmployees: number;
  averageWorkload: number;
  className?: string;
}

export function CalendarStats({
  totalAppointments,
  assignedAppointments,
  unassignedAppointments,
  conflictCount,
  activeEmployees,
  totalEmployees,
  averageWorkload,
  className
}: CalendarStatsProps) {
  const stats = [
    {
      label: 'Gesamt Termine',
      value: totalAppointments,
      icon: Calendar,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      label: 'Zugewiesen',
      value: assignedAppointments,
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/10'
    },
    {
      label: 'Offen',
      value: unassignedAppointments,
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10'
    },
    {
      label: 'Konflikte',
      value: conflictCount,
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10'
    },
    {
      label: 'Aktive Mitarbeiter',
      value: `${activeEmployees}/${totalEmployees}`,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      label: 'Ø Auslastung',
      value: `${averageWorkload}%`,
      icon: TrendingUp,
      color: averageWorkload > 90 ? 'text-destructive' : averageWorkload > 70 ? 'text-warning' : 'text-success',
      bg: averageWorkload > 90 ? 'bg-destructive/10' : averageWorkload > 70 ? 'bg-warning/10' : 'bg-success/10'
    }
  ];

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4", className)}>
      {stats.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-2xl font-bold">
                  {stat.value}
                </div>
              </div>
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
