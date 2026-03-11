---
name: mitarbeiter-anlegen
description: Neuen Mitarbeiter im Alltagshilfe Fischer System anlegen. Verwenden wenn ein Mitarbeiter, Pflegehelfer oder Betreuer erfasst werden soll – mit oder ohne Benutzer-Account.
disable-model-invocation: true
argument-hint: "[Name] [Standort] [Stunden/Woche]"
---

# Neuen Mitarbeiter anlegen – $ARGUMENTS

## Zwei Varianten

| Variante | Beschreibung |
|----------|-------------|
| Ohne Account | Nur `mitarbeiter`-Eintrag (kein Login möglich) |
| Mit Account | `mitarbeiter` + `benutzer` verknüpft → Login via Email |

## Pflichtfelder (`mitarbeiter`)

```typescript
import { Database } from '@/integrations/supabase/types';
type MitarbeiterInsert = Database['public']['Tables']['mitarbeiter']['Insert'];

const neuerMitarbeiter: MitarbeiterInsert = {
  vorname: string,
  nachname: string,
  standort: 'Hannover' | 'Hildesheim' | 'Peine',  // DEFAULT 'Hannover'
  ist_aktiv: true,

  // Optional aber empfohlen:
  telefon?: string,
  strasse?: string,
  plz?: string,
  stadt?: string,
  soll_wochenstunden?: number,        // z.B. 20, 35, 40
  max_termine_pro_tag?: number,       // z.B. 5
  farbe_kalender?: string,            // DEFAULT '#3B82F6'
  benutzer_id?: string,               // UUID – nur wenn Account existiert
};
```

## Mutation (React Query)

```typescript
const { mutate: createMitarbeiter } = useMutation({
  mutationFn: async (data: MitarbeiterInsert) => {
    const { data: mitarbeiter, error } = await supabase
      .from('mitarbeiter')
      .insert({ ...data, ist_aktiv: true })
      .select()
      .single();
    if (error) throw error;
    return mitarbeiter;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['mitarbeiter'] });
    toast.success('Mitarbeiter wurde angelegt');
  },
  onError: (error) => {
    console.error('Fehler beim Anlegen:', error);
    toast.error('Fehler beim Anlegen des Mitarbeiters');
  },
});
```

## Mit Benutzer-Account verknüpfen

```typescript
// 1. Mitarbeiter anlegen (ohne benutzer_id)
const { data: mitarbeiter } = await supabase
  .from('mitarbeiter')
  .insert({ vorname, nachname, standort, ist_aktiv: true })
  .select().single();

// 2. Benutzer einladen (Supabase Auth)
const { data: user } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { rolle: 'mitarbeiter' }
});

// 3. benutzer-Eintrag erstellen und verknüpfen
await supabase.from('benutzer').insert({
  id: user.user.id,
  email,
  vorname,
  nachname,
  rolle: 'mitarbeiter',
  status: 'approved',
});

// 4. mitarbeiter.benutzer_id setzen
await supabase.from('mitarbeiter')
  .update({ benutzer_id: user.user.id })
  .eq('id', mitarbeiter.id);
```

## Verfügbarkeit erfassen (nach Anlage)

```typescript
// Reguläre Arbeitszeiten setzen
await supabase.from('mitarbeiter_verfuegbarkeit').insert([
  { mitarbeiter_id: mitarbeiter.id, wochentag: 1, von: '08:00', bis: '16:00' }, // Mo
  { mitarbeiter_id: mitarbeiter.id, wochentag: 2, von: '08:00', bis: '16:00' }, // Di
  // ... weitere Wochentage
]);
```

## Abwesenheit eintragen

```typescript
// Zeitraum als TSTZRANGE
await supabase.from('mitarbeiter_abwesenheiten').insert({
  mitarbeiter_id: mitarbeiter.id,
  zeitraum: `[${startISO}, ${endISO})`,  // PostgreSQL Range-Syntax
  grund: 'Urlaub',                        // oder 'Krank', 'Fortbildung'
});
```

## Smart Import (Bulk)

Für mehrere Mitarbeiter: `MitarbeiterSmartImport` → `SmartDataImport`
Edge Function: `parse-mitarbeiter-text` für KI-Import aus Freitext.

## Typen

```typescript
type MitarbeiterRow    = Database['public']['Tables']['mitarbeiter']['Row'];
type MitarbeiterInsert = Database['public']['Tables']['mitarbeiter']['Insert'];
type MitarbeiterUpdate = Database['public']['Tables']['mitarbeiter']['Update'];
```
