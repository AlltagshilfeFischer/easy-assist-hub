-- Neue Spalte: requires_approval für termin_aenderungen
ALTER TABLE public.termin_aenderungen
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true;

-- Bestehende auto-approved Einträge (status=approved ohne approver = MA-Selbst-Bestätigung) haben false
UPDATE public.termin_aenderungen
  SET requires_approval = false
  WHERE status = 'approved';

-- ───────────────────────────────────────────────────────────
-- apply_termin_change:
--   Verschiebt den Termin SOFORT und protokolliert die Änderung.
--   Bei kleiner Änderung (<120 min, selber Tag) oder GF → auto-approved.
--   Bei großer Änderung durch MA → pending (GF muss bestätigen).
--   Bestehender pending request desselben Termins wird berücksichtigt:
--   - Wenn neue Zeit ≈ Original (< threshold): pending storniert, keine neue Anfrage
--   - Wenn neue Zeit immer noch groß: pending request aktualisiert
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_termin_change(
  p_termin_id       uuid,
  p_new_start       timestamptz,
  p_new_end         timestamptz,
  p_reason          text,
  p_is_gf           boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_termin              RECORD;
  v_existing_pending    RECORD;
  v_requires_approval   boolean;
  v_diff_minutes        float;
  v_same_day            boolean;
  v_request_id          uuid;
  v_orig_diff           float;
  v_orig_same_day       boolean;
  v_benutzer_id         uuid;
BEGIN
  v_benutzer_id := auth.uid();
  IF v_benutzer_id IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;

  -- Aktuellen Termin laden
  SELECT * INTO v_termin FROM public.termine WHERE id = p_termin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termin nicht gefunden';
  END IF;

  -- Zeitdiff berechnen (in Minuten, absolut)
  v_diff_minutes := ABS(EXTRACT(EPOCH FROM (p_new_start - v_termin.start_at)) / 60.0);
  v_same_day := (p_new_start AT TIME ZONE 'Europe/Berlin')::date
                = (v_termin.start_at AT TIME ZONE 'Europe/Berlin')::date;

  -- Schwellwert: ≥ 120 min ODER anderer Tag → große Änderung
  -- GF darf immer ohne Genehmigung
  v_requires_approval := (NOT p_is_gf)
    AND (v_diff_minutes >= 120.0 OR NOT v_same_day);

  -- Prüfe auf bestehenden pending request für diesen Termin
  SELECT * INTO v_existing_pending
    FROM public.termin_aenderungen
    WHERE termin_id = p_termin_id AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;

  IF FOUND THEN
    -- Vergleiche neue Zeit mit dem ORIGINALEN Zeitpunkt des pending requests
    v_orig_diff := ABS(EXTRACT(EPOCH FROM (p_new_start - v_existing_pending.old_start_at)) / 60.0);
    v_orig_same_day := (p_new_start AT TIME ZONE 'Europe/Berlin')::date
                       = (v_existing_pending.old_start_at AT TIME ZONE 'Europe/Berlin')::date;

    IF v_orig_diff < 120.0 AND v_orig_same_day THEN
      -- MA hat zurück verschoben (quasi zur Originalzeit) → pending stornieren
      DELETE FROM public.termin_aenderungen WHERE id = v_existing_pending.id;
      -- Keine neue Anfrage nötig
      v_requires_approval := false;
      -- v_request_id bleibt NULL → kein neuer Eintrag
    ELSE
      -- Immer noch große Abweichung → bestehenden pending request aktualisieren
      UPDATE public.termin_aenderungen SET
        new_start_at = p_new_start,
        new_end_at   = p_new_end,
        reason       = p_reason,
        updated_at   = now()
      WHERE id = v_existing_pending.id;
      v_request_id := v_existing_pending.id;
    END IF;
  END IF;

  -- Termin sofort in DB verschieben
  UPDATE public.termine SET
    start_at = p_new_start,
    end_at   = p_new_end
  WHERE id = p_termin_id;

  -- Neuen termin_aenderungen Eintrag erstellen (falls nötig)
  IF v_request_id IS NULL THEN
    IF v_requires_approval THEN
      -- Große MA-Änderung: pending
      INSERT INTO public.termin_aenderungen (
        termin_id, requested_by,
        old_start_at, old_end_at, old_kunden_id, old_mitarbeiter_id,
        new_start_at, new_end_at,
        reason, status, requires_approval
      ) VALUES (
        p_termin_id, v_benutzer_id,
        v_termin.start_at, v_termin.end_at, v_termin.kunden_id, v_termin.mitarbeiter_id,
        p_new_start, p_new_end,
        p_reason, 'pending', true
      ) RETURNING id INTO v_request_id;
    ELSE
      -- Kleine Änderung oder GF: sofort approved (nur zur Dokumentation)
      INSERT INTO public.termin_aenderungen (
        termin_id, requested_by,
        old_start_at, old_end_at, old_kunden_id, old_mitarbeiter_id,
        new_start_at, new_end_at,
        reason, status, requires_approval, approved_at
      ) VALUES (
        p_termin_id, v_benutzer_id,
        v_termin.start_at, v_termin.end_at, v_termin.kunden_id, v_termin.mitarbeiter_id,
        p_new_start, p_new_end,
        p_reason, 'approved', false, now()
      ) RETURNING id INTO v_request_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'request_id',        v_request_id,
    'requires_approval', v_requires_approval
  );
END;
$$;

-- ───────────────────────────────────────────────────────────
-- approve_termin_change:
--   Termin ist bereits verschoben → nur Status updaten.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_termin_change(p_request_id uuid)
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
    status      = 'approved',
    approved_at = now(),
    approver_id = current_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;

  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────
-- reject_termin_change:
--   Termin ZURÜCKSETZEN auf alte Zeiten + Status rejected.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_termin_change(p_request_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  change_rec      RECORD;
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

  SELECT * INTO change_rec
    FROM public.termin_aenderungen
    WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;

  -- Termin auf Originalzeiten zurücksetzen
  UPDATE public.termine SET
    start_at = change_rec.old_start_at,
    end_at   = change_rec.old_end_at
  WHERE id = change_rec.termin_id;

  UPDATE public.termin_aenderungen SET
    status      = 'rejected',
    approved_at = now(),
    approver_id = current_user_id,
    reason      = COALESCE(p_reason, reason)
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

-- Berechtigung: MA darf apply_termin_change aufrufen (nur für eigene Termine via RLS)
GRANT EXECUTE ON FUNCTION public.apply_termin_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_termin_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_termin_change TO authenticated;
