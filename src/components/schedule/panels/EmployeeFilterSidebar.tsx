import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Eye, EyeOff, AlertCircle, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { SortableEmployeeCard } from '../SortableEmployeeCard';
import type { Employee } from '@/types/domain';

interface EmployeeFilterSidebarProps {
  employees: Employee[];
  hiddenEmployeeIds: Set<string>;
  onToggleEmployee: (employeeId: string) => void;
  onReorderEmployees: (employees: Employee[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

export function EmployeeFilterSidebar({
  employees,
  hiddenEmployeeIds,
  onToggleEmployee,
  onReorderEmployees,
  searchQuery,
  onSearchChange,
  className
}: EmployeeFilterSidebarProps) {
  const [showOnlyActive, setShowOnlyActive] = useState(true);

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
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mitarbeiter
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {visibleCount} / {employees.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0">
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
            id="show-active"
            checked={showOnlyActive}
            onCheckedChange={(checked) => setShowOnlyActive(checked as boolean)}
          />
          <label
            htmlFor="show-active"
            className="text-sm font-medium leading-none cursor-pointer"
          >
            Nur aktive anzeigen
          </label>
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => employees.forEach(e => {
              if (!hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id);
            })}
            className="w-full h-8 text-xs"
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
            className="w-full h-8 text-xs"
          >
            <Eye className="h-3 w-3 mr-1.5" />
            Alle anzeigen
          </Button>
        </div>

        {/* Employee list with drag & drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="flex-1 -mx-4 px-4">
            <SortableContext
              items={filteredEmployees.map(e => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 pr-4">
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
      </CardContent>
    </Card>
  );
}
