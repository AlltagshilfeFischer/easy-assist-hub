-- FEHLENDE FUNKTIONEN HINZUFÜGEN

-- app_set_context function
CREATE OR REPLACE FUNCTION public.app_set_context(p_benutzer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.user_id', p_benutzer_id::text, true);
END;
$$;

-- app_clear_context function
CREATE OR REPLACE FUNCTION public.app_clear_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.user_id', '', true);
END;
$$;

-- approve_termin_change function
CREATE OR REPLACE FUNCTION public.approve_termin_change(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  change_rec RECORD;
  current_user_id UUID;
BEGIN
  BEGIN
    current_user_id := current_setting('app.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;

  IF current_user_id IS NULL THEN
    current_user_id := auth.uid();
  END IF;

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User context not set';
  END IF;
  
  SELECT * INTO change_rec FROM public.termin_aenderungen 
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;
  
  UPDATE public.termine SET
    kunden_id = COALESCE(change_rec.new_kunden_id, kunden_id),
    mitarbeiter_id = COALESCE(change_rec.new_mitarbeiter_id, mitarbeiter_id),
    start_at = COALESCE(change_rec.new_start_at, start_at),
    end_at = COALESCE(change_rec.new_end_at, end_at)
  WHERE id = change_rec.termin_id;
  
  UPDATE public.termin_aenderungen SET
    status = 'approved',
    approved_at = now(),
    approver_id = current_user_id
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$;

-- reject_termin_change function
CREATE OR REPLACE FUNCTION public.reject_termin_change(p_request_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  BEGIN
    current_user_id := current_setting('app.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;

  IF current_user_id IS NULL THEN
    current_user_id := auth.uid();
  END IF;

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User context not set';
  END IF;

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

-- get_unactivated_users function
CREATE OR REPLACE FUNCTION public.get_unactivated_users()
RETURNS TABLE(user_id uuid, user_email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::text as user_email,
    au.created_at
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.benutzer b WHERE b.id = au.id
  )
  ORDER BY au.created_at DESC;
END;
$$;

-- freischalte_mitarbeiter function
CREATE OR REPLACE FUNCTION public.freischalte_mitarbeiter(p_user_id uuid, p_email citext, p_vorname text DEFAULT NULL, p_nachname text DEFAULT NULL, p_geburtsdatum date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  INSERT INTO public.benutzer (id, email, rolle, vorname, nachname, geburtsdatum)
  VALUES (p_user_id, p_email, 'mitarbeiter', p_vorname, p_nachname, p_geburtsdatum)
  ON CONFLICT (id) DO UPDATE
  SET vorname = COALESCE(p_vorname, benutzer.vorname),
      nachname = COALESCE(p_nachname, benutzer.nachname),
      geburtsdatum = COALESCE(p_geburtsdatum, benutzer.geburtsdatum);
  
  INSERT INTO public.mitarbeiter (benutzer_id, vorname, nachname)
  VALUES (p_user_id, p_vorname, p_nachname)
  ON CONFLICT (benutzer_id) DO UPDATE
  SET vorname = COALESCE(p_vorname, mitarbeiter.vorname),
      nachname = COALESCE(p_nachname, mitarbeiter.nachname);
END;
$$;

-- generate_termine_from_vorlagen function
CREATE OR REPLACE FUNCTION public.generate_termine_from_vorlagen(p_from date, p_to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  template_rec RECORD;
  first_date DATE;
  last_date DATE;
  appointment_start TIMESTAMP WITH TIME ZONE;
  appointment_end TIMESTAMP WITH TIME ZONE;
  created_count INTEGER := 0;
  step_days INTEGER;
  offset_days INTEGER;
BEGIN
  FOR template_rec IN 
    SELECT * FROM public.termin_vorlagen 
    WHERE ist_aktiv = true 
      AND gueltig_von <= p_to 
      AND (gueltig_bis IS NULL OR gueltig_bis >= p_from)
  LOOP
    step_days := CASE template_rec.intervall
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'monthly' THEN 30
      ELSE 7
    END;

    first_date := GREATEST(p_from, template_rec.gueltig_von);
    last_date := LEAST(p_to, COALESCE(template_rec.gueltig_bis, p_to));

    offset_days := (template_rec.wochentag - EXTRACT(DOW FROM first_date)::INT + 7) % 7;
    IF offset_days > 0 THEN
      first_date := first_date + offset_days;
    END IF;

    WHILE first_date <= last_date LOOP
      appointment_start := (first_date::timestamp + template_rec.start_zeit);
      appointment_end := appointment_start + (template_rec.dauer_minuten || ' minutes')::INTERVAL;

      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.termine t
          WHERE t.kunden_id = template_rec.kunden_id
            AND t.start_at = appointment_start
            AND t.end_at = appointment_end
        ) THEN
          INSERT INTO public.termine (
            titel, kunden_id, mitarbeiter_id, start_at, end_at, status, vorlage_id
          ) VALUES (
            template_rec.titel,
            template_rec.kunden_id,
            template_rec.mitarbeiter_id,
            appointment_start,
            appointment_end,
            CASE WHEN template_rec.mitarbeiter_id IS NULL THEN 'unassigned' ELSE 'scheduled' END,
            template_rec.id
          );
          created_count := created_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      first_date := first_date + step_days;
    END LOOP;
  END LOOP;
  RETURN created_count;
END;
$$;

-- find_free_mitarbeiter function
CREATE OR REPLACE FUNCTION public.find_free_mitarbeiter(p_start timestamptz, p_end timestamptz, p_kunden_id uuid DEFAULT NULL)
RETURNS TABLE(mitarbeiter_id uuid, vorname text, nachname text, email citext, farbe_kalender text)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- request_termin_change function
CREATE OR REPLACE FUNCTION public.request_termin_change(
  p_termin_id uuid,
  p_new_start timestamptz DEFAULT NULL,
  p_new_end timestamptz DEFAULT NULL,
  p_new_kunde uuid DEFAULT NULL,
  p_new_mitarbeiter uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_termin RECORD;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_termin FROM public.termine WHERE id = p_termin_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termin nicht gefunden';
  END IF;

  INSERT INTO public.termin_aenderungen (
    termin_id, requested_by, 
    old_start_at, old_end_at, old_kunden_id, old_mitarbeiter_id,
    new_start_at, new_end_at, new_kunden_id, new_mitarbeiter_id,
    reason
  ) VALUES (
    p_termin_id, auth.uid(),
    v_termin.start_at, v_termin.end_at, v_termin.kunden_id, v_termin.mitarbeiter_id,
    p_new_start, p_new_end, p_new_kunde, p_new_mitarbeiter,
    p_reason
  ) RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

-- is_employee_for_appointment function
CREATE OR REPLACE FUNCTION public.is_employee_for_appointment(p_termin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.mitarbeiter m 
    JOIN public.termine t ON t.mitarbeiter_id = m.id
    WHERE m.benutzer_id = auth.uid() 
    AND t.id = p_termin_id
  );
END;
$$;