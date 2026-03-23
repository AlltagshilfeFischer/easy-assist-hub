-- VP (Verhinderungspflege) jaehrliche Neubeantragung
-- Setzt am 01.01. jeden Jahres den VP-Status zurueck und erneuert das Budget

-- pg_cron aktivieren (Supabase unterstuetzt dies nativ)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Berechtigung fuer pg_cron auf public-Tabellen
GRANT USAGE ON SCHEMA cron TO postgres;

-- PG-Funktion: VP-Status zuruecksetzen
CREATE OR REPLACE FUNCTION public.vp_yearly_renewal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
  affected_ids uuid[];
  result jsonb;
BEGIN
  -- Alle aktiven Kunden mit aktiver VP sammeln
  SELECT array_agg(id)
  INTO affected_ids
  FROM public.kunden
  WHERE verhinderungspflege_aktiv = true
    AND aktiv = true;

  -- Nichts zu tun
  IF affected_ids IS NULL OR array_length(affected_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'renewed', 0,
      'year', extract(year FROM now()),
      'message', 'Keine Kunden mit aktiver VP gefunden'
    );
  END IF;

  -- VP-Status zuruecksetzen + Budget erneuern
  UPDATE public.kunden
  SET
    verhinderungspflege_beantragt = false,
    verhinderungspflege_genehmigt = false,
    verhinderungspflege_genehmigt_am = NULL,
    verhinderungspflege_budget = 3539,
    updated_at = now()
  WHERE id = ANY(affected_ids);

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- Audit-Log
  INSERT INTO public.audit_log (operation, table_name, new_data)
  VALUES (
    'VP_YEARLY_RENEWAL',
    'kunden',
    jsonb_build_object(
      'year', extract(year FROM now()),
      'affected_customers', affected_count,
      'customer_ids', to_jsonb(affected_ids),
      'action', 'VP-Status zurueckgesetzt, Budget auf 3.539 EUR erneuert'
    )
  );

  result := jsonb_build_object(
    'renewed', affected_count,
    'year', extract(year FROM now()),
    'message', format('VP-Neubeantragung fuer %s Kunden zurueckgesetzt', affected_count)
  );

  RAISE LOG 'VP Yearly Renewal: %', result;
  RETURN result;
END;
$$;

-- Cron-Job: Jeden 01.01. um 00:05 Uhr ausfuehren
SELECT cron.schedule(
  'vp-yearly-renewal',
  '5 0 1 1 *',
  $$SELECT public.vp_yearly_renewal()$$
);

COMMENT ON FUNCTION public.vp_yearly_renewal() IS
  'Jaehrlicher Reset der VP-Neubeantragung (§39 SGB XI). Setzt beantragt/genehmigt zurueck und erneuert Budget auf 3.539 EUR.';
