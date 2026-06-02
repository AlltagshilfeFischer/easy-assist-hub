-- K5-Fix: check_ln_has_termine Trigger anlegen.
--
-- In entscheidungen.md und Code-Kommentaren als "vorhanden" dokumentiert,
-- wurde aber nie als Migration angelegt. Ohne diesen Trigger ist Frontend-Code
-- die einzige Schutzschicht gegen Phantom-LNs.
--
-- Blockiert jeden INSERT in leistungsnachweise wenn kein abrechenbarer Termin
-- für den Kunden im jeweiligen Monat existiert.

CREATE OR REPLACE FUNCTION public.check_ln_has_termine()
RETURNS TRIGGER AS $$
DECLARE
  v_start  TIMESTAMPTZ;
  v_end    TIMESTAMPTZ;
  v_count  INTEGER;
BEGIN
  -- Monatsgrenzen in Berliner Zeit berechnen
  v_start := timezone('Europe/Berlin',
               make_date(NEW.jahr, NEW.monat, 1)::TIMESTAMP);
  v_end   := v_start + INTERVAL '1 month';

  SELECT COUNT(*) INTO v_count
  FROM public.termine
  WHERE kunden_id = NEW.kunden_id
    AND start_at >= v_start
    AND start_at <  v_end
    AND status NOT IN ('abgesagt_rechtzeitig');

  IF v_count = 0 THEN
    RAISE EXCEPTION
      'Kein abrechenbarer Termin für Kunde % im Zeitraum %/%  — Leistungsnachweis nicht angelegt.',
      NEW.kunden_id, NEW.monat, NEW.jahr
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_ln_has_termine ON public.leistungsnachweise;

CREATE TRIGGER trg_check_ln_has_termine
  BEFORE INSERT ON public.leistungsnachweise
  FOR EACH ROW
  EXECUTE FUNCTION public.check_ln_has_termine();
