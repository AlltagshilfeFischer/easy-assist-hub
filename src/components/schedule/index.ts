// Barrel re-exports — keeps existing import paths working
// e.g. import { X } from '@/components/schedule/X' still resolves

// AI
export { AIAppointmentCreator } from './ai/AIAppointmentCreator';
export { AIAppointmentSuggestionsDialog } from './ai/AIAppointmentSuggestionsDialog';
export { default as AIEmployeeSuggestions } from './ai/AIEmployeeSuggestions';
export { default as AITimeWindowsCreator } from './ai/AITimeWindowsCreator';

// Dialogs
export { AppointmentDetailDialog } from './dialogs/AppointmentDetailDialog';
export { AppointmentApprovalDialog } from './dialogs/AppointmentApprovalDialog';
export { CreateAppointmentDialog } from './dialogs/CreateAppointmentDialog';
export { CreateAppointmentFromSlotDialog } from './dialogs/CreateAppointmentFromSlotDialog';
export { CreateRecurringAppointmentDialog } from './dialogs/CreateRecurringAppointmentDialog';
export { ConflictWarningDialog } from './dialogs/ConflictWarningDialog';
export { EmployeeManagementDialog } from './dialogs/EmployeeManagementDialog';
export { EmployeeChangeRequestDialog } from './dialogs/EmployeeChangeRequestDialog';

// Calendar
export { ProScheduleCalendar } from './calendar/ProScheduleCalendar';
export { ModernWeekCalendar } from './calendar/ModernWeekCalendar';
export { EmployeeWeekCalendar } from './calendar/EmployeeWeekCalendar';
export { CalendarGrid } from './calendar/CalendarGrid';
export { CalendarLegend } from './calendar/CalendarLegend';
export { CalendarStats } from './calendar/CalendarStats';
export { ProCalendarLegend } from './calendar/ProCalendarLegend';

// Panels
export { SmartAssignmentPanel } from './panels/SmartAssignmentPanel';
export { SmartMatchingPanel } from './panels/SmartMatchingPanel';
export { EmployeeFilterSidebar } from './panels/EmployeeFilterSidebar';
export { ConflictsNavigationCard } from './panels/ConflictsNavigationCard';

// Shared (still at root level)
export { ProScheduleHeader } from './ProScheduleHeader';
export { AppointmentApprovalBar } from './AppointmentApprovalBar';
export { UnassignedAppointmentsBar } from './UnassignedAppointmentsBar';
export { WeekNavigationBar } from './WeekNavigationBar';
export { DraggableAppointment } from './DraggableAppointment';
export { ProAppointmentCard } from './ProAppointmentCard';
export { EnhancedDropZone } from './EnhancedDropZone';
export { DropZone } from './DropZone';
export { EmployeeCard } from './EmployeeCard';
export { SortableEmployeeCard } from './SortableEmployeeCard';
export { EmployeeSuggestionCard } from './EmployeeSuggestionCard';
export { CustomerSearchCombobox } from './CustomerSearchCombobox';
