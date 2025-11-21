import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Circle,
  XCircle 
} from 'lucide-react';

export function CalendarLegend() {
  const statusItems = [
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Bestätigt',
      color: 'text-success',
      bg: 'bg-success/10'
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Konflikt',
      color: 'text-destructive',
      bg: 'bg-destructive/10'
    },
    {
      icon: <Circle className="h-4 w-4" />,
      label: 'Nicht zugewiesen',
      color: 'text-muted-foreground',
      bg: 'bg-muted'
    },
    {
      icon: <XCircle className="h-4 w-4" />,
      label: 'Abgesagt',
      color: 'text-muted-foreground',
      bg: 'bg-muted'
    }
  ];

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground mb-3">
          Legende
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2"
            >
              <div className={`${item.bg} ${item.color} p-1.5 rounded`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
