-- K1-Fix: reopen-trigger darf 'abgerechnet'-Status-Updates nicht als LN-Wiedereröffnung werten.
--
-- Problem: handleGfBestaetigen setzt LN auf 'abgeschlossen', ruft dann markTermineAbgerechnet
-- auf (UPDATE termine SET status='abgerechnet'). Der Trigger feuert auf dieses UPDATE und
-- setzt den LN sofort wieder auf 'unterschrieben' zurück. → Kein LN konnte dauerhaft
-- abgeschlossen werden.
--
-- Fix: UPDATE-Block überspringen wenn NEW.status = 'abgerechnet' und OLD.status != 'abgerechnet'.

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

  -- Bei UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Termin wird auf 'abgerechnet' gesetzt: LN-Reopen überspringen.
    -- Dieser Übergang passiert immer NACH dem LN-Abschluss (handleGfBestaetigen /
    -- bulkCloseMutation) und darf den Status nicht zurücksetzen.
    IF NEW.status = 'abgerechnet' AND OLD.status IS DISTINCT FROM 'abgerechnet' THEN
      RETURN NEW;
    END IF;

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
         NEW.kunden_id IS DISTINCT FROM OLD.kunden_id
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
