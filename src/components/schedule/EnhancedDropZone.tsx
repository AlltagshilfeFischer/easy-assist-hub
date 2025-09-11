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
}

export function EnhancedDropZone({ 
  id, 
  children, 
  className, 
  isEmpty = false, 
  employeeName, 
  date,
  workloadInfo
}: EnhancedDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const getDropZoneStyle = () => {
    if (isOver) {
      if (workloadInfo?.isOverbooked) {
        return 'border-red-400 bg-red-50/80 shadow-lg shadow-red-200/50';
      }
      return 'border-primary bg-primary/10 shadow-lg shadow-primary/20';
    }
    
    if (workloadInfo?.isOverbooked) {
      return 'border-red-200 bg-red-50/30 hover:border-red-300';
    }
    
    if (workloadInfo?.isNearCapacity) {
      return 'border-orange-200 bg-orange-50/30 hover:border-orange-300';
    }
    
    return 'border-border hover:border-muted-foreground/60 hover:bg-muted/20';
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[100px] p-3 rounded-lg border-2 border-dashed transition-all duration-300',
        getDropZoneStyle(),
        isEmpty && 'flex flex-col items-center justify-center',
        className
      )}
    >
      {/* Workload indicator at top */}
      {workloadInfo && !isEmpty && (
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-1">
            {workloadInfo.isOverbooked ? (
              <AlertTriangle className="h-3 w-3 text-red-600" />
            ) : (
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(
              'text-xs font-medium',
              workloadInfo.isOverbooked ? 'text-red-600' : 
              workloadInfo.isNearCapacity ? 'text-orange-600' : 'text-muted-foreground'
            )}>
              {workloadInfo.count}/{workloadInfo.max}
            </span>
          </div>
          
          {workloadInfo.isOverbooked && (
            <Badge variant="destructive" className="text-xs">
              Überlastet
            </Badge>
          )}
          
          {workloadInfo.isNearCapacity && !workloadInfo.isOverbooked && (
            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
              Fast voll
            </Badge>
          )}
        </div>
      )}

      {isEmpty && !children ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className={cn(
            'p-2 rounded-full transition-colors',
            isOver && !workloadInfo?.isOverbooked && 'bg-primary text-primary-foreground',
            isOver && workloadInfo?.isOverbooked && 'bg-red-500 text-white',
            !isOver && 'bg-muted'
          )}>
            <Plus className="h-4 w-4" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium">
              {isOver && workloadInfo?.isOverbooked ? 'Warnung: Überlastung!' : 'Termin hierher ziehen'}
            </p>
            {employeeName && date && (
              <p className="text-xs text-muted-foreground mt-1">
                {employeeName} • {date}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {children}
        </div>
      )}
      
      {/* Drop feedback overlay */}
      {isOver && (
        <div className={cn(
          'absolute inset-0 rounded-lg border-2 pointer-events-none',
          workloadInfo?.isOverbooked ? 'border-red-400 bg-red-100/20' : 'border-primary bg-primary/5'
        )} />
      )}
    </div>
  );
}