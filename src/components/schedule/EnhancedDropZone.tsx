import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EnhancedDropZoneProps {
  id: string;
  children?: React.ReactNode;
  className?: string;
  isEmpty?: boolean;
  employeeName?: string;
  date?: string;
  workloadInfo?: {
    count: number;
    max: number;
    percentage: number;
    isOverbooked: boolean;
    isNearCapacity: boolean;
  };
  onClick?: () => void;
}

export function EnhancedDropZone({ 
  id, 
  children, 
  className, 
  isEmpty = false, 
  employeeName, 
  date,
  workloadInfo,
  onClick
}: EnhancedDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'relative transition-all duration-200 overflow-hidden',
        isOver && 'bg-primary/10 border-primary ring-2 ring-primary shadow-lg',
        workloadInfo?.isOverbooked && 'bg-destructive/5 border-destructive/20',
        className
      )}
    >
      {isOver && (
        <div className="absolute inset-0 bg-primary/5 border-2 border-primary border-dashed rounded-lg animate-pulse z-10 flex items-center justify-center">
          <div className="text-primary font-semibold text-xs px-2 py-1 bg-background/90 rounded">
            Zuweisen zu {employeeName}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}