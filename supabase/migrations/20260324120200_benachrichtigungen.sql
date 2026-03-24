-- =====================================================
-- In-App Benachrichtigungen
-- =====================================================
-- Benachrichtigungen werden per DB-Trigger bei Termin-Events erstellt.
-- Optionale E-Mail via bestehende send-email Edge Function.

BEGIN;

-- 1. Benachrichtigungen-Tabelle
CREATE TABLE IF NOT EXISTS public.benachrichtigungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benutzer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  typ text NOT NULL DEFAULT 'info',  -- 'termin_neu', 'termin_geaendert', 'termin_abgesagt', 'ln_bereit', 'abwesenheit_status', 'info'
  titel text NOT NULL,
  nachricht text,
  gelesen boolean DEFAULT false NOT NULL,
  termin_id uuid REFERENCES public.termine(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Index fuer schnelle Abfrage
CREATE INDEX IF NOT EXISTS idx_benachrichtigungen_benutzer ON public.benachrichtigungen(benutzer_id, gelesen, created_at DESC);

-- 3. RLS
ALTER TABLE public.benachrichtigungen ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own notifications
CREATE POLICY "Users can read own benachrichtigungen"
  ON public.benachrichtigungen FOR SELECT
  USING (auth.uid() = benutzer_id);

CREATE POLICY "Users can update own benachrichtigungen"
  ON public.benachrichtigungen FOR UPDATE
  USING (auth.uid() = benutzer_id);

-- Admins can insert (for triggers/functions) and manage all
CREATE POLICY "System can insert benachrichtigungen"
  ON public.benachrichtigungen FOR INSERT
  WITH CHECK (true);  -- Trigger runs as SECURITY DEFINER

CREATE POLICY "Admins can manage benachrichtigungen"
  ON public.benachrichtigungen FOR ALL
  USING (public.is_admin_or_higher(auth.uid()));

-- 4. Trigger-Funktion: Benachrichtigungen bei Termin-Events
CREATE OR REPLACE FUNCTION public.notify_termin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_benutzer_id uuid;
  v_kunden_name text;
  v_ma_name text;
  v_start_text text;
BEGIN
  -- Nur wenn Mitarbeiter zugewiesen ist
  IF NEW.mitarbeiter_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Benutzer-ID des zugewiesenen Mitarbeiters
  SELECT m.benutzer_id, COALESCE(m.vorname || ' ' || m.nachname, 'Mitarbeiter')
  INTO v_benutzer_id, v_ma_name
  FROM public.mitarbeiter m
  WHERE m.id = NEW.mitarbeiter_id;

  IF v_benutzer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kundenname
  SELECT COALESCE(k.vorname || ' ' || k.nachname, 'Kunde')
  INTO v_kunden_name
  FROM public.kunden k
  WHERE k.id = NEW.kunden_id;

  v_start_text := to_char(NEW.start_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI');

  -- INSERT: Neuer Termin zugewiesen
  IF TG_OP = 'INSERT' AND NEW.mitarbeiter_id IS NOT NULL THEN
    INSERT INTO public.benachrichtigungen (benutzer_id, typ, titel, nachricht, termin_id)
    VALUES (
      v_benutzer_id,
      'termin_neu',
      'Neuer Termin zugewiesen',
      'Dir wurde ein Termin bei ' || COALESCE(v_kunden_name, 'einem Kunden') || ' am ' || v_start_text || ' zugewiesen.',
      NEW.id
    );
  END IF;

  -- UPDATE: Termin geaendert
  IF TG_OP = 'UPDATE' THEN
    -- Mitarbeiter gewechselt (neuer MA bekommt Benachrichtigung)
    IF OLD.mitarbeiter_id IS DISTINCT FROM NEW.mitarbeiter_id AND NEW.mitarbeiter_id IS NOT NULL THEN
      INSERT INTO public.benachrichtigungen (benutzer_id, typ, titel, nachricht, termin_id)
      VALUES (
        v_benutzer_id,
        'termin_neu',
        'Neuer Termin zugewiesen',
        'Dir wurde ein Termin bei ' || COALESCE(v_kunden_name, 'einem Kunden') || ' am ' || v_start_text || ' zugewiesen.',
        NEW.id
      );
    -- Zeit/Datum geaendert
    ELSIF OLD.start_at IS DISTINCT FROM NEW.start_at OR OLD.end_at IS DISTINCT FROM NEW.end_at THEN
      INSERT INTO public.benachrichtigungen (benutzer_id, typ, titel, nachricht, termin_id)
      VALUES (
        v_benutzer_id,
        'termin_geaendert',
        'Termin verschoben',
        'Dein Termin bei ' || COALESCE(v_kunden_name, 'einem Kunden') || ' wurde auf ' || v_start_text || ' verschoben.',
        NEW.id
      );
    -- Status auf abgesagt
    ELSIF NEW.status IN ('cancelled', 'abgesagt_rechtzeitig') AND OLD.status NOT IN ('cancelled', 'abgesagt_rechtzeitig') THEN
      INSERT INTO public.benachrichtigungen (benutzer_id, typ, titel, nachricht, termin_id)
      VALUES (
        v_benutzer_id,
        'termin_abgesagt',
        'Termin abgesagt',
        'Dein Termin bei ' || COALESCE(v_kunden_name, 'einem Kunden') || ' am ' || v_start_text || ' wurde abgesagt.',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Trigger auf termine
DROP TRIGGER IF EXISTS trg_notify_termin_change ON public.termine;
CREATE TRIGGER trg_notify_termin_change
  AFTER INSERT OR UPDATE ON public.termine
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_termin_change();

-- 6. E-Mail-Praeferenz pro Benutzer (optional)
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS email_benachrichtigungen boolean DEFAULT false;

COMMIT;
