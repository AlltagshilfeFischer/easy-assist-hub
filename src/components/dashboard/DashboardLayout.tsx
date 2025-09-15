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
    const handleMouseMove = (e: MouseEvent) => {
      // If mouse is within 10px of left edge, open sidebar
      if (e.clientX <= 10) {
        setOpen(true);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
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