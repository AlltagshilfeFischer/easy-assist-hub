import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Globe, Settings, Image, Mic, Bot, User, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

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

  const hasMessages = messages.length > 0;

  return (
    <div className="relative mt-6">
      {/* Messages area - only show when there are messages */}
      {hasMessages && (
        <div className="mb-4 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">KI-Assistent</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setMessages([])}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Leeren
            </Button>
          </div>
          <ScrollArea className="h-[240px]" ref={scrollRef}>
            <div className="p-4 space-y-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 animate-fade-in",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 justify-start animate-fade-in">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Minimal floating input bar */}
      <form onSubmit={handleSubmit}>
        <div 
          className={cn(
            "relative flex flex-col",
            "bg-secondary/80 dark:bg-[hsl(220,13%,14%)]",
            "backdrop-blur-xl",
            "rounded-2xl",
            "border border-border/30",
            "shadow-lg shadow-foreground/5",
            "transition-all duration-300",
            isFocused && "shadow-xl shadow-primary/10 border-border/50"
          )}
        >
          {/* Text input area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={hasMessages ? "Nachricht schreiben..." : "Was willst du nun tun?"}
            rows={1}
            className={cn(
              "w-full px-5 pt-4 pb-2",
              "bg-transparent resize-none",
              "text-foreground placeholder:text-muted-foreground/60",
              "focus:outline-none",
              "text-[15px] leading-relaxed",
              "min-h-[48px] max-h-[120px]"
            )}
            style={{ 
              height: 'auto',
              overflow: 'hidden'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            {/* Left icons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-2 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                title="Datei anhängen"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                title="Web durchsuchen"
              >
                <Globe className="h-4 w-4" />
              </button>
              
              <div className="w-px h-4 bg-border/50 mx-1" />
              
              <button
                type="button"
                className="p-2 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                title="Einstellungen"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                title="Bild generieren"
              >
                <Image className="h-4 w-4" />
              </button>
            </div>

            {/* Right side - send/mic button */}
            <div className="flex items-center gap-2">
              {input.trim() ? (
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading}
                  className={cn(
                    "h-9 w-9 rounded-full",
                    "bg-primary hover:bg-primary-hover",
                    "shadow-md shadow-primary/20",
                    "transition-all duration-200",
                    "disabled:opacity-50"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center",
                    "h-9 w-9 rounded-full",
                    "bg-card dark:bg-[hsl(220,13%,20%)]",
                    "border border-border/50",
                    "text-muted-foreground hover:text-foreground",
                    "transition-all duration-200",
                    "hover:border-border"
                  )}
                  title="Spracheingabe"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subtle hint */}
        <p className="text-center text-xs text-muted-foreground/40 mt-3">
          Drücke <kbd className="px-1.5 py-0.5 rounded bg-muted/50 font-mono text-[10px]">↵</kbd> zum Senden
        </p>
      </form>
    </div>
  );
}
