import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { WOCHENTAGE, useVerfuegbarkeiten, useSaveVerfuegbarkeiten, type Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';
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

export function VerfuegbarkeitEditor({ mitarbeiterId, disabled }: VerfuegbarkeitEditorProps) {
  const { data: existing = [], isLoading } = useVerfuegbarkeiten(mitarbeiterId);
  const saveMutation = useSaveVerfuegbarkeiten();
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync from DB
  useEffect(() => {
    if (existing.length > 0 || !isLoading) {
      setSlots(existing.map((v) => ({ wochentag: v.wochentag, von: v.von, bis: v.bis })));
      setDirty(false);
    }
  }, [existing, isLoading]);

  const addSlot = (wochentag: number) => {
    setSlots([...slots, { wochentag, von: '08:00', bis: '17:00' }]);
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
    try {
      await saveMutation.mutateAsync({ mitarbeiterId, slots });
      setDirty(false);
      toast.success('Verfuegbarkeiten gespeichert');
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
      <Label>Wochentags-Verfuegbarkeit</Label>
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
                  <span className="text-xs text-muted-foreground italic">Nicht verfuegbar</span>
                ) : (
                  daySlots.map((slot) => (
                    <div key={slot.originalIndex} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.von}
                        onChange={(e) => updateSlot(slot.originalIndex, 'von', e.target.value)}
                        className="w-28 h-8 text-sm"
                        disabled={disabled}
                      />
                      <span className="text-xs text-muted-foreground">bis</span>
                      <Input
                        type="time"
                        value={slot.bis}
                        onChange={(e) => updateSlot(slot.originalIndex, 'bis', e.target.value)}
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
          Verfuegbarkeiten speichern
        </Button>
      )}
    </div>
  );
}
