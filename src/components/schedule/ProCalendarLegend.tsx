import React from 'react';
import { cn } from '@/lib/utils';

interface LegendItem {
  color: string;
  label: string;
  type: 'dot' | 'border';
}

export function ProCalendarLegend() {
  const items: LegendItem[] = [
    { color: 'bg-success', label: 'Erfolgt', type: 'dot' },
    { color: 'bg-destructive', label: 'Dringend / Fehler', type: 'dot' },
    { color: 'bg-amber-500', label: 'Nicht rechtzeitig abgesagt', type: 'dot' },
    { color: 'bg-slate-400', label: 'Rechtzeitig abgesagt', type: 'dot' },
  ];

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-muted/30 border-t border-border">
      <div className="flex items-center gap-6">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", item.color)} />
            <span className="text-xs text-muted-foreground font-medium">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-muted-foreground">
        ZEITBEREICH: 06:00 — 22:00
      </div>
    </div>
  );
}
