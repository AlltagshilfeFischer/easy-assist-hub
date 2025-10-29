-- Improve robustness: skip invalid occurrences instead of aborting the whole run
CREATE OR REPLACE FUNCTION public.generate_termine_from_vorlagen(p_from date, p_to date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Loop through active templates within range
  FOR template_rec IN 
    SELECT * FROM public.termin_vorlagen 
    WHERE ist_aktiv = true 
      AND gueltig_von <= p_to 
      AND (gueltig_bis IS NULL OR gueltig_bis >= p_from)
  LOOP
    -- Determine step in days
    step_days := CASE template_rec.intervall
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'monthly' THEN 30
      ELSE 7
    END;

    -- Calculate bounds
    first_date := GREATEST(p_from, template_rec.gueltig_von);
    last_date := LEAST(p_to, COALESCE(template_rec.gueltig_bis, p_to));

    -- Align first_date to the next matching weekday (0=Sun..6=Sat)
    offset_days := (template_rec.wochentag - EXTRACT(DOW FROM first_date)::INT + 7) % 7;
    IF offset_days > 0 THEN
      first_date := first_date + offset_days;
    END IF;

    -- Iterate and create appointments
    WHILE first_date <= last_date LOOP
      appointment_start := (first_date::timestamp + template_rec.start_zeit);
      appointment_end := appointment_start + (template_rec.dauer_minuten || ' minutes')::INTERVAL;

      -- Only insert if not existing already
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.termine t
          WHERE t.kunden_id = template_rec.kunden_id
            AND t.start_at = appointment_start
            AND t.end_at = appointment_end
        ) THEN
          INSERT INTO public.termine (
            titel,
            kunden_id,
            mitarbeiter_id,
            start_at,
            end_at,
            status,
            vorlage_id
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
        -- Skip problematic occurrence (e.g., violates availability/limits)
        -- Optionally: RAISE NOTICE 'Skipping occurrence for template % on %: %', template_rec.id, first_date, SQLERRM;
        NULL;
      END;

      -- Move to next occurrence based on interval
      first_date := first_date + step_days;
    END LOOP;
  END LOOP;
  RETURN created_count;
END;
$function$;