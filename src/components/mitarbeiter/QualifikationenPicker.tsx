import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Plus, ChevronDown } from 'lucide-react';
import { useQualifikationen, useCreateQualifikation, type Qualifikation } from '@/hooks/useQualifikationen';

interface QualifikationenPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function QualifikationenPicker({ selectedIds, onChange, disabled }: QualifikationenPickerProps) {
  const { data: qualifikationen = [], isLoading } = useQualifikationen();
  const createQualifikation = useCreateQualifikation();
  const [newTag, setNewTag] = useState('');
  const [open, setOpen] = useState(false);

  const selectedItems = qualifikationen.filter((q) => selectedIds.includes(q.id));
  const availableItems = qualifikationen.filter((q) => !selectedIds.includes(q.id));

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((s) => s !== id));
  };

  const handleCreateTag = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    try {
      const created = await createQualifikation.mutateAsync({ name: trimmed });
      onChange([...selectedIds, created.id]);
      setNewTag('');
    } catch {
      // Duplicate or error — try to find existing
      const existing = qualifikationen.find((q) => q.name.toLowerCase() === trimmed.toLowerCase());
      if (existing && !selectedIds.includes(existing.id)) {
        onChange([...selectedIds, existing.id]);
      }
      setNewTag('');
    }
  };

  // Group available items by kategorie
  const grouped = availableItems.reduce<Record<string, Qualifikation[]>>((acc, q) => {
    const key = q.kategorie || 'Allgemein';
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <Label>Qualifikationen</Label>

      {/* Selected tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {selectedItems.map((q) => (
          <Badge key={q.id} variant="secondary" className="gap-1 pr-1">
            {q.name}
            {!disabled && (
              <button type="button" onClick={() => handleRemove(q.id)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {selectedItems.length === 0 && (
          <span className="text-sm text-muted-foreground">Keine Qualifikationen zugewiesen</span>
        )}
      </div>

      {/* Add dropdown */}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1" type="button">
              <Plus className="h-3.5 w-3.5" />
              Hinzufuegen
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Laden...</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {Object.entries(grouped).map(([kategorie, items]) => (
                  <div key={kategorie}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{kategorie}</p>
                    <div className="flex flex-wrap gap-1">
                      {items.map((q) => (
                        <Badge
                          key={q.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => { handleToggle(q.id); }}
                        >
                          {q.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {availableItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">Alle zugewiesen</p>
                )}

                {/* Create new tag */}
                <div className="border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Neue Qualifikation</p>
                  <div className="flex gap-1">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="z.B. Wundversorgung"
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateTag();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2"
                      type="button"
                      onClick={handleCreateTag}
                      disabled={!newTag.trim() || createQualifikation.isPending}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
