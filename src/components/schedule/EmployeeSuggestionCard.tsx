import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Clock, TrendingUp, AlertTriangle, ThumbsUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types/domain';

export interface Suggestion {
  employee: Employee;
  score: number;
  reasons: string[];
  currentAppointments: number;
}

interface EmployeeSuggestionCardProps {
  suggestion: Suggestion;
  onAssign: (employeeId: string) => void;
  className?: string;
}

export function EmployeeSuggestionCard({ suggestion, onAssign, className }: EmployeeSuggestionCardProps) {
  const { employee, score, reasons, currentAppointments } = suggestion;
  
  const workloadPercentage = (currentAppointments / (employee.max_termine_pro_tag || 8)) * 100;
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500 text-white';
    if (score >= 75) return 'bg-blue-500 text-white';
    if (score >= 60) return 'bg-yellow-500 text-white';
    return 'bg-gray-500 text-white';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <Star className="h-3 w-3" />;
    if (score >= 75) return <ThumbsUp className="h-3 w-3" />;
    return <TrendingUp className="h-3 w-3" />;
  };

  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md border-2', className)}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0" 
              style={{ backgroundColor: employee.farbe_kalender }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">{employee.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{employee.benutzer?.email || 'Keine E-Mail'}</p>
            </div>
          </div>
          <Badge 
            className={cn('text-xs flex items-center gap-1', getScoreColor(score))}
          >
            {getScoreIcon(score)}
            {score}%
          </Badge>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Auslastung</span>
            <span className={cn(
              'font-medium',
              workloadPercentage >= 100 ? 'text-red-600' :
              workloadPercentage >= 80 ? 'text-orange-600' :
              workloadPercentage >= 60 ? 'text-yellow-600' :
              'text-green-600'
            )}>
              {currentAppointments}/{employee.max_termine_pro_tag || 8}
            </span>
          </div>
          
          {reasons.length > 0 && (
            <div className="space-y-1">
              {reasons.slice(0, 2).map((reason, index) => (
                <div key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span className="flex-1">{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button 
          size="sm" 
          className="w-full h-7 text-xs"
          onClick={() => onAssign(employee.id)}
          disabled={workloadPercentage >= 100}
        >
          {workloadPercentage >= 100 ? 'Ausgelastet' : 'Zuweisen'}
        </Button>
      </CardContent>
    </Card>
  );
}