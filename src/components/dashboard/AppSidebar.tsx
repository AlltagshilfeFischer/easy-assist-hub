import { NavLink, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Calendar,
  Home,
  Users,
  FileText,
  Settings,
  UserCheck,
  UserCog,
  FolderOpen,
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

const dashboardItems = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
];

const controlboardItems = [
  { title: 'Dienstplan', url: '/dashboard/controlboard/schedule-builder', icon: Calendar },
  { title: 'Kunden/Neukunden', url: '/dashboard/controlboard/master-data', icon: Users },
  { title: 'Mitarbeiter', url: '/dashboard/controlboard/admin', icon: UserCog },
  { title: 'Dokumentenverwaltung', url: '/dashboard/controlboard/dokumentenverwaltung', icon: FolderOpen },
  { title: 'Leistungen & Abrechnungen', url: '/dashboard/controlboard/billing', icon: FileText },
];

const settingsItems = [
  { title: 'Einstellungen', url: '/dashboard/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { role } = useUserRole();

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

  return (
    <Sidebar>
      <SidebarContent className="border-r">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <img src="/lovable-uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" alt="Logo" className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sm">Alltagshilfe</h2>
                <p className="text-xs text-muted-foreground">Fischer</p>
              </div>
            )}
          </div>
        </div>

        {/* Mitarbeiter sehen nur Dashboard */}
        {role === 'mitarbeiter' ? (
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard" className={getNavClass('/dashboard')}>
                      <Home className="h-4 w-4" />
                      {!collapsed && <span>Meine Termine</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            {/* Dashboard */}
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {dashboardItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavClass(item.url)}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Controlboard */}
            <SidebarGroup>
              <SidebarGroupLabel>Controlboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {controlboardItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavClass(item.url)}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Settings */}
            <SidebarGroup>
              <SidebarGroupLabel>System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavClass(item.url)}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}