---
name: feature
description: Neue Funktion oder Seite im Alltagshilfe Fischer System entwickeln. Checkliste und Konventionen für die Feature-Entwicklung.
disable-model-invocation: true
argument-hint: "[Feature-Beschreibung]"
---

# Feature entwickeln – $ARGUMENTS

## Checkliste

### 1. Planung
- [ ] Betroffene Tabellen/Spalten aus DB-Schema identifizieren (`/db-schema`)
- [ ] Bestehende Hooks in `src/hooks/` prüfen – wiederverwenden statt neu schreiben
- [ ] Rolle/Berechtigung klären: Wer darf das Feature nutzen? (`useUserRole`)

### 2. Datenbankschicht (falls nötig)
- [ ] Neue Tabelle/Spalte → Migration erstellen: `supabase migration new <name>`
- [ ] Typen regenerieren: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
- [ ] RLS-Policy für neue Tabellen definieren

### 3. Hook / Business Logik
```typescript
// Muster: src/hooks/useFeatureName.ts
export function useFeatureName() {
  // Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tabelle').select('*');
      if (error) throw error;
      return data;
    },
  });

  // Mutation
  const { mutate } = useMutation({
    mutationFn: async (input: FeatureInsert) => {
      const { data, error } = await supabase.from('tabelle').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature'] });
      toast.success('Gespeichert');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Fehler beim Speichern');
    },
  });

  return { data, isLoading, mutate };
}
```

### 4. Komponente
- [ ] Max. ~150 Zeilen pro Datei – sonst aufteilen
- [ ] Nur shadcn/ui Komponenten (`src/components/ui/`)
- [ ] Icons: nur `lucide-react`
- [ ] Kein `style={{}}` – nur Tailwind
- [ ] Kein `any` – Typen aus `types.ts` oder `domain.ts`
- [ ] Toast: `import { toast } from 'sonner'`

### 5. Rollen-Schutz
```typescript
import { useUserRole } from '@/hooks/useUserRole';

const { isAdmin, isGeschaeftsfuehrer } = useUserRole();
if (!isAdmin) return <AccessDenied />;
```

### 6. Formular (falls nötig)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Pflichtfeld'),
});

const form = useForm({ resolver: zodResolver(schema) });
```

### 7. Qualitätsprüfung
- [ ] `npm run lint` – keine ESLint-Fehler
- [ ] `npx tsc --noEmit` – keine TypeScript-Fehler
- [ ] Manuelle Prüfung im Browser (Port 8080)
- [ ] Alle Rollen testen (admin, mitarbeiter)

## Projektstruktur

```
Neue Seite:       src/pages/controlboard/MeineSeite.tsx
Neue Komponente:  src/components/bereich/MeineKomponente.tsx
Neuer Hook:       src/hooks/useMeinHook.ts
Edge Function:    supabase/functions/meine-funktion/index.ts
```

## Edge Function (Deno/TypeScript)

```typescript
// supabase/functions/meine-funktion/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { input } = await req.json()
    // Validierung zuerst
    if (!input) return new Response(JSON.stringify({ error: 'input required' }), { status: 400, headers: corsHeaders })

    // Verarbeitung ...

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: corsHeaders
    })
  }
})
```
