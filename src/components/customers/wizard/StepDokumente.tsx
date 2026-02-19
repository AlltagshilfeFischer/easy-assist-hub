import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, File, X } from 'lucide-react';

interface DocumentUploadZoneProps {
  category: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

function DocumentUploadZone({ category, files, onFilesChange }: DocumentUploadZoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    onFilesChange([...files, ...dropped]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesChange([...files, ...Array.from(e.target.files)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => document.getElementById(`file-input-${category}`)?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Dateien hierher ziehen oder <span className="text-primary font-medium">durchsuchen</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, Bilder und andere Dokumente</p>
        <input id={`file-input-${category}`} type="file" multiple className="hidden" onChange={handleFileInput} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      </div>
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(file.size)}</span>
              </div>
              <button type="button" onClick={() => removeFile(index)} className="p-1 hover:bg-destructive/10 rounded">
                <X className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface StepDokumenteProps {
  documentFiles: { vertrag: File[]; historie: File[]; antragswesen: File[] };
  setDocumentFiles: (fn: (prev: { vertrag: File[]; historie: File[]; antragswesen: File[] }) => { vertrag: File[]; historie: File[]; antragswesen: File[] }) => void;
}

export function StepDokumente({ documentFiles, setDocumentFiles }: StepDokumenteProps) {
  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Dienstleistungsvertrag</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadZone category="vertrag" files={documentFiles.vertrag} onFilesChange={(files) => setDocumentFiles((prev) => ({ ...prev, vertrag: files }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><File className="h-4 w-4" />Leistungsnachweise (Historie)</CardTitle>
          <p className="text-xs text-muted-foreground">Zurückliegende Leistungsnachweise hochladen</p>
        </CardHeader>
        <CardContent>
          <DocumentUploadZone category="historie" files={documentFiles.historie} onFilesChange={(files) => setDocumentFiles((prev) => ({ ...prev, historie: files }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Antragswesen</CardTitle>
          <p className="text-xs text-muted-foreground">Kopien ausgefüllter Anträge (Pflegekasse etc.)</p>
        </CardHeader>
        <CardContent>
          <DocumentUploadZone category="antragswesen" files={documentFiles.antragswesen} onFilesChange={(files) => setDocumentFiles((prev) => ({ ...prev, antragswesen: files }))} />
        </CardContent>
      </Card>
    </div>
  );
}
