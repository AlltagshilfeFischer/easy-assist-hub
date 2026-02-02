import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  mitarbeiterId: string;
  currentAvatarUrl?: string | null;
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  onUploadComplete?: (url: string) => void;
  onRemove?: () => void;
  editable?: boolean;
}

export function AvatarUpload({
  mitarbeiterId,
  currentAvatarUrl,
  name,
  color = '#3B82F6',
  size = 'md',
  onUploadComplete,
  onRemove,
  editable = true,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Ungültiger Dateityp',
          description: 'Bitte wählen Sie ein Bild aus.',
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'Datei zu groß',
          description: 'Maximale Dateigröße ist 5MB.',
        });
        return;
      }

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${mitarbeiterId}-${Date.now()}.${fileExt}`;
      const filePath = `mitarbeiter/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update mitarbeiter record
      const { error: updateError } = await supabase
        .from('mitarbeiter')
        .update({ avatar_url: publicUrl })
        .eq('id', mitarbeiterId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      onUploadComplete?.(publicUrl);

      toast({
        title: 'Erfolg',
        description: 'Profilbild wurde hochgeladen.',
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Hochladen',
        description: error.message || 'Bitte versuchen Sie es erneut.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setUploading(true);

      // Update mitarbeiter record to remove avatar
      const { error } = await supabase
        .from('mitarbeiter')
        .update({ avatar_url: null })
        .eq('id', mitarbeiterId);

      if (error) throw error;

      setAvatarUrl(null);
      onRemove?.();

      toast({
        title: 'Erfolg',
        description: 'Profilbild wurde entfernt.',
      });
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Bitte versuchen Sie es erneut.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative inline-block group">
      <Avatar 
        className={cn(sizeClasses[size], 'ring-2 ring-offset-2 ring-offset-background')}
        style={{ boxShadow: `0 0 0 2px ${color}` }}
      >
        <AvatarImage src={avatarUrl || undefined} alt={name} />
        <AvatarFallback
          className="text-white font-semibold"
          style={{ backgroundColor: color }}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : initials}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 bg-black/50 rounded-full" />
            <div className="relative flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white hover:text-white hover:bg-white/20"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-3 w-3" />
              </Button>
              {avatarUrl && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-white hover:text-white hover:bg-white/20"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
