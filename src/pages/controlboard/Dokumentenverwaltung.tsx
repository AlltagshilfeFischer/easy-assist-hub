import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, Download, Trash2, Upload, Search, Calendar, User, Users, Building2, 
  ChevronRight, ChevronDown, FolderOpen, File, Eye, X, FileImage, FileIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type DokumentKategorie = 'kunde' | 'mitarbeiter' | 'intern';

interface Dokument {
  id: string;
  titel: string;
  beschreibung: string | null;
  dateiname: string;
  dateipfad: string;
  mime_type: string;
  groesse_bytes: number;
  kategorie: DokumentKategorie;
  kunden_id: string | null;
  mitarbeiter_id: string | null;
  hochgeladen_von: string;
  created_at: string;
  kunden?: {
    vorname: string | null;
    nachname: string | null;
  } | null;
  mitarbeiter?: {
    vorname: string | null;
    nachname: string | null;
  } | null;
}

interface Kunde {
  id: string;
  vorname: string | null;
  nachname: string | null;
  kategorie: string | null;
}

interface Mitarbeiter {
  id: string;
  vorname: string | null;
  nachname: string | null;
}

interface PendingFile {
  file: File;
  titel: string;
  beschreibung: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export default function Dokumentenverwaltung() {
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<DokumentKategorie>('kunde');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Multi-file upload state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadKategorie, setUploadKategorie] = useState<DokumentKategorie>('kunde');
  const [uploadKundenId, setUploadKundenId] = useState('');
  const [uploadMitarbeiterId, setUploadMitarbeiterId] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Preview state
  const [previewDokument, setPreviewDokument] = useState<Dokument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadKunden();
    loadMitarbeiter();
    loadDokumente();
  }, []);

  // Auto-select first entity when switching tabs
  useEffect(() => {
    if (activeTab === 'kunde' && kunden.length > 0 && !selectedEntityId) {
      setSelectedEntityId(kunden[0].id);
    } else if (activeTab === 'mitarbeiter' && mitarbeiter.length > 0 && !selectedEntityId) {
      setSelectedEntityId(mitarbeiter[0].id);
    } else if (activeTab === 'intern') {
      setSelectedEntityId(null);
    }
  }, [activeTab, kunden, mitarbeiter]);

  const loadKunden = async () => {
    const { data, error } = await supabase
      .from('kunden')
      .select('id, vorname, nachname, kategorie')
      .eq('aktiv', true)
      .order('nachname');

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Kunden konnten nicht geladen werden',
        variant: 'destructive',
      });
      return;
    }

    setKunden(data || []);
  };

  const loadMitarbeiter = async () => {
    const { data, error } = await supabase
      .from('mitarbeiter')
      .select('id, vorname, nachname')
      .eq('ist_aktiv', true)
      .order('nachname');

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Mitarbeiter konnten nicht geladen werden',
        variant: 'destructive',
      });
      return;
    }

    setMitarbeiter(data || []);
  };

  const loadDokumente = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dokumente')
      .select(`
        *,
        kunden:kunden_id (vorname, nachname),
        mitarbeiter:mitarbeiter_id (vorname, nachname)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Dokumente konnten nicht geladen werden',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setDokumente((data || []) as Dokument[]);
    setLoading(false);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const addFiles = (files: File[]) => {
    const newPendingFiles: PendingFile[] = files.map((file) => ({
      file,
      titel: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for default title
      beschreibung: '',
      status: 'pending',
      progress: 0,
    }));
    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = ''; // Reset to allow same file selection
  };

  const updatePendingFile = (index: number, updates: Partial<PendingFile>) => {
    setPendingFiles((prev) =>
      prev.map((pf, i) => (i === index ? { ...pf, ...updates } : pf))
    );
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMultiUpload = async () => {
    if (pendingFiles.length === 0) {
      toast({
        title: 'Fehler',
        description: 'Bitte mindestens eine Datei hinzufügen',
        variant: 'destructive',
      });
      return;
    }

    if (uploadKategorie === 'kunde' && !uploadKundenId) {
      toast({
        title: 'Fehler',
        description: 'Bitte einen Kunden auswählen',
        variant: 'destructive',
      });
      return;
    }

    if (uploadKategorie === 'mitarbeiter' && !uploadMitarbeiterId) {
      toast({
        title: 'Fehler',
        description: 'Bitte einen Mitarbeiter auswählen',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Nicht angemeldet',
        variant: 'destructive',
      });
      setUploading(false);
      return;
    }

    for (let i = 0; i < pendingFiles.length; i++) {
      const pf = pendingFiles[i];
      if (pf.status !== 'pending') continue;

      updatePendingFile(i, { status: 'uploading', progress: 0 });

      try {
        const fileExt = pf.file.name.split('.').pop();
        let folderPath = '';
        if (uploadKategorie === 'kunde') {
          folderPath = `kunden/${uploadKundenId}`;
        } else if (uploadKategorie === 'mitarbeiter') {
          folderPath = `mitarbeiter/${uploadMitarbeiterId}`;
        } else {
          folderPath = 'intern';
        }
        const fileName = `${folderPath}/${Date.now()}_${i}.${fileExt}`;

        updatePendingFile(i, { progress: 30 });

        const { error: uploadError } = await supabase.storage
          .from('dokumente')
          .upload(fileName, pf.file);

        if (uploadError) throw uploadError;

        updatePendingFile(i, { progress: 70 });

        const { error: metadataError } = await supabase
          .from('dokumente')
          .insert({
            titel: pf.titel || pf.file.name,
            beschreibung: pf.beschreibung || null,
            dateiname: pf.file.name,
            dateipfad: fileName,
            mime_type: pf.file.type,
            groesse_bytes: pf.file.size,
            kategorie: uploadKategorie,
            kunden_id: uploadKategorie === 'kunde' ? uploadKundenId : null,
            mitarbeiter_id: uploadKategorie === 'mitarbeiter' ? uploadMitarbeiterId : null,
            hochgeladen_von: user.id,
          });

        if (metadataError) throw metadataError;

        updatePendingFile(i, { status: 'done', progress: 100 });
      } catch (error: any) {
        const msg = error.message || 'Upload fehlgeschlagen';
        const detail = error.statusCode === 403 || msg.includes('security') || msg.includes('policy')
          ? `${msg} — Bitte prüfen Sie die Berechtigungen (Storage-Bucket oder Datenbankrichtlinien).`
          : msg;
        updatePendingFile(i, { status: 'error', error: detail });
      }
    }

    setUploading(false);

    // Use functional update to read latest state (avoid stale closure)
    setPendingFiles((prev) => {
      const successCount = prev.filter((pf) => pf.status === 'done').length;
      const errorCount = prev.filter((pf) => pf.status === 'error').length;

      if (successCount > 0) {
        toast({
          title: 'Erfolg',
          description: `${successCount} Dokument${successCount !== 1 ? 'e' : ''} erfolgreich hochgeladen`,
        });
        loadDokumente();
      }

      if (errorCount > 0) {
        toast({
          title: 'Warnung',
          description: `${errorCount} Upload${errorCount !== 1 ? 's' : ''} fehlgeschlagen`,
          variant: 'destructive',
        });
      }

      if (prev.every((pf) => pf.status === 'done')) {
        setTimeout(() => {
          setUploadDialogOpen(false);
          resetUploadForm();
        }, 0);
        return [];
      }

      return prev.filter((pf) => pf.status !== 'done');
    });
  };

  const resetUploadForm = () => {
    setPendingFiles([]);
    setUploadKategorie('kunde');
    setUploadKundenId('');
    setUploadMitarbeiterId('');
  };

  const handleDownload = async (dokument: Dokument) => {
    try {
      const { data, error } = await supabase.storage
        .from('dokumente')
        .download(dokument.dateipfad);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = dokument.dateiname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Erfolg',
        description: 'Dokument wird heruntergeladen',
      });
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Download fehlgeschlagen',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (dokument: Dokument) => {
    if (!confirm(`Dokument "${dokument.titel}" wirklich löschen?`)) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('dokumente')
        .remove([dokument.dateipfad]);

      if (storageError) throw storageError;

      const { error: metadataError } = await supabase
        .from('dokumente')
        .delete()
        .eq('id', dokument.id);

      if (metadataError) throw metadataError;

      toast({
        title: 'Erfolg',
        description: 'Dokument gelöscht',
      });

      loadDokumente();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Löschen fehlgeschlagen',
        variant: 'destructive',
      });
    }
  };

  // Preview functionality
  const handlePreview = async (dokument: Dokument) => {
    setPreviewDokument(dokument);
    setPreviewLoading(true);
    setPreviewUrl(null);

    try {
      const { data, error } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(dokument.dateipfad, 3600); // 1 hour

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Vorschau konnte nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDokument(null);
    setPreviewUrl(null);
  };

  const canPreview = (mimeType: string) => {
    return (
      mimeType.includes('pdf') ||
      mimeType.includes('image')
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getMimeTypeIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    return '📎';
  };

  // Get documents for selected entity, grouped by year
  const entityDocuments = useMemo(() => {
    let filtered = dokumente.filter(d => d.kategorie === activeTab);
    
    if (activeTab === 'kunde' && selectedEntityId) {
      filtered = filtered.filter(d => d.kunden_id === selectedEntityId);
    } else if (activeTab === 'mitarbeiter' && selectedEntityId) {
      filtered = filtered.filter(d => d.mitarbeiter_id === selectedEntityId);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.titel.toLowerCase().includes(query) ||
        d.dateiname.toLowerCase().includes(query) ||
        (d.beschreibung && d.beschreibung.toLowerCase().includes(query))
      );
    }

    // Group by year
    const grouped: Record<string, Dokument[]> = {};
    filtered.forEach(doc => {
      const year = new Date(doc.created_at).getFullYear().toString();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(doc);
    });

    // Sort years descending
    const sortedYears = Object.keys(grouped).sort((a, b) => parseInt(b) - parseInt(a));
    
    return { grouped, sortedYears, total: filtered.length };
  }, [dokumente, activeTab, selectedEntityId, searchQuery]);

  // Get document count per entity
  const getEntityDocCount = (entityId: string, type: 'kunde' | 'mitarbeiter') => {
    return dokumente.filter(d => 
      type === 'kunde' ? d.kunden_id === entityId : d.mitarbeiter_id === entityId
    ).length;
  };

  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Auto-expand current year
  useEffect(() => {
    const currentYear = new Date().getFullYear().toString();
    setExpandedYears(new Set([currentYear]));
  }, []);

  const getEntityFullName = (entity: Kunde | Mitarbeiter) => {
    return `${entity.vorname || ''} ${entity.nachname || ''}`.trim() || 'Unbekannt';
  };

  const getSelectedEntityName = () => {
    if (activeTab === 'kunde') {
      const kunde = kunden.find(k => k.id === selectedEntityId);
      return kunde ? getEntityFullName(kunde) : '';
    } else if (activeTab === 'mitarbeiter') {
      const ma = mitarbeiter.find(m => m.id === selectedEntityId);
      return ma ? getEntityFullName(ma) : '';
    }
    return 'Interne Dokumente';
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dokumentenverwaltung</h1>
          <p className="text-muted-foreground mt-1">
            Dokumente nach Kunden und Mitarbeitern organisiert
          </p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) resetUploadForm();
        }}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Upload className="mr-2 h-5 w-5" />
              Dokumente hochladen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Dokumente hochladen</DialogTitle>
              <DialogDescription>
                Ziehen Sie Dateien hierher oder klicken Sie zum Auswählen
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Category Selection */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Kategorie *</Label>
                  <Select
                    value={uploadKategorie}
                    onValueChange={(value: DokumentKategorie) => {
                      setUploadKategorie(value);
                      setUploadKundenId('');
                      setUploadMitarbeiterId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kunde">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Kunde
                        </div>
                      </SelectItem>
                      <SelectItem value="mitarbeiter">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Mitarbeiter
                        </div>
                      </SelectItem>
                      <SelectItem value="intern">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Intern
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {uploadKategorie === 'kunde' && (
                  <div className="col-span-2">
                    <Label>Kunde *</Label>
                    <Select
                      value={uploadKundenId}
                      onValueChange={setUploadKundenId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kunde auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {kunden.map((kunde) => (
                          <SelectItem key={kunde.id} value={kunde.id}>
                            {getEntityFullName(kunde)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {uploadKategorie === 'mitarbeiter' && (
                  <div className="col-span-2">
                    <Label>Mitarbeiter *</Label>
                    <Select
                      value={uploadMitarbeiterId}
                      onValueChange={setUploadMitarbeiterId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mitarbeiter auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mitarbeiter.map((ma) => (
                          <SelectItem key={ma.id} value={ma.id}>
                            {getEntityFullName(ma)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Dateien hierher ziehen oder
                </p>
                <label>
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">Dateien auswählen</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
                </p>
              </div>

              {/* Pending Files List */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Zu hochladende Dateien ({pendingFiles.length})</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingFiles.map((pf, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          pf.status === 'done'
                            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                            : pf.status === 'error'
                            ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                            : 'bg-card'
                        }`}
                      >
                        <span className="text-xl flex-shrink-0">
                          {getMimeTypeIcon(pf.file.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <Input
                            value={pf.titel}
                            onChange={(e) => updatePendingFile(index, { titel: e.target.value })}
                            placeholder="Titel"
                            className="h-8 mb-1"
                            disabled={pf.status !== 'pending'}
                          />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{pf.file.name}</span>
                            <span>•</span>
                            <span>{formatFileSize(pf.file.size)}</span>
                          </div>
                          {pf.status === 'uploading' && (
                            <Progress value={pf.progress} className="h-1 mt-1" />
                          )}
                          {pf.status === 'error' && (
                            <p className="text-xs text-destructive mt-1">{pf.error}</p>
                          )}
                          {pf.status === 'done' && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              ✓ Erfolgreich hochgeladen
                            </p>
                          )}
                        </div>
                        {pf.status === 'pending' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removePendingFile(index)}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(false);
                  resetUploadForm();
                }}
                disabled={uploading}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleMultiUpload}
                disabled={uploading || pendingFiles.filter((pf) => pf.status === 'pending').length === 0}
              >
                {uploading
                  ? 'Wird hochgeladen...'
                  : `${pendingFiles.filter((pf) => pf.status === 'pending').length} Datei${
                      pendingFiles.filter((pf) => pf.status === 'pending').length !== 1 ? 'en' : ''
                    } hochladen`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDokument} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{previewDokument && getMimeTypeIcon(previewDokument.mime_type)}</span>
              {previewDokument?.titel}
            </DialogTitle>
            <DialogDescription>
              {previewDokument?.dateiname} • {previewDokument && formatFileSize(previewDokument.groesse_bytes)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted/30">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full py-12">
                <p className="text-muted-foreground">Vorschau wird geladen...</p>
              </div>
            ) : previewUrl && previewDokument ? (
              previewDokument.mime_type.includes('pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh]"
                  title={previewDokument.titel}
                />
              ) : previewDokument.mime_type.includes('image') ? (
                <div className="flex items-center justify-center h-full p-4">
                  <img
                    src={previewUrl}
                    alt={previewDokument.titel}
                    className="max-w-full max-h-[60vh] object-contain rounded"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full py-12">
                  <p className="text-muted-foreground">Keine Vorschau verfügbar</p>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full py-12">
                <p className="text-muted-foreground">Keine Vorschau verfügbar</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>
              Schließen
            </Button>
            {previewDokument && (
              <Button onClick={() => handleDownload(previewDokument)}>
                <Download className="mr-2 h-4 w-4" />
                Herunterladen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as DokumentKategorie);
        setSelectedEntityId(null);
        setSearchQuery('');
        setEntitySearchQuery('');
      }} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="kunde" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Kunden ({dokumente.filter(d => d.kategorie === 'kunde').length})
          </TabsTrigger>
          <TabsTrigger value="mitarbeiter" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mitarbeiter ({dokumente.filter(d => d.kategorie === 'mitarbeiter').length})
          </TabsTrigger>
          <TabsTrigger value="intern" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Intern ({dokumente.filter(d => d.kategorie === 'intern').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 min-h-0 mt-0">
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Left sidebar: Entity list */}
            {activeTab !== 'intern' && (
              <Card className="col-span-3 flex flex-col min-h-0">
                <CardHeader className="py-3 px-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                      className="pl-9 h-9"
                      placeholder={`${activeTab === 'kunde' ? 'Kunde' : 'Mitarbeiter'} suchen...`}
                      value={entitySearchQuery}
                      onChange={(e) => setEntitySearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {activeTab === 'kunde' ? (
                      kunden.filter((k) => {
                        if (!entitySearchQuery) return true;
                        const q = entitySearchQuery.toLowerCase();
                        return (k.vorname || '').toLowerCase().includes(q) || (k.nachname || '').toLowerCase().includes(q);
                      }).map((kunde) => {
                        const docCount = getEntityDocCount(kunde.id, 'kunde');
                        const isSelected = selectedEntityId === kunde.id;
                        return (
                          <button
                            key={kunde.id}
                            onClick={() => setSelectedEntityId(kunde.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors mb-1 ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <User className={`h-4 w-4 flex-shrink-0 ${isSelected ? '' : 'text-muted-foreground'}`} />
                              <span className="truncate font-medium text-sm">
                                {getEntityFullName(kunde)}
                              </span>
                            </div>
                            <Badge 
                              variant={isSelected ? "secondary" : "outline"} 
                              className={`ml-2 flex-shrink-0 ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                            >
                              {docCount}
                            </Badge>
                          </button>
                        );
                      })
                    ) : (
                      mitarbeiter.filter((m) => {
                        if (!entitySearchQuery) return true;
                        const q = entitySearchQuery.toLowerCase();
                        return (m.vorname || '').toLowerCase().includes(q) || (m.nachname || '').toLowerCase().includes(q);
                      }).map((ma) => {
                        const docCount = getEntityDocCount(ma.id, 'mitarbeiter');
                        const isSelected = selectedEntityId === ma.id;
                        return (
                          <button
                            key={ma.id}
                            onClick={() => setSelectedEntityId(ma.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors mb-1 ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Users className={`h-4 w-4 flex-shrink-0 ${isSelected ? '' : 'text-muted-foreground'}`} />
                              <span className="truncate font-medium text-sm">
                                {getEntityFullName(ma)}
                              </span>
                            </div>
                            <Badge 
                              variant={isSelected ? "secondary" : "outline"} 
                              className={`ml-2 flex-shrink-0 ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                            >
                              {docCount}
                            </Badge>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {/* Right content: Documents grouped by year */}
            <Card className={`${activeTab === 'intern' ? 'col-span-12' : 'col-span-9'} flex flex-col min-h-0`}>
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        {getSelectedEntityName() || 'Kein Eintrag ausgewählt'}
                      </CardTitle>
                      <CardDescription>
                        {entityDocuments.total} Dokument{entityDocuments.total !== 1 ? 'e' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 h-9"
                      placeholder="Dokument suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Dokumente werden geladen...</p>
                  </div>
                ) : !selectedEntityId && activeTab !== 'intern' ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <User className="h-12 w-12 mb-4 opacity-50" />
                    <p>Wählen Sie einen {activeTab === 'kunde' ? 'Kunden' : 'Mitarbeiter'} aus</p>
                  </div>
                ) : entityDocuments.total === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p>Keine Dokumente vorhanden</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {entityDocuments.sortedYears.map((year) => (
                      <Collapsible 
                        key={year}
                        open={expandedYears.has(year)}
                        onOpenChange={() => toggleYear(year)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            {expandedYears.has(year) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{year}</span>
                            <Badge variant="secondary" className="ml-auto">
                              {entityDocuments.grouped[year].length} Dokument{entityDocuments.grouped[year].length !== 1 ? 'e' : ''}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-2 space-y-2 border-l-2 border-muted pl-4">
                            {entityDocuments.grouped[year].map((dokument) => (
                              <div
                                key={dokument.id}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow group"
                              >
                                <span className="text-2xl flex-shrink-0">
                                  {getMimeTypeIcon(dokument.mime_type)}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{dokument.titel}</span>
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      {formatFileSize(dokument.groesse_bytes)}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span className="truncate">{dokument.dateiname}</span>
                                    <span>•</span>
                                    <span>{format(new Date(dokument.created_at), 'dd.MM.yyyy', { locale: de })}</span>
                                  </div>
                                  {dokument.beschreibung && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                      {dokument.beschreibung}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {canPreview(dokument.mime_type) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handlePreview(dokument)}
                                      title="Vorschau"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownload(dokument)}
                                    title="Herunterladen"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(dokument)}
                                    title="Löschen"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
