-- Fix find_free_mitarbeiter search_path
CREATE OR REPLACE FUNCTION public.find_free_mitarbeiter(p_start timestamptz, p_end timestamptz, p_kunden_id uuid DEFAULT NULL)
RETURNS TABLE(mitarbeiter_id uuid, vorname text, nachname text, email citext, farbe_kalender text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    m.vorname,
    m.nachname,
    b.email,
    m.farbe_kalender
  FROM public.mitarbeiter m
  LEFT JOIN public.benutzer b ON b.id = m.benutzer_id
  WHERE m.ist_aktiv = true
    AND EXISTS (
      SELECT 1 FROM public.mitarbeiter_verfuegbarkeit mv
      WHERE mv.mitarbeiter_id = m.id
        AND mv.wochentag = EXTRACT(DOW FROM p_start)::SMALLINT
        AND mv.von <= p_start::TIME
        AND mv.bis >= p_end::TIME
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.mitarbeiter_abwesenheiten ma
      WHERE ma.mitarbeiter_id = m.id
        AND ma.zeitraum && tstzrange(p_start, p_end, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.termine t
      WHERE t.mitarbeiter_id = m.id
        AND t.status IN ('scheduled', 'in_progress')
        AND tstzrange(t.start_at, t.end_at, '[)') && tstzrange(p_start, p_end, '[)')
    )
    AND (
      m.max_termine_pro_tag IS NULL 
      OR (
        SELECT COUNT(*) FROM public.termine t
        WHERE t.mitarbeiter_id = m.id
          AND t.status IN ('scheduled', 'in_progress')
          AND DATE(t.start_at) = DATE(p_start)
      ) < m.max_termine_pro_tag
    );
END;
$$;