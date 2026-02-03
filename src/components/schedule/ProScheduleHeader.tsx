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
  view?: 'day' | 'week' | 'month';
  onViewChange?: (view: 'day' | 'week' | 'month') => void;
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
  
  const dateRange = `${format(weekStart, 'd. MMM', { locale: de })} - ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left: Title */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Wochenplanung <span className="text-primary">KW {weekNumber}</span>
          </h1>
        </div>
      </div>
      
      {/* Center: Week Navigation */}
      <div className="flex items-center gap-1 bg-muted rounded-full px-1 py-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPreviousWeek}
          className="h-8 w-8 rounded-full"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <button 
          onClick={onToday}
          className="px-4 py-1.5 text-sm font-medium hover:bg-background/80 rounded-full transition-colors min-w-[180px]"
        >
          {dateRange}
        </button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextWeek}
          className="h-8 w-8 rounded-full"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Right: View Toggle */}
      <div className="flex items-center gap-2">
        <ToggleGroup 
          type="single" 
          value={view} 
          onValueChange={(v) => v && onViewChange?.(v as 'day' | 'week' | 'month')}
          className="bg-muted rounded-lg p-0.5"
        >
          <ToggleGroupItem 
            value="day" 
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              view === 'day' ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            Tag
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="week"
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              view === 'week' ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            Woche
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="month"
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
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
