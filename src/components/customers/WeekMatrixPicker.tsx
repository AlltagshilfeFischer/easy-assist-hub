import { Fragment } from 'react';
import { cn } from '@/lib/utils';

const DAYS = [
  { num: 1, label: 'Mo' },
  { num: 2, label: 'Di' },
  { num: 3, label: 'Mi' },
  { num: 4, label: 'Do' },
  { num: 5, label: 'Fr' },
  { num: 6, label: 'Sa' },
  { num: 0, label: 'So' },
];

const SHIFTS = [
  { key: 'frueh',       label: 'Früh',       time: '07–08:30' },
  { key: 'vormittag',   label: 'Vormittag',  time: '09–10:30' },
  { key: 'mittag',      label: 'Mittag',     time: '11–12:30' },
  { key: 'nachmittag',  label: 'Nachmittag', time: '14–15:30' },
  { key: 'abend',       label: 'Abend',      time: '16–17:30' },
];

interface WeekMatrixPickerProps {
  matrix: Record<number, Record<string, boolean>>;
  onToggle: (day: number, shiftKey: string) => void;
}

export function WeekMatrixPicker({ matrix, onToggle }: WeekMatrixPickerProps) {
  return (
    <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,1fr] gap-1">
      {/* Header */}
      <div />
      {SHIFTS.map((shift) => (
        <div key={shift.key} className="text-center text-xs font-medium text-muted-foreground py-1">
          <div>{shift.label}</div>
          <div className="text-[10px]">{shift.time}</div>
        </div>
      ))}

      {/* Rows */}
      {DAYS.map((day) => (
        <Fragment key={day.num}>
          <div className="flex items-center text-sm font-medium pr-2 py-1">
            {day.label}
          </div>
          {SHIFTS.map((shift) => {
            const isActive = matrix[day.num]?.[shift.key] ?? false;
            return (
              <button
                key={`${day.num}-${shift.key}`}
                type="button"
                onClick={() => onToggle(day.num, shift.key)}
                className={cn(
                  'h-9 rounded-md border text-xs font-medium transition-colors duration-150 cursor-pointer',
                  isActive
                    ? 'bg-primary/90 text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/60'
                )}
              >
                {isActive ? '✓' : ''}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
