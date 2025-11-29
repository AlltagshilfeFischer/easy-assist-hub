import { useState } from 'react';
import { format, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Clock, User, Edit2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
}

interface AppointmentSuggestion {
  kunde_id: string;
  mitarbeiter_id: string | null;
  datum: string;
  startzeit: string;
  dauer_minuten: number;
  notizen?: string;
  checked?: boolean;
  editing?: boolean;
}

interface AIAppointmentSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AppointmentSuggestion[];
  customers: Customer[];
  employees: Employee[];
  onConfirm: (selectedSuggestions: AppointmentSuggestion[]) => void;
}

export function AIAppointmentSuggestionsDialog({
  open,
  onOpenChange,
  suggestions: initialSuggestions,
  customers,
  employees,
  onConfirm,
}: AIAppointmentSuggestionsDialogProps) {
  const [suggestions, setSuggestions] = useState<AppointmentSuggestion[]>(
    initialSuggestions.map(s => ({ ...s, checked: true, editing: false }))
  );

  const toggleCheck = (index: number) => {
    setSuggestions(prev =>
      prev.map((s, i) => (i === index ? { ...s, checked: !s.checked } : s))
    );
  };

  const toggleEdit = (index: number) => {
    setSuggestions(prev =>
      prev.map((s, i) => (i === index ? { ...s, editing: !s.editing } : s))
    );
  };

  const updateSuggestion = (index: number, field: string, value: any) => {
    setSuggestions(prev =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const getCustomerName = (id: string) => {
    return customers.find(c => c.id === id)?.name || 'Unbekannt';
  };

  const getEmployeeName = (id: string | null) => {
    if (!id) return 'Nicht zugewiesen';
    return employees.find(e => e.id === id)?.name || 'Unbekannt';
  };

  const handleConfirm = () => {
    const selected = suggestions.filter(s => s.checked);
    onConfirm(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Terminvorschläge</DialogTitle>
          <DialogDescription>
            Überprüfe die vorgeschlagenen Termine und wähle aus, welche erstellt werden sollen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={cn(
                "border rounded-lg p-4 transition-all",
                suggestion.checked ? "bg-background" : "bg-muted/50 opacity-60"
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={suggestion.checked}
                  onCheckedChange={() => toggleCheck(index)}
                  className="mt-1"
                />
                
                {suggestion.editing ? (
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Kunde</Label>
                        <Select
                          value={suggestion.kunde_id}
                          onValueChange={(value) => updateSuggestion(index, 'kunde_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Mitarbeiter</Label>
                        <Select
                          value={suggestion.mitarbeiter_id || 'none'}
                          onValueChange={(value) => 
                            updateSuggestion(index, 'mitarbeiter_id', value === 'none' ? null : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nicht zugewiesen</SelectItem>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Datum</Label>
                        <Input
                          type="date"
                          value={suggestion.datum}
                          onChange={(e) => updateSuggestion(index, 'datum', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label>Startzeit</Label>
                        <Input
                          type="time"
                          value={suggestion.startzeit}
                          onChange={(e) => updateSuggestion(index, 'startzeit', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label>Dauer (Min.)</Label>
                        <Input
                          type="number"
                          value={suggestion.dauer_minuten}
                          onChange={(e) => updateSuggestion(index, 'dauer_minuten', parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Notizen</Label>
                      <Textarea
                        value={suggestion.notizen || ''}
                        onChange={(e) => updateSuggestion(index, 'notizen', e.target.value)}
                        rows={2}
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleEdit(index)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Fertig
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-base">
                        {getCustomerName(suggestion.kunde_id)}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleEdit(index)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{getEmployeeName(suggestion.mitarbeiter_id)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          {format(parse(suggestion.datum, 'yyyy-MM-dd', new Date()), 'EEEE, dd. MMMM yyyy', { locale: de })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{suggestion.startzeit} Uhr ({suggestion.dauer_minuten} Minuten)</span>
                      </div>

                      {suggestion.notizen && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <strong>Notizen:</strong> {suggestion.notizen}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {suggestions.filter(s => s.checked).length} von {suggestions.length} Terminen ausgewählt
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!suggestions.some(s => s.checked)}
            >
              Termine erstellen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
