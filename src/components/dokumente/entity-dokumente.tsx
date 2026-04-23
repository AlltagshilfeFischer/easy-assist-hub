import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Upload, Download, Trash2, FileText, FileImage, File, X } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

type DokumentKategorie = 'kunde' | 'mitarbeiter';

interface PendingFile {
  file: File;
  titel: string;
}

interface Props {
  kategorie: DokumentKategorie;
  entityId: string;
}

export function EntityDokumente({ kategorie, entityId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryKey = ['entity-dokumente', kategorie, entityId];

  const { data: dokumente, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const filter = kategorie === 'kunde' ? 'kunden_id' : 'mitarbeiter_id';
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq(filter, entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    setPendingFiles(prev => [
      ...prev,
      ...arr.map(f => ({ file: f, titel: f.name.replace(/\.[^.]+$/, '') })),
    ]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Nicht angemeldet');
      setUploading(false);
      return;
    }

    let hasError = false;
    for (const pf of pendingFiles) {
      try {
        const ext = pf.file.name.split('.').pop();
        const folder = `${kategorie === 'kunde' ? 'kunden' : 'mitarbeiter'}/${entityId}`;
        const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: storageError } = await supabase.storage
          .from('dokumente')
          .upload(path, pf.file);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from('dokumente').insert({
          titel: pf.titel || pf.file.name,
          dateiname: pf.file.name,
          dateipfad: path,
          mime_type: pf.file.type,
          groesse_bytes: pf.file.size,
          kategorie,
          kunden_id: kategorie === 'kunde' ? entityId : null,
          mitarbeiter_id: kategorie === 'mitarbeiter' ? entityId : null,
          hochgeladen_von: user.id,
        });
        if (dbError) throw dbError;
      } catch {
        toast.error(`Upload fehlgeschlagen: ${pf.file.name}`);
        hasError = true;
      }
    }

    setUploading(false);
    if (!hasError) {
      toast.success(`${pendingFiles.length === 1 ? 'Dokument' : `${pendingFiles.length} Dokumente`} hochgeladen`);
      setPendingFiles([]);
      setDialogOpen(false);
    }
    queryClient.invalidateQueries({ queryKey });
  };

  const handleDownload = async (dateipfad: string, dateiname: string) => {
    try {
      const { data, error } = await supabase.storage.from('dokumente').download(dateipfad);
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

  const handleDelete = async (id: string, dateipfad: string) => {
    try {
      await supabase.storage.from('dokumente').remove([dateipfad]);
      const { error } = await supabase.from('dokumente').delete().eq('id', id);
      if (error) throw error;
      toast.success('Dokument gelöscht');
      queryClient.invalidateQueries({ queryKey });
    } catch {
      toast.error('Löschen fehlgeschlagen');
    }
  };

  const getIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500 shrink-0" />;
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {isLoading ? '...' : `${dokumente?.length ?? 0} Dokument${(dokumente?.length ?? 0) !== 1 ? 'e' : ''}`}
        </span>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Hochladen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !dokumente?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">Keine Dokumente vorhanden</p>
      ) : (
        <div className="space-y-1.5">
          {dokumente.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-2.5 border rounded-lg text-sm">
              {getIcon(doc.mime_type)}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{doc.titel}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(doc.created_at), 'dd.MM.yyyy', { locale: de })} · {formatSize(doc.groesse_bytes)}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onClick={() => handleDownload(doc.dateipfad, doc.dateiname)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(doc.id, doc.dateipfad)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPendingFiles([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dokumente hochladen</DialogTitle>
          </DialogHeader>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Dateien hierher ziehen oder klicken</p>
            <input ref={fileInputRef} type="file" multiple className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>

          {pendingFiles.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendingFiles.map((pf, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={pf.titel}
                    onChange={(e) => setPendingFiles(prev =>
                      prev.map((f, j) => j === i ? { ...f, titel: e.target.value } : f)
                    )}
                    placeholder="Titel"
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0 max-w-[120px] truncate">{pf.file.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setPendingFiles([]); }}>
              Abbrechen
            </Button>
            <Button onClick={handleUpload} disabled={!pendingFiles.length || uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pendingFiles.length > 0 ? `${pendingFiles.length} hochladen` : 'Hochladen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
