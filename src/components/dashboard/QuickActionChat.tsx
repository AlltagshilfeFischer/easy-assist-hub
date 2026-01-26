import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Calendar, Users, FileText, Clock, ArrowRight, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const quickActions = [
  { icon: Calendar, label: 'Neuen Termin erstellen', action: 'Erstelle einen neuen Termin für', gradient: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-500' },
  { icon: Users, label: 'Mitarbeiter zuweisen', action: 'Weise einen Mitarbeiter zu für', gradient: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-500' },
  { icon: FileText, label: 'Bericht generieren', action: 'Erstelle einen Bericht über', gradient: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-500' },
  { icon: Clock, label: 'Stunden prüfen', action: 'Zeige mir die Stundenübersicht für', gradient: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-500' },
];

export default function QuickActionChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit erreicht. Bitte versuche es später erneut.');
          return;
        }
        if (response.status === 402) {
          toast.error('Zahlungserforderlich. Bitte Guthaben aufladen.');
          return;
        }
        throw new Error('Failed to start stream');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Fehler bei der Kommunikation mit dem Assistenten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    streamChat(userMessage);
  };

  const handleQuickAction = (action: string) => {
    setInput(action + ' ');
    textareaRef.current?.focus();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="relative mt-2">
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-card via-card to-muted/50",
        "border border-border/50 shadow-xl shadow-primary/5",
        "transition-all duration-500",
        isFocused && "shadow-2xl shadow-primary/10 border-primary/20"
      )}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/30 via-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-primary/20 via-transparent to-transparent rounded-full blur-2xl" />
        </div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }} />

        <div className="relative p-6 sm:p-8 space-y-6">
          {/* Header with sparkle icon */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {hasMessages ? 'KI-Assistent' : 'Was willst du nun tun?'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {hasMessages 
                  ? 'Ich helfe dir bei deinen Aufgaben' 
                  : 'Beschreibe deine Aufgabe in natürlicher Sprache — ich helfe dir dabei'}
              </p>
            </div>
          </div>

          {/* Messages area */}
          {hasMessages && (
            <ScrollArea className="h-[280px] pr-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted/80 text-foreground rounded-bl-md'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3 justify-start animate-fade-in">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Quick action cards - only show when no messages */}
          {!hasMessages && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.action)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4",
                    "bg-gradient-to-br",
                    action.gradient,
                    "border border-border/50",
                    "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                    "transition-all duration-300 hover:scale-[1.02]",
                    "text-left"
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    "bg-background/80 backdrop-blur-sm",
                    "mb-3 transition-transform duration-300 group-hover:scale-110"
                  )}>
                    <action.icon className={cn("h-4.5 w-4.5", action.iconColor)} />
                  </div>
                  <span className="text-sm font-medium text-foreground block leading-snug">
                    {action.label}
                  </span>
                  <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <form onSubmit={handleSubmit}>
            <div className={cn(
              "relative rounded-xl overflow-hidden",
              "bg-background/60 backdrop-blur-sm",
              "border-2 transition-all duration-300",
              isFocused 
                ? "border-primary/40 shadow-lg shadow-primary/10" 
                : "border-border/50"
            )}>
              {isFocused && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
              )}
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={hasMessages 
                  ? "Schreibe eine Nachricht..." 
                  : "z.B. 'Erstelle einen wöchentlichen Termin für Frau Müller jeden Dienstag um 10 Uhr'"}
                className={cn(
                  "relative w-full min-h-[80px] p-4 pr-14",
                  "bg-transparent resize-none",
                  "text-foreground placeholder:text-muted-foreground/50",
                  "focus:outline-none",
                  "text-sm leading-relaxed"
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              
              <div className="absolute bottom-3 right-3">
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "h-10 w-10 rounded-xl",
                    "bg-gradient-to-br from-primary to-primary/90",
                    "hover:from-primary/90 hover:to-primary/80",
                    "shadow-lg shadow-primary/25",
                    "disabled:opacity-40 disabled:shadow-none",
                    "transition-all duration-300",
                    input.trim() && !isLoading && "hover:scale-105"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 rounded-md bg-muted/50 border border-border/50 font-mono text-[10px] font-medium">↵</kbd>
                <span>Senden</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 rounded-md bg-muted/50 border border-border/50 font-mono text-[10px] font-medium">⇧ ↵</kbd>
                <span>Neue Zeile</span>
              </span>
              {hasMessages && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground/60 hover:text-foreground"
                  onClick={() => setMessages([])}
                >
                  Chat leeren
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
