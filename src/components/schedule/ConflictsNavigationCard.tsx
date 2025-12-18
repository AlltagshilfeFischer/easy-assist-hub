import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Appointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  customer?: {
    id: string;
    name: string;
  };
  employee?: {
    id: string;
    name: string;
  };
}

interface ConflictsNavigationCardProps {
  appointments: Appointment[];
  onNavigateToConflict: (appointmentId: string) => void;
}

export function ConflictsNavigationCard({ 
  appointments, 
  onNavigateToConflict 
}: ConflictsNavigationCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Calculate conflicting appointments
  const conflictAppointments = useMemo(() => {
    const conflicts: Appointment[] = [];
    const conflictIds = new Set<string>();
    
    const sortedApps = [...appointments].sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    sortedApps.forEach((app, index) => {
      if (!app.mitarbeiter_id) return;
      
      for (let i = index + 1; i < sortedApps.length; i++) {
        const other = sortedApps[i];
        if (other.mitarbeiter_id !== app.mitarbeiter_id) continue;
        
        const appStart = new Date(app.start_at);
        const appEnd = new Date(app.end_at);
        const otherStart = new Date(other.start_at);
        const otherEnd = new Date(other.end_at);

        if (appStart < otherEnd && appEnd > otherStart) {
          if (!conflictIds.has(app.id)) {
            conflictIds.add(app.id);
            conflicts.push(app);
          }
          if (!conflictIds.has(other.id)) {
            conflictIds.add(other.id);
            conflicts.push(other);
          }
        }
      }
    });

    // Sort by start time
    return conflicts.sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
  }, [appointments]);

  // Reset index when conflicts change
  useEffect(() => {
    if (currentIndex >= conflictAppointments.length) {
      setCurrentIndex(Math.max(0, conflictAppointments.length - 1));
    }
  }, [conflictAppointments.length, currentIndex]);

  const hasConflicts = conflictAppointments.length > 0;
  const currentConflict = conflictAppointments[currentIndex];

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : conflictAppointments.length - 1;
    setCurrentIndex(newIndex);
    if (conflictAppointments[newIndex]) {
      onNavigateToConflict(conflictAppointments[newIndex].id);
    }
  };

  const handleNext = () => {
    const newIndex = currentIndex < conflictAppointments.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    if (conflictAppointments[newIndex]) {
      onNavigateToConflict(conflictAppointments[newIndex].id);
    }
  };

  const handleClickConflict = () => {
    if (currentConflict) {
      onNavigateToConflict(currentConflict.id);
    }
  };

  return (
    <Card className={`p-2 ${hasConflicts ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/30'}`}>
      <div className="flex items-center gap-2 h-full">
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${hasConflicts ? 'text-destructive' : 'text-muted-foreground'}`} />
        
        <span className={`text-sm font-bold ${hasConflicts ? 'text-destructive' : 'text-muted-foreground'}`}>
          {conflictAppointments.length}
        </span>
        
        <span className="text-xs text-muted-foreground">
          {conflictAppointments.length === 1 ? 'Konflikt' : 'Konflikte'}
        </span>

        {hasConflicts && (
          <>
            <div className="flex-1 min-w-0">
              <button
                onClick={handleClickConflict}
                className="text-xs text-destructive/80 hover:text-destructive truncate cursor-pointer hover:underline"
              >
                {currentConflict?.customer?.name || currentConflict?.titel}
              </button>
            </div>
            
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {currentIndex + 1}/{conflictAppointments.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handlePrevious}
                disabled={conflictAppointments.length <= 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleNext}
                disabled={conflictAppointments.length <= 1}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
