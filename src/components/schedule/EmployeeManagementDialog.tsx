import React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableEmployeeCard } from './SortableEmployeeCard';

interface Employee {
  id: string;
  name: string;
  farbe_kalender: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  workload?: number;
}

interface EmployeeManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  hiddenEmployeeIds: Set<string>;
  onToggleEmployee: (employeeId: string) => void;
  onReorderEmployees: (employees: Employee[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function EmployeeManagementDialog({
  open,
  onOpenChange,
  employees,
  hiddenEmployeeIds,
  onToggleEmployee,
  onReorderEmployees,
  searchQuery,
  onSearchChange,
}: EmployeeManagementDialogProps) {
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = employees.findIndex((emp) => emp.id === active.id);
      const newIndex = employees.findIndex((emp) => emp.id === over.id);

      const reorderedEmployees = arrayMove(employees, oldIndex, newIndex);
      onReorderEmployees(reorderedEmployees);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = !showOnlyActive || emp.ist_aktiv;
    return matchesSearch && matchesActive;
  });

  const visibleCount = employees.filter(e => !hiddenEmployeeIds.has(e.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mitarbeiter verwalten
            <Badge variant="secondary" className="ml-auto">
              {visibleCount} / {employees.length} sichtbar
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mitarbeiter suchen..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-active-dialog"
              checked={showOnlyActive}
              onCheckedChange={(checked) => setShowOnlyActive(checked as boolean)}
            />
            <label
              htmlFor="show-active-dialog"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Nur aktive anzeigen
            </label>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => employees.forEach(e => {
                if (!hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id);
              })}
              className="flex-1 h-8 text-xs"
            >
              <EyeOff className="h-3 w-3 mr-1.5" />
              Alle ausblenden
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => employees.forEach(e => {
                if (hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id);
              })}
              className="flex-1 h-8 text-xs"
            >
              <Eye className="h-3 w-3 mr-1.5" />
              Alle einblenden
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Ziehen Sie Mitarbeiter, um die Reihenfolge im Kalender zu ändern.
          </p>

          {/* Employee list with drag & drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="flex-1 -mx-2 px-2">
              <SortableContext
                items={filteredEmployees.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 pr-2">
                  {filteredEmployees.map((employee) => (
                    <SortableEmployeeCard
                      key={employee.id}
                      employee={employee}
                      isVisible={!hiddenEmployeeIds.has(employee.id)}
                      onToggle={() => onToggleEmployee(employee.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </ScrollArea>
          </DndContext>
        </div>
      </DialogContent>
    </Dialog>
  );
}
