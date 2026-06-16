import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, Calendar, ArrowRightLeft, XCircle, FileText, UserCheck, Trash2, ExternalLink } from 'lucide-react';
import { useBenachrichtigungen, useMarkAsRead, useMarkAllAsRead, useDeleteBenachrichtigung, type Benachrichtigung } from '@/hooks/useBenachrichtigungen';
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

interface Props {
  onOpenTermin?: (terminId: string) => void;
}

export function Benachrichtigungen({ onOpenTermin }: Props) {
  const { data: items = [], isLoading } = useBenachrichtigungen();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteBenachrichtigung = useDeleteBenachrichtigung();

  const unreadCount = items.filter((b) => !b.gelesen).length;

  const handleClick = (item: Benachrichtigung) => {
    if (!item.gelesen) {
      markAsRead.mutate(item.id);
    }
    if (item.termin_id && onOpenTermin) {
      onOpenTermin(item.termin_id);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteBenachrichtigung.mutate(id);
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
              const hasLink = !!item.termin_id && !!onOpenTermin;
              return (
                <div
                  key={item.id}
                  className={`group relative flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    item.gelesen ? 'bg-background opacity-70' : 'bg-primary/5 border-primary/20'
                  } ${hasLink ? 'cursor-pointer hover:bg-accent' : ''}`}
                  onClick={() => handleClick(item)}
                  role={hasLink ? 'button' : undefined}
                  tabIndex={hasLink ? 0 : undefined}
                  onKeyDown={hasLink ? (e) => e.key === 'Enter' && handleClick(item) : undefined}
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
                  <div className="flex items-center gap-1 shrink-0">
                    {hasLink && (
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    {!item.gelesen && !hasLink && <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
                    {!item.gelesen && hasLink && <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
                    <button
                      type="button"
                      className="ml-1 p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      onClick={(e) => handleDelete(e, item.id)}
                      disabled={deleteBenachrichtigung.isPending}
                      title="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
