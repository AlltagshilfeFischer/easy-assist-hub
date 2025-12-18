/* @refresh reset */
import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { DashboardHeader } from './DashboardHeader';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function SidebarAutoCollapseHandler() {
  const location = useLocation();
  const { setOpen } = useSidebar();
  const { settings } = useSettings();
  const prevPathRef = useRef<string>('');

  useEffect(() => {
    const isSchedulePage = location.pathname.includes('/schedule-builder');
    const wasSchedulePage = prevPathRef.current.includes('/schedule-builder');
    
    // Only collapse when NAVIGATING TO schedule-builder (not already there)
    if (settings.sidebarAutoCollapseOnSchedule && isSchedulePage && !wasSchedulePage) {
      setOpen(false);
    }
    
    prevPathRef.current = location.pathname;
  }, [location.pathname, settings.sidebarAutoCollapseOnSchedule, setOpen]);

  return null;
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <SidebarAutoCollapseHandler />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col w-full">
          <DashboardHeader />
          <main className="flex-1 w-full p-3 sm:p-4 lg:p-6 overflow-x-hidden">
            <div className="max-w-[1920px] mx-auto">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardContent>{children}</DashboardContent>;
}