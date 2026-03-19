import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Clock, Users, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { CalendarAppointment } from '@/types/domain';

interface ConflictsNavigationCardProps {
  appointments: CalendarAppointment[];
  onNavigateToConflict: (appointmentId: string) => void;
}

interface ConflictPair {
  a: CalendarAppointment;
  b: CalendarAppointment;
  employeeName: string;
}

function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm');
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'EEE dd.MM.', { locale: de });
}

export function ConflictsNavigationCard({
  appointments,
  onNavigateToConflict,
}: ConflictsNavigationCardProps) {
  const [open, setOpen] = useState(false);

  const conflictPairs = useMemo(() => {
    const pairs: ConflictPair[] = [];
    const seen = new Set<string>();

    const sortedApps = [...appointments].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    sortedApps.forEach((app, index) => {
      if (!app.mitarbeiter_id) return;

      for (let i = index + 1; i < sortedApps.length; i++) {
        const other = sortedApps[i];
        if (other.mitarbeiter_id !== app.mitarbeiter_id) continue;

        const appStart = new Date(app.start_at);
        const appEnd = new Date(app.end_at);
        const otherStart = new Date(other.start_at);
        const otherEnd = new Date(other.end_at);

        if (appStart < otherEnd && appEnd > otherStart) {
          const pairKey = [app.id, other.id].sort().join(':');
          if (!seen.has(pairKey)) {
            seen.add(pairKey);
            pairs.push({
              a: app,
              b: other,
              employeeName: app.employee?.name ?? 'Unbekannt',
            });
          }
        }
      }
    });

    return pairs;
  }, [appointments]);

  if (conflictPairs.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 gap-1.5"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-bold">{conflictPairs.length}</span>
          <span className="hidden sm:inline">
            {conflictPairs.length === 1 ? 'Konflikt' : 'Konflikte'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 max-h-[70vh] flex flex-col" align="end" sideOffset={8}>
        <div className="px-3 py-2 border-b bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">
              {conflictPairs.length} {conflictPairs.length === 1 ? 'Überschneidung' : 'Überschneidungen'}
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-2 space-y-1.5">
            {conflictPairs.map((pair, idx) => (
              <div
                key={idx}
                className="rounded-md border border-destructive/20 bg-destructive/5 p-2 space-y-1"
              >
                {/* MA + Datum */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span className="font-medium">{pair.employeeName}</span>
                  <span className="ml-auto">{formatDate(pair.a.start_at)}</span>
                </div>
                {/* Paar: Termin A ↔ Termin B */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { onNavigateToConflict(pair.a.id); setOpen(false); }}
                    className="flex-1 rounded px-1.5 py-1 text-xs hover:bg-background/80 transition-colors text-left truncate"
                  >
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-destructive/60 flex-shrink-0" />
                      <span className="font-medium text-destructive/80">{formatTime(pair.a.start_at)}–{formatTime(pair.a.end_at)}</span>
                    </div>
                    <div className="truncate text-foreground/70 mt-0.5">{pair.a.customer?.name ?? pair.a.titel}</div>
                  </button>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-destructive/40 flex-shrink-0" />
                  <button
                    onClick={() => { onNavigateToConflict(pair.b.id); setOpen(false); }}
                    className="flex-1 rounded px-1.5 py-1 text-xs hover:bg-background/80 transition-colors text-left truncate"
                  >
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-destructive/60 flex-shrink-0" />
                      <span className="font-medium text-destructive/80">{formatTime(pair.b.start_at)}–{formatTime(pair.b.end_at)}</span>
                    </div>
                    <div className="truncate text-foreground/70 mt-0.5">{pair.b.customer?.name ?? pair.b.titel}</div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
