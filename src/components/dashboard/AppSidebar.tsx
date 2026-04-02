import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Home,
  Users,
  FileText,
  Settings,
  UserCog,
  FolderOpen,
  ClipboardCheck,
  UserCircle,
  ScrollText,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles: UserRole[];
}

const dashboardItems: SidebarItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: Home, requiredRoles: ['globaladmin', 'geschaeftsfuehrer', 'buchhaltung', 'mitarbeiter'] },
  { title: 'Mein Bereich', url: '/dashboard/mein-bereich', icon: UserCircle, requiredRoles: ['geschaeftsfuehrer', 'mitarbeiter'] },
];

const controlboardItems: SidebarItem[] = [
  { title: 'Dienstplan', url: '/dashboard/controlboard/schedule-builder', icon: Calendar, requiredRoles: ['globaladmin', 'geschaeftsfuehrer'] },
  { title: 'Kunden/Neukunden', url: '/dashboard/controlboard/master-data', icon: Users, requiredRoles: ['globaladmin', 'geschaeftsfuehrer', 'buchhaltung'] },
  { title: 'Mitarbeiter', url: '/dashboard/controlboard/admin', icon: UserCog, requiredRoles: ['globaladmin', 'geschaeftsfuehrer'] },
  { title: 'Dokumentenverwaltung', url: '/dashboard/controlboard/dokumentenverwaltung', icon: FolderOpen, requiredRoles: ['globaladmin', 'geschaeftsfuehrer', 'buchhaltung'] },
  { title: 'Leistungsnachweise', url: '/dashboard/controlboard/leistungsnachweise', icon: ClipboardCheck, requiredRoles: ['globaladmin', 'geschaeftsfuehrer', 'buchhaltung'] },
  { title: 'Budgettracker', url: '/dashboard/controlboard/budgettracker', icon: TrendingUp, requiredRoles: ['globaladmin', 'geschaeftsfuehrer', 'buchhaltung'] },
  { title: 'Berichte', url: '/dashboard/controlboard/reporting', icon: BarChart3, requiredRoles: ['globaladmin', 'geschaeftsfuehrer', 'buchhaltung'] },
  { title: 'Aktivitätslog', url: '/dashboard/controlboard/aktivitaetslog', icon: ScrollText, requiredRoles: ['globaladmin'] },
];

const systemItems: SidebarItem[] = [
  { title: 'Einstellungen', url: '/dashboard/settings', icon: Settings, requiredRoles: ['globaladmin', 'geschaeftsfuehrer'] },
];

function filterByRole(items: SidebarItem[], roles: UserRole[]): SidebarItem[] {
  return items.filter(item =>
    item.requiredRoles.some(reqRole => roles.includes(reqRole))
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { roles, isGeschaeftsfuehrer, isGlobalAdmin } = useUserRole();

  const canSeeUnassignedBadge = isGeschaeftsfuehrer || isGlobalAdmin;

  const { data: unassignedCount = 0 } = useQuery({
    queryKey: ['unassigned-count'],
    enabled: canSeeUnassignedBadge,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('termine')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unassigned');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const visibleDashboard = filterByRole(dashboardItems, roles);
  const visibleControlboard = filterByRole(controlboardItems, roles);
  const visibleSystem = filterByRole(systemItems, roles);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard';
    }
    return currentPath.startsWith(path);
  };

  const getNavClass = (path: string) => {
    return isActive(path)
      ? "bg-primary text-primary-foreground font-medium"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
  };

  const isScheduleBuilderUrl = (url: string) =>
    url === '/dashboard/controlboard/schedule-builder';

  const renderMenuItems = (items: SidebarItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink to={item.url} className={getNavClass(item.url)}>
            <item.icon className="h-4 w-4" />
            {!collapsed && <span className="flex-1">{item.title}</span>}
            {!collapsed && isScheduleBuilderUrl(item.url) && canSeeUnassignedBadge && unassignedCount > 0 && (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0 h-4 ml-auto"
              >
                {unassignedCount}
              </Badge>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent className="border-r">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <img src="/uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" alt="Logo" className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sm">Alltagshilfe</h2>
                <p className="text-xs text-muted-foreground">Fischer</p>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard */}
        {visibleDashboard.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderMenuItems(visibleDashboard)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Controlboard */}
        {visibleControlboard.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Controlboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderMenuItems(visibleControlboard)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System */}
        {visibleSystem.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderMenuItems(visibleSystem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
