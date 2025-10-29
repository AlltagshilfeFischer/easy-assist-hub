import React from 'react';
import { format, getWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekNavigationBarProps {
  currentWeek: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  className?: string;
}

export function WeekNavigationBar({
  currentWeek,
  onPreviousWeek,
  onNextWeek,
  onToday,
  className
}: WeekNavigationBarProps) {
  const weekNumber = getWeek(currentWeek, { locale: de, weekStartsOn: 1 });
  const year = format(currentWeek, 'yyyy');

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={onPreviousWeek}
        className="h-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-md shadow-sm">
        <Calendar className="h-4 w-4 text-primary" />
        <div className="text-sm font-medium">
          <span className="text-primary">KW {weekNumber}</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span>{year}</span>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNextWeek}
        className="h-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        variant="default"
        size="sm"
        onClick={onToday}
        className="h-9 ml-2"
      >
        Heute
      </Button>
    </div>
  );
}
