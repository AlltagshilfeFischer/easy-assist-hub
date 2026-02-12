import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { LogOut, User, Shield } from 'lucide-react';
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
    <header className="relative z-[100] pointer-events-auto h-16 border-b bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-8 w-8" />
        <div>
          <h1 className="text-lg font-semibold">Alltagshilfe Control Board</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Willkommen</p>
            {role && (
              <Badge variant={getRoleBadgeVariant(role)} className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                {getRoleLabel(role)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-white">
                  <img src="/lovable-uploads/891b224f-e6be-40c4-bfcb-acf04320f118.png" alt="User" className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
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