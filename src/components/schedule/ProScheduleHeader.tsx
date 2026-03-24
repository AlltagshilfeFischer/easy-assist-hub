import React from 'react';
import { format, getWeek, startOfWeek, endOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ProScheduleHeaderProps {
  currentWeek: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onEmployeeManagement: () => void;
  onNewAppointment?: () => void;
  view?: 'week' | 'month';
  onViewChange?: (view: 'week' | 'month') => void;
}

export function ProScheduleHeader({
  currentWeek,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onEmployeeManagement,
  onNewAppointment,
  view = 'week',
  onViewChange
}: ProScheduleHeaderProps) {
  const weekNumber = getWeek(currentWeek, { locale: de, weekStartsOn: 1 });
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const titleText = view === 'month' ? 'Monatsplanung' : 'Wochenplanung';

  const titleHighlight = view === 'month'
    ? format(currentWeek, 'MMMM yyyy', { locale: de })
    : `KW ${weekNumber}`;

  const dateRange = view === 'month'
    ? format(currentWeek, 'MMMM yyyy', { locale: de })
    : `${format(weekStart, 'd. MMM', { locale: de })} - ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`;

  const dateRangeShort = view === 'month'
    ? format(currentWeek, 'MMM yy', { locale: de })
    : `${format(weekStart, 'dd.MM.')} - ${format(weekEnd, 'dd.MM.')}`;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
      {/* Left: Title */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">
            <span className="hidden sm:inline">{titleText} </span>
            <span className="text-primary">{titleHighlight}</span>
          </h1>
        </div>
      </div>

      {/* Right section: Navigation + View Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="h-7 sm:h-8 text-xs font-medium"
        >
          Heute
        </Button>
        <div className="flex items-center gap-0.5 sm:gap-1 bg-muted rounded-full px-1 py-0.5 sm:py-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreviousWeek}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-2 sm:px-4 py-1 text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[180px] text-center select-none">
            <span className="hidden sm:inline">{dateRange}</span>
            <span className="sm:hidden">{dateRangeShort}</span>
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNextWeek}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Toggle */}
        <ToggleGroup 
          type="single" 
          value={view} 
          onValueChange={(v) => v && onViewChange?.(v as 'week' | 'month')}
          className="bg-muted rounded-lg p-0.5"
        >
          <ToggleGroupItem 
            value="week"
            className={cn(
              "px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-all",
              view === 'week' ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            Woche
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="month"
            className={cn(
              "px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-all",
              view === 'month' ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            Monat
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
