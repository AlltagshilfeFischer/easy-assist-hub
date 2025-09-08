-- Add missing column for calendar color
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS farbe_kalender TEXT DEFAULT '#3B82F6';

-- Drop and recreate function to find free employees
DROP FUNCTION IF EXISTS public.find_free_mitarbeiter(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID);

CREATE OR REPLACE FUNCTION public.find_free_mitarbeiter(
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE,
  p_kunden_id UUID DEFAULT NULL
)
RETURNS TABLE (
  mitarbeiter_id UUID,
  vorname TEXT,
  nachname TEXT,
  email CITEXT,
  farbe_kalender TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    m.vorname,
    m.nachname,
    m.email,
    m.farbe_kalender
  FROM public.mitarbeiter m
  WHERE m.ist_aktiv = true
    -- Check availability for the day of week
    AND EXISTS (
      SELECT 1 FROM public.mitarbeiter_verfuegbarkeit mv
      WHERE mv.mitarbeiter_id = m.id
        AND mv.wochentag = EXTRACT(DOW FROM p_start)::SMALLINT
        AND mv.von <= p_start::TIME
        AND mv.bis >= p_end::TIME
    )
    -- Check no absence during this period
    AND NOT EXISTS (
      SELECT 1 FROM public.mitarbeiter_abwesenheiten ma
      WHERE ma.mitarbeiter_id = m.id
        AND ma.zeitraum && tstzrange(p_start, p_end, '[)')
    )
    -- Check no conflicting appointments
    AND NOT EXISTS (
      SELECT 1 FROM public.termine t
      WHERE t.mitarbeiter_id = m.id
        AND t.status IN ('scheduled', 'confirmed')
        AND tstzrange(t.start_at, t.end_at, '[)') && tstzrange(p_start, p_end, '[)')
    )
    -- Check daily appointment limit if set
    AND (
      m.max_termine_pro_tag IS NULL 
      OR (
        SELECT COUNT(*) FROM public.termine t
        WHERE t.mitarbeiter_id = m.id
          AND t.status IN ('scheduled', 'confirmed')
          AND DATE(t.start_at) = DATE(p_start)
      ) < m.max_termine_pro_tag
    );
END;
$$;