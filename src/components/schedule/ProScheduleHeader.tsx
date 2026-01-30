import React from 'react';
import { format, getWeek, startOfWeek, endOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, Bell, Filter, Users, Plus } from 'lucide-react';
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
      
      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* View Toggle */}
        <ToggleGroup 
          type="single" 
          value={view} 
          onValueChange={(v) => v && onViewChange?.(v as 'day' | 'week' | 'month')}
          className="bg-muted rounded-lg p-0.5 hidden lg:flex"
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
        
        {/* Filter */}
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Filter</span>
        </Button>

        {/* Search & Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        </Button>
      </div>
    </div>
  );
}
