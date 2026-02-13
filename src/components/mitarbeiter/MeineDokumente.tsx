import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Download, File, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

export function MeineDokumente() {
  const { mitarbeiterId } = useUserRole();

  const { data: dokumente, isLoading } = useQuery({
    queryKey: ['meine-dokumente', mitarbeiterId],
    queryFn: async () => {
      if (!mitarbeiterId) return [];
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mitarbeiter_id', mitarbeiterId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!mitarbeiterId,
  });

  const handleDownload = async (dateipfad: string, dateiname: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('dokumente')
        .download(dateipfad);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = dateiname;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download fehlgeschlagen');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Meine Dokumente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!dokumente?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Keine Dokumente vorhanden
          </p>
        ) : (
          <div className="space-y-2">
            {dokumente.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.mime_type)}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{doc.titel}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), 'dd.MM.yyyy', { locale: de })} · {formatSize(doc.groesse_bytes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{doc.kategorie}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc.dateipfad, doc.dateiname)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
