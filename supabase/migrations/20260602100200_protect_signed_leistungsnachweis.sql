-- K2-Fix: DB-Trigger verhindert Downgrade von unterschriebenen/abgeschlossenen LNs.
--
-- Problem: batch-billing konnte mit status:'offen' im Upsert ein bereits unterschriebenes
-- oder abgeschlossenes Abrechnungsdokument überschreiben (Compliance-Risiko).
-- Der Frontend-Guard in batch-billing ist die erste Schutzschicht (Code-Ebene).
-- Dieser Trigger ist der Backstop auf DB-Ebene — schützt auch bei direkten API-Calls.

CREATE OR REPLACE FUNCTION public.protect_signed_leistungsnachweis()
RETURNS TRIGGER AS $$
BEGIN
  -- Statusübergang: von 'unterschrieben'/'abgeschlossen' zurück zu 'offen'/'entwurf' verboten
  IF OLD.status IN ('unterschrieben', 'abgeschlossen')
     AND NEW.status IN ('offen', 'entwurf')
  THEN
    RAISE EXCEPTION
      'Leistungsnachweis % ist bereits "%" und kann nicht auf "%" zurückgesetzt werden.',
      OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Inhaltliche Felder dürfen nach Unterschrift nicht geändert werden
  IF OLD.status IN ('unterschrieben', 'abgeschlossen')
     AND (
       NEW.geleistete_stunden IS DISTINCT FROM OLD.geleistete_stunden
       OR NEW.cb_entlastungsleistung IS DISTINCT FROM OLD.cb_entlastungsleistung
       OR NEW.cb_kombinationsleistung IS DISTINCT FROM OLD.cb_kombinationsleistung
       OR NEW.cb_verhinderungspflege IS DISTINCT FROM OLD.cb_verhinderungspflege
       OR NEW.cb_haushaltshilfe IS DISTINCT FROM OLD.cb_haushaltshilfe
       OR NEW.ist_privat IS DISTINCT FROM OLD.ist_privat
     )
  THEN
    RAISE EXCEPTION
      'Abrechnungsfelder von Leistungsnachweis % (Status: %) können nach Unterschrift nicht geändert werden.',
      OLD.id, OLD.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_signed_leistungsnachweis ON public.leistungsnachweise;

CREATE TRIGGER trg_protect_signed_leistungsnachweis
  BEFORE UPDATE ON public.leistungsnachweise
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_signed_leistungsnachweis();
