import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types/domain';

interface SortableEmployeeCardProps {
  employee: Employee;
  isVisible: boolean;
  onToggle: () => void;
}

export function SortableEmployeeCard({ employee, isVisible, onToggle }: SortableEmployeeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: employee.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const workload = employee.workload || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border bg-card transition-all",
        isDragging && "opacity-50 shadow-lg",
        !isVisible && "opacity-50 bg-muted/20"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Employee Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
        style={{ backgroundColor: employee.farbe_kalender }}
      >
        {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>

      {/* Employee Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{employee.name}</div>
        {workload >= 90 && (
          <div className="flex items-center gap-2 mt-0.5">
            <AlertCircle className="h-3 w-3 text-destructive" />
          </div>
        )}
      </div>

      {/* Visibility Toggle */}
      <button
        onClick={onToggle}
        className="p-1 hover:bg-muted rounded transition-colors"
      >
        {isVisible ? (
          <Eye className="h-4 w-4 text-primary" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
