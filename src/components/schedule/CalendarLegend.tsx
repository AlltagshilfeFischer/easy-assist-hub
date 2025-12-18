import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Circle,
  XCircle 
} from 'lucide-react';

export function CalendarLegend() {
  const statusItems = [
    {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Bestätigt',
      color: 'text-success',
      bg: 'bg-success/10'
    },
    {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Konflikt',
      color: 'text-destructive',
      bg: 'bg-destructive/10'
    },
    {
      icon: <Circle className="h-3 w-3" />,
      label: 'Offen',
      color: 'text-muted-foreground',
      bg: 'bg-muted'
    },
    {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Abgesagt',
      color: 'text-muted-foreground',
      bg: 'bg-muted'
    }
  ];

  return (
    <div className="flex items-center gap-3 text-xs">
      {statusItems.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-1"
        >
          <div className={`${item.bg} ${item.color} p-1 rounded`}>
            {item.icon}
          </div>
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
