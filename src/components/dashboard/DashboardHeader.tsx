import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { LogOut, User, Shield } from 'lucide-react';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { role, getRoleLabel, getRoleBadgeVariant } = useUserRole();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  const getUserInitials = () => {
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'NU';
  };

  return (
    <header className="sticky top-0 z-30 pointer-events-auto h-14 sm:h-16 border-b bg-card px-3 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <SidebarTrigger className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-semibold truncate">Alltagshilfe Control Board</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Willkommen</p>
            {role && (
              <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] sm:text-xs">
                <Shield className="h-3 w-3 mr-1 hidden sm:inline" />
                {getRoleLabel(role)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <NotificationBell onClick={() => navigate('/dashboard/mein-bereich')} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-white">
                  <img src="/uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" alt="User" className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 z-[200] bg-popover" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {role ? getRoleLabel(role) : 'Benutzer'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button className="w-full flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button
                className="w-full flex items-center text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Abmelden</span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}