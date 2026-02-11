import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Circle,
  XCircle,
  UserX,
  PhoneOff
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
    },
    {
      icon: <UserX className="h-3 w-3" />,
      label: 'Nicht angetroffen',
      color: 'text-amber-700',
      bg: 'bg-amber-100'
    },
    {
      icon: <PhoneOff className="h-3 w-3" />,
      label: 'Rechtzeitig abgesagt',
      color: 'text-slate-500',
      bg: 'bg-slate-100'
    }
  ];

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
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
