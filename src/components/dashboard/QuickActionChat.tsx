import { useState } from 'react';
import { Send, Sparkles, Calendar, Users, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const quickActions = [
  { icon: Calendar, label: 'Neuen Termin erstellen', action: 'Erstelle einen neuen Termin für' },
  { icon: Users, label: 'Mitarbeiter zuweisen', action: 'Weise einen Mitarbeiter zu für' },
  { icon: FileText, label: 'Bericht generieren', action: 'Erstelle einen Bericht über' },
  { icon: Clock, label: 'Stunden prüfen', action: 'Zeige mir die Stundenübersicht für' },
];

export default function QuickActionChat() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // For now, just clear the input - AI integration can be added later
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setInput('');
    }, 500);
  };

  const handleQuickAction = (action: string) => {
    setInput(action + ' ');
  };

  return (
    <Card className="relative overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-background via-background to-muted/30">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
      
      <div className="relative p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Was willst du nun tun?</h3>
            <p className="text-sm text-muted-foreground">Beschreibe deine Aufgabe oder wähle eine Schnellaktion</p>
          </div>
        </div>

        {/* Quick action chips */}
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full border-muted-foreground/20 bg-background/50 text-xs font-medium hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
              onClick={() => handleQuickAction(action.action)}
            >
              <action.icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="z.B. 'Erstelle einen wöchentlichen Termin für Frau Müller jeden Dienstag um 10 Uhr'"
              className={cn(
                "min-h-[80px] resize-none rounded-xl border-muted-foreground/20 bg-background/80 pr-12",
                "placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20",
                "transition-all duration-200"
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className={cn(
                "absolute bottom-3 right-3 h-8 w-8 rounded-lg",
                "bg-primary hover:bg-primary/90 disabled:opacity-50",
                "transition-all duration-200"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground/60 text-center">
            Drücke <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Enter</kbd> zum Senden oder <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Shift + Enter</kbd> für neue Zeile
          </p>
        </form>
      </div>
    </Card>
  );
}
