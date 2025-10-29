import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Eye, EyeOff, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  farbe_kalender: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  workload?: number;
}

interface EmployeeFilterSidebarProps {
  employees: Employee[];
  hiddenEmployeeIds: Set<string>;
  onToggleEmployee: (employeeId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

export function EmployeeFilterSidebar({
  employees,
  hiddenEmployeeIds,
  onToggleEmployee,
  searchQuery,
  onSearchChange,
  className
}: EmployeeFilterSidebarProps) {
  const [showOnlyActive, setShowOnlyActive] = useState(true);

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
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => employees.forEach(e => {
              if (!hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id);
            })}
            className="flex-1 h-8 text-xs whitespace-nowrap"
          >
            <EyeOff className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">Alle ausblenden</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => employees.forEach(e => {
              if (hiddenEmployeeIds.has(e.id)) onToggleEmployee(e.id);
            })}
            className="flex-1 h-8 text-xs whitespace-nowrap"
          >
            <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">Alle anzeigen</span>
          </Button>
        </div>

        {/* Employee list */}
        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-2 pr-4">
            {filteredEmployees.map((employee) => {
              const isVisible = !hiddenEmployeeIds.has(employee.id);
              const workload = employee.workload || 0;

              return (
                <div
                  key={employee.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50",
                    isVisible ? "bg-card" : "bg-muted/20 opacity-50"
                  )}
                  onClick={() => onToggleEmployee(employee.id)}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: employee.farbe_kalender }}
                  >
                    {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{employee.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Max: {employee.max_termine_pro_tag}/Tag
                      </span>
                      {workload >= 90 && (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                  </div>

                  {isVisible ? (
                    <Eye className="h-4 w-4 text-primary" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
