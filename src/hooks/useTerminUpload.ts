import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from '@/lib/uuid';

/**
 * Lädt eine Liste von Dateien für einen Termin in Supabase Storage hoch
 * und speichert Metadaten in der dokumente-Tabelle (termin_id FK).
 */
export function useTerminUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (terminId: string, files: File[]): Promise<void> => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Nicht authentifiziert');

      for (const file of files) {
        const storagePath = `termine/${terminId}/${generateUUID()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('dokumente')
          .upload(storagePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from('dokumente').insert({
          dateiname: file.name,
          dateipfad: storagePath,
          mime_type: file.type || 'application/octet-stream',
          groesse_bytes: file.size,
          hochgeladen_von: userData.user.id,
          titel: file.name,
          kategorie: 'termin_anhang',
          kunden_id: null,
          mitarbeiter_id: null,
          termin_id: terminId,
        });

        if (insertError) throw insertError;
      }
    } finally {
      setUploading(false);
    }
  };

  return { uploadFiles, uploading };
}
