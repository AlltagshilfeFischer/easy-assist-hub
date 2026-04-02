import React from 'react';
import { cn } from '@/lib/utils';

interface LegendItem {
  color: string;
  label: string;
  type: 'dot' | 'border';
}

export function ProCalendarLegend() {
  const items: LegendItem[] = [
    { color: 'bg-orange-400',  label: 'Offen',                  type: 'dot' },
    { color: 'bg-blue-400',    label: 'Geplant',                 type: 'dot' },
    { color: 'bg-yellow-400',  label: 'In Bearbeitung',          type: 'dot' },
    { color: 'bg-green-500',   label: 'Durchgeführt',            type: 'dot' },
    { color: 'bg-red-500',     label: 'Abgesagt (kurzfr.)',      type: 'dot' },
    { color: 'bg-amber-500',   label: 'Nicht angetroffen',       type: 'dot' },
    { color: 'bg-slate-400',   label: 'Rechtzeitig abgesagt',    type: 'dot' },
    { color: 'bg-emerald-500', label: 'Abgerechnet',             type: 'dot' },
    { color: 'bg-destructive', label: 'Konflikt',                type: 'dot' },
  ];

  return (
    <div className="py-2 px-4 bg-muted/30 border-t border-border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", item.color)} />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
