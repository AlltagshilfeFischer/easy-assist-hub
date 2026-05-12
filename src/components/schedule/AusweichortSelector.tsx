import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, MapPin, Trash2 } from 'lucide-react';
import { useAusweichorte, useCreateAusweichort, useDeleteAusweichort } from '@/hooks/useAusweichorte';
import { useUserRole } from '@/hooks/useUserRole';
import type { Ausweichort } from '@/types/domain';

interface AusweichortSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** z-index für Select-Dropdown (Standard 202) */
  zIndex?: number;
}

export function AusweichortSelector({ value, onChange, zIndex = 202 }: AusweichortSelectorProps) {
  const { data: orte = [], isLoading } = useAusweichorte();
  const createMutation = useCreateAusweichort();
  const deleteMutation = useDeleteAusweichort();
  const { isGeschaeftsfuehrer, isGlobalAdmin } = useUserRole();
  const canManage = isGeschaeftsfuehrer || isGlobalAdmin;

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStrasse, setNewStrasse] = useState('');
  const [newPlz, setNewPlz] = useState('');
  const [newStadt, setNewStadt] = useState('');
  const [newNotizen, setNewNotizen] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const result = await createMutation.mutateAsync({
      name: newName.trim(),
      strasse: newStrasse.trim() || null,
      plz: newPlz.trim() || null,
      stadt: newStadt.trim() || null,
      notizen: newNotizen.trim() || null,
    });
    onChange(result.id);
    setShowCreate(false);
    resetForm();
  };

  const resetForm = () => {
    setNewName('');
    setNewStrasse('');
    setNewPlz('');
    setNewStadt('');
    setNewNotizen('');
  };

  const selectedOrt = orte.find((o) => o.id === value);

  const formatAdresse = (ort: Ausweichort) =>
    [ort.strasse, [ort.plz, ort.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <>
      <div className="flex gap-2">
        <Select
          value={value ?? '__none__'}
          onValueChange={(v) => onChange(v === '__none__' ? null : v)}
          disabled={isLoading}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Kundenwohnung (Standard)" />
          </SelectTrigger>
          <SelectContent className={`z-[${zIndex}]`}>
            <SelectItem value="__none__">Kundenwohnung (Standard)</SelectItem>
            {orte.map((ort) => (
              <SelectItem key={ort.id} value={ort.id}>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{ort.name}</span>
                  {formatAdresse(ort) && (
                    <span className="text-muted-foreground text-xs">· {formatAdresse(ort)}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShowCreate(true)}
            title="Neuen Ausweichort anlegen"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Ausgewählter Ort — Adress-Vorschau */}
      {selectedOrt && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1 ml-0.5">
          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-foreground">{selectedOrt.name}</span>
            {formatAdresse(selectedOrt) && (
              <span className="block">{formatAdresse(selectedOrt)}</span>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  deleteMutation.mutate(selectedOrt.id);
                  onChange(null);
                }}
                className="text-destructive hover:underline flex items-center gap-0.5 mt-0.5"
              >
                <Trash2 className="h-2.5 w-2.5" />Löschen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Neuen Ort anlegen */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm z-[300]" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Ausweichort speichern</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Büro Hauptstraße"
                required
                autoFocus
              />
            </div>
            <div>
              <Label>Straße & Hausnummer</Label>
              <Input
                value={newStrasse}
                onChange={(e) => setNewStrasse(e.target.value)}
                placeholder="Musterstraße 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>PLZ</Label>
                <Input
                  value={newPlz}
                  onChange={(e) => setNewPlz(e.target.value)}
                  placeholder="30159"
                />
              </div>
              <div>
                <Label>Stadt</Label>
                <Input
                  value={newStadt}
                  onChange={(e) => setNewStadt(e.target.value)}
                  placeholder="Hannover"
                />
              </div>
            </div>
            <div>
              <Label>Notizen (optional)</Label>
              <Textarea
                value={newNotizen}
                onChange={(e) => setNewNotizen(e.target.value)}
                placeholder="Zugangsinformationen, Parkplatz..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
                {createMutation.isPending ? 'Speichert...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
