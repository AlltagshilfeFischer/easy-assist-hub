-- Wenn ein Termin geändert wird (INSERT/UPDATE/DELETE) und der zugehörige
-- Leistungsnachweis den Status 'abgeschlossen' hat, wird der Status automatisch
-- auf 'unterschrieben' zurückgesetzt. Unterschriften bleiben erhalten.
--
-- Beziehung: leistungsnachweise (kunden_id, monat, jahr)
--            ↔ termine (kunden_id, EXTRACT(MONTH/YEAR FROM start_at))

CREATE OR REPLACE FUNCTION public.reopen_abgeschlossen_ln_on_termin_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Bei DELETE: anhand OLD-Werte prüfen
  IF TG_OP = 'DELETE' THEN
    IF OLD.kunden_id IS NOT NULL THEN
      UPDATE public.leistungsnachweise
        SET status = 'unterschrieben'
      WHERE kunden_id = OLD.kunden_id
        AND monat     = EXTRACT(MONTH FROM OLD.start_at)::INTEGER
        AND jahr      = EXTRACT(YEAR  FROM OLD.start_at)::INTEGER
        AND status    = 'abgeschlossen';
    END IF;
    RETURN OLD;
  END IF;

  -- Bei INSERT: anhand NEW-Werte prüfen
  IF TG_OP = 'INSERT' THEN
    IF NEW.kunden_id IS NOT NULL THEN
      UPDATE public.leistungsnachweise
        SET status = 'unterschrieben'
      WHERE kunden_id = NEW.kunden_id
        AND monat     = EXTRACT(MONTH FROM NEW.start_at)::INTEGER
        AND jahr      = EXTRACT(YEAR  FROM NEW.start_at)::INTEGER
        AND status    = 'abgeschlossen';
    END IF;
    RETURN NEW;
  END IF;

  -- Bei UPDATE: OLD-LN und NEW-LN abdecken (start_at-Monatswechsel möglich)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.kunden_id IS NOT NULL THEN
      UPDATE public.leistungsnachweise
        SET status = 'unterschrieben'
      WHERE kunden_id = OLD.kunden_id
        AND monat     = EXTRACT(MONTH FROM OLD.start_at)::INTEGER
        AND jahr      = EXTRACT(YEAR  FROM OLD.start_at)::INTEGER
        AND status    = 'abgeschlossen';
    END IF;

    -- Nur nochmal updaten wenn NEW auf einen anderen Monat/Jahr oder Kunden zeigt
    IF NEW.kunden_id IS NOT NULL
       AND (
         NEW.kunden_id != OLD.kunden_id
         OR EXTRACT(MONTH FROM NEW.start_at) != EXTRACT(MONTH FROM OLD.start_at)
         OR EXTRACT(YEAR  FROM NEW.start_at) != EXTRACT(YEAR  FROM OLD.start_at)
       )
    THEN
      UPDATE public.leistungsnachweise
        SET status = 'unterschrieben'
      WHERE kunden_id = NEW.kunden_id
        AND monat     = EXTRACT(MONTH FROM NEW.start_at)::INTEGER
        AND jahr      = EXTRACT(YEAR  FROM NEW.start_at)::INTEGER
        AND status    = 'abgeschlossen';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Alten Trigger entfernen falls er aus einem früheren Versuch existiert
DROP TRIGGER IF EXISTS trg_reopen_abgeschlossen_ln ON public.termine;

CREATE TRIGGER trg_reopen_abgeschlossen_ln
  AFTER INSERT OR UPDATE OR DELETE ON public.termine
  FOR EACH ROW EXECUTE FUNCTION public.reopen_abgeschlossen_ln_on_termin_change();
