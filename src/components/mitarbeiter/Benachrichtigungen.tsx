import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, Calendar, ArrowRightLeft, XCircle, FileText, UserCheck } from 'lucide-react';
import { useBenachrichtigungen, useMarkAsRead, useMarkAllAsRead, type Benachrichtigung } from '@/hooks/useBenachrichtigungen';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const ICON_MAP: Record<string, typeof Bell> = {
  termin_neu: Calendar,
  termin_geaendert: ArrowRightLeft,
  termin_abgesagt: XCircle,
  ln_bereit: FileText,
  abwesenheit_status: UserCheck,
  info: Bell,
};

export function Benachrichtigungen() {
  const { data: items = [], isLoading } = useBenachrichtigungen();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = items.filter((b) => !b.gelesen).length;

  const handleClick = (item: Benachrichtigung) => {
    if (!item.gelesen) {
      markAsRead.mutate(item.id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Laden...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Benachrichtigungen
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Alle gelesen
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Keine Benachrichtigungen</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => {
              const Icon = ICON_MAP[item.typ] || Bell;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    item.gelesen ? 'bg-background opacity-60' : 'bg-primary/5 border-primary/20'
                  } hover:bg-accent`}
                  onClick={() => handleClick(item)}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.gelesen ? 'text-muted-foreground' : 'text-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.gelesen ? 'font-normal' : 'font-medium'}`}>{item.titel}</p>
                    {item.nachricht && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.nachricht}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  {!item.gelesen && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
