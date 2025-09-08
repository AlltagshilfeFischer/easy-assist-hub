-- Add missing column for calendar color
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS farbe_kalender TEXT DEFAULT '#3B82F6';

-- Function to find free employees for a given time slot
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

-- Function to generate appointments from templates
CREATE OR REPLACE FUNCTION public.generate_termine_from_vorlagen(
  p_from DATE,
  p_to DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_rec RECORD;
  current_date DATE;
  appointment_start TIMESTAMP WITH TIME ZONE;
  appointment_end TIMESTAMP WITH TIME ZONE;
  created_count INTEGER := 0;
  interval_days INTEGER;
BEGIN
  -- Loop through active templates
  FOR template_rec IN 
    SELECT * FROM public.termin_vorlagen 
    WHERE ist_aktiv = true 
      AND gueltig_von <= p_to 
      AND (gueltig_bis IS NULL OR gueltig_bis >= p_from)
  LOOP
    -- Determine interval in days
    interval_days := CASE template_rec.intervall
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'monthly' THEN 30
      ELSE 7
    END;
    
    -- Generate appointments for the date range
    current_date := GREATEST(p_from, template_rec.gueltig_von);
    
    WHILE current_date <= LEAST(p_to, COALESCE(template_rec.gueltig_bis, p_to)) LOOP
      -- Check if this is the correct day of week
      IF EXTRACT(DOW FROM current_date)::SMALLINT = template_rec.wochentag THEN
        appointment_start := current_date + template_rec.start_zeit;
        appointment_end := appointment_start + (template_rec.dauer_minuten || ' minutes')::INTERVAL;
        
        -- Check if appointment doesn't already exist
        IF NOT EXISTS (
          SELECT 1 FROM public.termine t
          WHERE t.kunden_id = template_rec.kunden_id
            AND t.start_at = appointment_start
            AND t.end_at = appointment_end
        ) THEN
          -- Insert new appointment
          INSERT INTO public.termine (
            titel,
            kunden_id,
            mitarbeiter_id,
            start_at,
            end_at,
            status
          ) VALUES (
            template_rec.titel,
            template_rec.kunden_id,
            template_rec.mitarbeiter_id,
            appointment_start,
            appointment_end,
            CASE WHEN template_rec.mitarbeiter_id IS NULL THEN 'unassigned' ELSE 'scheduled' END
          );
          
          created_count := created_count + 1;
        END IF;
      END IF;
      
      current_date := current_date + interval_days;
    END LOOP;
  END LOOP;
  
  RETURN created_count;
END;
$$;

-- Function to approve appointment changes
CREATE OR REPLACE FUNCTION public.approve_termin_change(
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  change_rec RECORD;
  current_user_id UUID;
BEGIN
  -- Get current user from context
  BEGIN
    current_user_id := current_setting('app.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'User context not set';
  END;
  
  -- Get the change request
  SELECT * INTO change_rec FROM public.termin_aenderungen 
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;
  
  -- Apply the changes to the appointment
  UPDATE public.termine SET
    kunden_id = COALESCE(change_rec.new_kunden_id, kunden_id),
    mitarbeiter_id = COALESCE(change_rec.new_mitarbeiter_id, mitarbeiter_id),
    start_at = COALESCE(change_rec.new_start_at, start_at),
    end_at = COALESCE(change_rec.new_end_at, end_at)
  WHERE id = change_rec.termin_id;
  
  -- Mark the request as approved
  UPDATE public.termin_aenderungen SET
    status = 'approved',
    approved_at = now(),
    approver_id = current_user_id
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$;

-- Function to reject appointment changes
CREATE OR REPLACE FUNCTION public.reject_termin_change(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user from context
  BEGIN
    current_user_id := current_setting('app.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'User context not set';
  END;
  
  -- Mark the request as rejected
  UPDATE public.termin_aenderungen SET
    status = 'rejected',
    approved_at = now(),
    approver_id = current_user_id,
    reason = COALESCE(p_reason, reason)
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;
  
  RETURN TRUE;
END;
$$;