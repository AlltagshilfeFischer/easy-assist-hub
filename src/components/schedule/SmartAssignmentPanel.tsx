import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeeSuggestionCard } from './EmployeeSuggestionCard';
import { Sparkles, Zap, Clock, Users, Filter } from 'lucide-react';
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

interface Appointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  customer?: any;
  employee?: Employee;
}

interface SmartAssignmentPanelProps {
  employees: Employee[];
  appointments: Appointment[];
  openAppointments: Appointment[];
  onAssignAppointment: (appointmentId: string, employeeId: string) => void;
  onAutoAssign: () => void;
  className?: string;
}

export function SmartAssignmentPanel({ 
  employees, 
  appointments, 
  openAppointments, 
  onAssignAppointment, 
  onAutoAssign,
  className 
}: SmartAssignmentPanelProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<string>('');
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'available' | 'optimal'>('optimal');

  // Calculate suggestions for the selected appointment
  const suggestions = useMemo(() => {
    if (!selectedAppointment) return [];

    const appointment = openAppointments.find(app => app.id === selectedAppointment);
    if (!appointment) return [];

    return employees
      .filter(emp => emp.ist_aktiv)
      .map(employee => {
        const currentAppointments = appointments.filter(app => app.mitarbeiter_id === employee.id).length;
        const workloadPercentage = (currentAppointments / (employee.max_termine_pro_tag || 8)) * 100;
        
        let score = 100;
        const reasons: string[] = [];

        // Workload scoring
        if (workloadPercentage >= 100) {
          score = 0;
          reasons.push('Bereits ausgelastet');
        } else if (workloadPercentage >= 80) {
          score -= 30;
          reasons.push('Hohe Auslastung');
        } else if (workloadPercentage <= 50) {
          score += 10;
          reasons.push('Niedrige Auslastung');
        }

        // Availability scoring (could be enhanced with real availability data)
        if (workloadPercentage <= 60) {
          score += 15;
          reasons.push('Gut verfügbar');
        }

        // Experience scoring (simplified - could use historical data)
        if (employee.max_termine_pro_tag && employee.max_termine_pro_tag >= 8) {
          score += 10;
          reasons.push('Erfahrener Mitarbeiter');
        }

        // Balance scoring - prefer employees with fewer appointments
        const avgAppointments = appointments.length / employees.filter(e => e.ist_aktiv).length;
        if (currentAppointments < avgAppointments) {
          score += 20;
          reasons.push('Ausgleich der Arbeitsbelastung');
        }

        return {
          employee,
          score: Math.max(0, Math.min(100, score)),
          reasons,
          currentAppointments
        };
      })
      .filter(suggestion => {
        switch (suggestionFilter) {
          case 'available':
            return suggestion.score > 0;
          case 'optimal':
            return suggestion.score >= 70;
          default:
            return true;
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [selectedAppointment, employees, appointments, openAppointments, suggestionFilter]);

  const handleAssign = async (employeeId: string) => {
    if (selectedAppointment) {
      await onAssignAppointment(selectedAppointment, employeeId);
      setSelectedAppointment('');
    }
  };

  return (
    <Card className={cn('border shadow-sm', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Smart Assignment
          <Badge variant="outline" className="text-xs ml-auto bg-purple-50 text-purple-700">
            KI-gestützt
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="space-y-2">
          <Button 
            onClick={onAutoAssign} 
            className="w-full h-8 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            disabled={openAppointments.length === 0}
          >
            <Zap className="h-3 w-3 mr-2" />
            Alle automatisch zuweisen ({openAppointments.length})
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Nach Zeit
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Users className="h-3 w-3 mr-1" />
              Nach Last
            </Button>
          </div>
        </div>

        {/* Appointment Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Termin auswählen für Empfehlungen:
          </label>
          <Select value={selectedAppointment} onValueChange={setSelectedAppointment}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Termin auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {openAppointments.map((appointment) => (
                <SelectItem key={appointment.id} value={appointment.id}>
                  <div className="flex items-center gap-2">
                    <span>{appointment.titel}</span>
                    <Badge variant="outline" className="text-xs">
                      {new Date(appointment.start_at).toLocaleDateString('de-DE')}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Suggestions */}
        {selectedAppointment && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Empfehlungen:
              </label>
              <Select value={suggestionFilter} onValueChange={(value: any) => setSuggestionFilter(value)}>
                <SelectTrigger className="h-6 w-20 text-xs">
                  <Filter className="h-3 w-3" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="available">Verfügbar</SelectItem>
                  <SelectItem value="optimal">Optimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <EmployeeSuggestionCard
                    key={suggestion.employee.id}
                    suggestion={suggestion}
                    onAssign={handleAssign}
                  />
                ))
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Keine passenden Mitarbeiter gefunden
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{employees.filter(e => e.ist_aktiv).length}</div>
            <div className="text-xs text-muted-foreground">Verfügbar</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{openAppointments.length}</div>
            <div className="text-xs text-muted-foreground">Offen</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}