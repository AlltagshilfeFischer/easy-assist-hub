import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TimeInput } from '@/components/ui/time-input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { WOCHENTAGE, useVerfuegbarkeiten, useSaveVerfuegbarkeiten } from '@/hooks/useVerfuegbarkeiten';
import { toast } from 'sonner';

interface VerfuegbarkeitEditorProps {
  mitarbeiterId: string;
  disabled?: boolean;
}

interface SlotDraft {
  wochentag: number;
  von: string;
  bis: string;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm ?? 0);
}

export function VerfuegbarkeitEditor({ mitarbeiterId, disabled }: VerfuegbarkeitEditorProps) {
  const { data: existing = [], isLoading } = useVerfuegbarkeiten(mitarbeiterId);
  const saveMutation = useSaveVerfuegbarkeiten();
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync only on initial load or employee change — NOT on background refetches.
  // `existing` is intentionally excluded from deps to prevent overwriting unsaved changes
  // when React Query refetches in the background (e.g. window focus).
  useEffect(() => {
    if (!isLoading) {
      setSlots(existing.map((v) => ({ wochentag: v.wochentag, von: v.von, bis: v.bis })));
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mitarbeiterId, isLoading]);

  const addSlot = (wochentag: number) => {
    const daySlots = slots.filter((s) => s.wochentag === wochentag);
    const lastSlot = daySlots.at(-1);
    // Suggest non-overlapping time after the last existing slot for this day
    const von = lastSlot ? lastSlot.bis : '08:00';
    const bis = lastSlot ? (lastSlot.bis <= '18:00' ? '22:00' : '23:00') : '17:00';
    setSlots([...slots, { wochentag, von, bis }]);
    setDirty(true);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateSlot = (index: number, field: 'von' | 'bis', value: string) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    setSlots(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    for (const s of slots) {
      if (s.von >= s.bis) {
        toast.error(`Ungültige Zeit am ${WOCHENTAGE[s.wochentag]}: Von-Zeit muss vor Bis-Zeit liegen`);
        return;
      }
    }

    // Check for overlapping windows on the same day
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (slots[i].wochentag === slots[j].wochentag) {
          const aStart = timeToMinutes(slots[i].von);
          const aEnd = timeToMinutes(slots[i].bis);
          const bStart = timeToMinutes(slots[j].von);
          const bEnd = timeToMinutes(slots[j].bis);
          if (aStart < bEnd && bStart < aEnd) {
            toast.error(`Überlappende Zeitfenster am ${WOCHENTAGE[slots[i].wochentag]}`);
            return;
          }
        }
      }
    }

    try {
      await saveMutation.mutateAsync({ mitarbeiterId, slots });
      setDirty(false);
      toast.success('Verfügbarkeiten gespeichert');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Fehler beim Speichern';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Laden...</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Wochentags-Verfügbarkeit</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mehrere Zeitfenster pro Tag möglich — z. B. früh und spät.
        </p>
      </div>
      <div className="space-y-2">
        {WOCHENTAGE.map((tag, dayIndex) => {
          const daySlots = slots
            .map((s, i) => ({ ...s, originalIndex: i }))
            .filter((s) => s.wochentag === dayIndex);

          return (
            <div key={dayIndex} className="flex items-start gap-3">
              <span className="text-sm font-medium w-24 pt-1.5 shrink-0">{tag.slice(0, 2)}</span>
              <div className="flex-1 space-y-1">
                {daySlots.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Nicht verfügbar</span>
                ) : (
                  daySlots.map((slot) => (
                    <div key={slot.originalIndex} className="flex items-center gap-2">
                      <TimeInput
                        value={slot.von}
                        onChange={(v) => updateSlot(slot.originalIndex, 'von', v)}
                        className="w-28 h-8 text-sm"
                        disabled={disabled}
                      />
                      <span className="text-xs text-muted-foreground">bis</span>
                      <TimeInput
                        value={slot.bis}
                        onChange={(v) => updateSlot(slot.originalIndex, 'bis', v)}
                        className="w-28 h-8 text-sm"
                        disabled={disabled}
                      />
                      {!disabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSlot(slot.originalIndex)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  title="Weiteres Zeitfenster hinzufügen"
                  onClick={() => addSlot(dayIndex)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!disabled && dirty && (
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          Verfügbarkeiten speichern
        </Button>
      )}
    </div>
  );
}
