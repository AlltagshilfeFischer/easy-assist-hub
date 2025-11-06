import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIAppointmentCreatorProps {
  onAppointmentCreated?: () => void;
}

export function AIAppointmentCreator({ onAppointmentCreated }: AIAppointmentCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie eine Beschreibung ein.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://k01-2025-u36730.vm.elestio.app/webhook/020c0892-ebaf-4746-bfa1-3ead30e499c2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Webhook-Anfrage fehlgeschlagen');
      }

      const data = await response.json();
      
      toast({
        title: 'Erfolg',
        description: 'Termin wird erstellt...',
      });

      setPrompt('');
      
      // Notify parent to reload data
      if (onAppointmentCreated) {
        onAppointmentCreated();
      }
    } catch (error: any) {
      console.error('AI appointment creation error:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Termin konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="KI: Beschreiben Sie den Termin in natürlicher Sprache..."
            className="flex-1 h-8 text-sm"
            disabled={loading}
          />
          <Button 
            type="submit" 
            size="sm" 
            className="h-8"
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Erstellen...
              </>
            ) : (
              'Erstellen'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
