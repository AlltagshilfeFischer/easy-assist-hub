import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface DropZoneProps {
  id: string;
  children?: React.ReactNode;
  className?: string;
  isOver?: boolean;
  isEmpty?: boolean;
  employeeName?: string;
  date?: string;
}

export function DropZone({ 
  id, 
  children, 
  className, 
  isEmpty = false, 
  employeeName, 
  date 
}: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[80px] p-2 rounded-md border border-dashed transition-all duration-200',
        isOver 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-muted-foreground/60 hover:bg-muted/20',
        isEmpty && 'flex items-center justify-center',
        className
      )}
    >
      {isEmpty && !children ? (
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <Plus className="h-4 w-4" />
          <span className="text-xs text-center">
            Termin hierher ziehen
          </span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}