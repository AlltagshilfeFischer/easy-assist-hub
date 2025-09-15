import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { DashboardHeader } from './DashboardHeader';
import { useAuth } from '@/hooks/useAuth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const { setOpen } = useSidebar();

  useEffect(() => {
    let mouseLeaveTimer: NodeJS.Timeout;
    let isMouseNearEdge = false;

    const handleMouseMove = (e: MouseEvent) => {
      // If mouse is within 15px of left edge, open sidebar
      if (e.clientX <= 15) {
        if (!isMouseNearEdge) {
          isMouseNearEdge = true;
          setOpen(true);
        }
        // Clear any pending close timer
        if (mouseLeaveTimer) {
          clearTimeout(mouseLeaveTimer);
        }
      } else if (e.clientX > 300) {
        // If mouse moves away from sidebar area (300px+), start close timer
        if (isMouseNearEdge) {
          isMouseNearEdge = false;
          mouseLeaveTimer = setTimeout(() => {
            setOpen(false);
          }, 1500); // Close after 1.5 seconds of being away
        }
      }
    };

    const handleMouseLeave = () => {
      // If mouse leaves the window, start close timer
      if (isMouseNearEdge) {
        isMouseNearEdge = false;
        mouseLeaveTimer = setTimeout(() => {
          setOpen(false);
        }, 1000);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (mouseLeaveTimer) {
        clearTimeout(mouseLeaveTimer);
      }
    };
  }, [setOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}