import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Clock, MapPin, Phone, Mail, Calendar, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  email: string;
  telefon: string;
}

interface Employee {
  id: string;
  vorname?: string;
  nachname?: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  benutzer?: {
    email: string;
    vorname: string;
    nachname: string;
  };
}

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  mitarbeiter_id: string | null;
}

interface TimeSlot {
  wochentag: number;
  von: string;
  bis: string;
}

interface SmartMatchingPanelProps {
  customers: Customer[];
  employees: Employee[];
  appointments: Appointment[];
  customerAvailability: Record<string, TimeSlot[]>;
  onCreateAppointment: (customerId: string, employeeId: string) => void;
}

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function SmartMatchingPanel({
  customers,
  employees,
  appointments,
  customerAvailability,
  onCreateAppointment,
}: SmartMatchingPanelProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  const selectedCustomerData = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomer);
  }, [selectedCustomer, customers]);

  const customerTimeSlots = useMemo(() => {
    if (!selectedCustomer) return [];
    return customerAvailability[selectedCustomer] || [];
  }, [selectedCustomer, customerAvailability]);

  const matchingEmployees = useMemo(() => {
    if (!selectedCustomer || customerTimeSlots.length === 0) return [];

    return employees
      .filter((emp) => emp.ist_aktiv)
      .map((employee) => {
        const currentAppointments = appointments.filter(
          (app) => app.mitarbeiter_id === employee.id
        ).length;
        const workloadPercentage = (currentAppointments / (employee.max_termine_pro_tag || 8)) * 100;

        let matchScore = 0;
        const matchReasons: string[] = [];

        // Check availability overlap
        let hasTimeSlotMatch = false;
        customerTimeSlots.forEach((slot) => {
          // For simplicity, assume employee is available during customer time slots
          hasTimeSlotMatch = true;
          matchReasons.push(`Verfügbar ${WEEKDAY_NAMES[slot.wochentag]} ${slot.von}-${slot.bis}`);
        });

        if (hasTimeSlotMatch) matchScore += 40;

        // Check workload
        if (workloadPercentage < 50) {
          matchScore += 30;
          matchReasons.push('Geringe Auslastung');
        } else if (workloadPercentage < 80) {
          matchScore += 20;
          matchReasons.push('Moderate Auslastung');
        } else if (workloadPercentage < 100) {
          matchScore += 10;
          matchReasons.push('Hohe Auslastung');
        } else {
          matchReasons.push('Voll ausgelastet');
        }

        // Experience bonus
        if (employee.max_termine_pro_tag && employee.max_termine_pro_tag >= 8) {
          matchScore += 20;
          matchReasons.push('Erfahrener Mitarbeiter');
        }

        return {
          employee,
          matchScore: Math.min(100, matchScore),
          matchReasons,
          currentAppointments,
          workloadPercentage,
          canAssign: workloadPercentage < 100,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [selectedCustomer, customerTimeSlots, employees, appointments]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Smart Matching
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Kunde auswählen</label>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger>
              <SelectValue placeholder="Kunde wählen..." />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCustomerData && (
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {selectedCustomerData.name}
                </span>
              </div>
              {selectedCustomerData.telefon && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span className="text-xs">{selectedCustomerData.telefon}</span>
                </div>
              )}
              {selectedCustomerData.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="text-xs">{selectedCustomerData.email}</span>
                </div>
              )}
            </div>

            {customerTimeSlots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  Zeitfenster
                </div>
                <div className="flex flex-wrap gap-1">
                  {customerTimeSlots.map((slot, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {WEEKDAY_NAMES[slot.wochentag]} {slot.von}-{slot.bis}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Empfohlene Mitarbeiter ({matchingEmployees.length})
                </span>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-3">
                  {matchingEmployees.length > 0 ? (
                    matchingEmployees.map((match) => (
                      <div
                        key={match.employee.id}
                        className={cn(
                          'p-3 border rounded-lg space-y-2 transition-colors',
                          match.canAssign
                            ? 'hover:bg-muted/50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {match.employee.vorname} {match.employee.nachname}
                              </span>
                              <Badge
                                className={cn(
                                  'text-xs text-white',
                                  getScoreColor(match.matchScore)
                                )}
                              >
                                {match.matchScore}%
                              </Badge>
                            </div>
                            {match.employee.benutzer?.email && (
                              <div className="flex items-center gap-1 mt-1">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {match.employee.benutzer.email}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {match.currentAppointments}/{match.employee.max_termine_pro_tag || 8} Termine
                          </span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {Math.round(match.workloadPercentage)}% Auslastung
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {match.matchReasons.slice(0, 3).map((reason, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!match.canAssign}
                          onClick={() => onCreateAppointment(selectedCustomer, match.employee.id)}
                        >
                          {match.canAssign ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-2" />
                              Termin erstellen
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-2" />
                              Nicht verfügbar
                            </>
                          )}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {customerTimeSlots.length === 0
                        ? 'Keine Zeitfenster für diesen Kunden definiert'
                        : 'Keine passenden Mitarbeiter gefunden'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {!selectedCustomer && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Wählen Sie einen Kunden aus,</p>
            <p>um passende Mitarbeiter zu finden</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
