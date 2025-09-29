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
    <SidebarProvider>
      <SidebarContent>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <DashboardHeader />
            <main className="flex-1 p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarContent>
    </SidebarProvider>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardContent>{children}</DashboardContent>;
}