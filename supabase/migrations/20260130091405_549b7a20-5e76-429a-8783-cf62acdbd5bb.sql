-- ============================================
-- LEISTUNGEN MIT STATE-MACHINE
-- Für Leistungsabrechnung nach SGB XI/SGB V
-- ============================================

-- 1. ENUM: Leistungsstatus (State Machine)
CREATE TYPE public.leistungs_status AS ENUM (
  'beantragt',    -- Antrag gestellt, wartet auf Bewilligung
  'genehmigt',    -- Bewilligt, aber noch nicht gestartet
  'aktiv',        -- Laufende Leistung
  'pausiert',     -- Vorübergehend ausgesetzt (z.B. Krankenhausaufenthalt)
  'beendet'       -- Abgeschlossen/Beendet
);

-- 2. ENUM: Leistungsart
CREATE TYPE public.leistungsart AS ENUM (
  'entlastungsleistung',      -- §45b SGB XI - Entlastungsbetrag
  'verhinderungspflege',      -- §39 SGB XI - Verhinderungspflege
  'kurzzeitpflege',           -- §42 SGB XI - Kurzzeitpflege
  'pflegesachleistung',       -- §36 SGB XI - Pflegesachleistung
  'privat',                   -- Privatleistung
  'sonstige'                  -- Andere Leistungsarten
);

-- 3. ENUM: Kostentraeger-Typ
CREATE TYPE public.kostentraeger_typ AS ENUM (
  'pflegekasse',
  'krankenkasse', 
  'kommune',
  'privat',
  'beihilfe'
);

-- 4. KOSTENTRAEGER-Tabelle (referenziert von Leistungen)
CREATE TABLE public.kostentraeger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ kostentraeger_typ NOT NULL,
  name TEXT NOT NULL,                    -- z.B. "AOK Niedersachsen"
  ik_nummer TEXT,                        -- Institutionskennzeichen
  anschrift_strasse TEXT,
  anschrift_plz TEXT,
  anschrift_stadt TEXT,
  telefon TEXT,
  email TEXT,
  ansprechpartner TEXT,
  abrechnungs_hinweise TEXT,             -- Spezielle Regeln für diesen Kostenträger
  ist_aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. LEISTUNGEN-Tabelle (Kern der Abrechnung)
CREATE TABLE public.leistungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenzen
  kunden_id UUID NOT NULL REFERENCES public.kunden(id) ON DELETE RESTRICT,
  kostentraeger_id UUID REFERENCES public.kostentraeger(id),
  
  -- Leistungsart & Status
  art leistungsart NOT NULL,
  status leistungs_status NOT NULL DEFAULT 'beantragt',
  
  -- Gültigkeitszeitraum
  gueltig_von DATE NOT NULL,
  gueltig_bis DATE,                      -- NULL = unbefristet
  
  -- Bewilligung
  bewilligung_datum DATE,
  bewilligung_aktenzeichen TEXT,         -- Aktenzeichen der Pflegekasse
  bewilligung_dokument_id UUID REFERENCES public.dokumente(id),
  
  -- Kontingent
  kontingent_einheit TEXT DEFAULT 'stunden', -- 'stunden', 'euro', 'einsaetze'
  kontingent_menge NUMERIC,              -- z.B. 125 (Euro) oder 40 (Stunden)
  kontingent_zeitraum TEXT DEFAULT 'monat', -- 'monat', 'jahr', 'gesamt'
  kontingent_verbraucht NUMERIC DEFAULT 0,
  
  -- Zusätzliche Infos
  pflegegrad_bei_bewilligung SMALLINT CHECK (pflegegrad_bei_bewilligung >= 0 AND pflegegrad_bei_bewilligung <= 5),
  versichertennummer TEXT,
  bemerkungen TEXT,
  
  -- Audit
  beantragt_am DATE,
  beantragt_von UUID REFERENCES public.benutzer(id),
  genehmigt_am TIMESTAMPTZ,
  genehmigt_von UUID REFERENCES public.benutzer(id),
  beendet_am TIMESTAMPTZ,
  beendet_grund TEXT,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. LEISTUNGS_STATUS_HISTORIE (Append-only Audit Trail)
CREATE TABLE public.leistungs_status_historie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leistung_id UUID NOT NULL REFERENCES public.leistungen(id) ON DELETE CASCADE,
  
  -- Status-Änderung
  alter_status leistungs_status,
  neuer_status leistungs_status NOT NULL,
  
  -- Kontext
  grund TEXT,                            -- Warum die Änderung?
  geaendert_von UUID REFERENCES public.benutzer(id),
  geaendert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Zusätzliche Daten (für Rekonstruktion)
  zusatz_daten JSONB                     -- Beliebige zusätzliche Infos
);

-- 7. RLS aktivieren
ALTER TABLE public.kostentraeger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leistungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leistungs_status_historie ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Kostentraeger: Admins alles, alle können lesen
CREATE POLICY "Admins can manage kostentraeger" ON public.kostentraeger
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated can read kostentraeger" ON public.kostentraeger
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Leistungen: Admins alles, Mitarbeiter nur zugewiesene Kunden
CREATE POLICY "Admins can manage leistungen" ON public.leistungen
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Mitarbeiter can read leistungen of assigned kunden" ON public.leistungen
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM termine t
      JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
      WHERE t.kunden_id = leistungen.kunden_id
      AND m.benutzer_id = auth.uid()
    )
  );

-- Leistungs_Status_Historie: Admins alles, lesend für zugewiesene
CREATE POLICY "Admins can manage leistungs_status_historie" ON public.leistungs_status_historie
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated can read historie" ON public.leistungs_status_historie
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leistungen l
      JOIN termine t ON t.kunden_id = l.kunden_id
      JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
      WHERE l.id = leistungs_status_historie.leistung_id
      AND m.benutzer_id = auth.uid()
    )
    OR is_admin(auth.uid())
  );

-- 9. Trigger für automatische Status-Historie
CREATE OR REPLACE FUNCTION public.log_leistungs_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Nur bei Status-Änderung
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- User-ID ermitteln
    BEGIN
      v_user_id := current_setting('app.user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := auth.uid();
    END;
    
    INSERT INTO public.leistungs_status_historie (
      leistung_id,
      alter_status,
      neuer_status,
      geaendert_von
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      v_user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_leistungs_status_change
  AFTER UPDATE ON public.leistungen
  FOR EACH ROW
  EXECUTE FUNCTION public.log_leistungs_status_change();

-- 10. Trigger für updated_at
CREATE TRIGGER update_kostentraeger_updated_at
  BEFORE UPDATE ON public.kostentraeger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leistungen_updated_at
  BEFORE UPDATE ON public.leistungen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Indizes
CREATE INDEX idx_leistungen_kunden ON public.leistungen(kunden_id);
CREATE INDEX idx_leistungen_status ON public.leistungen(status);
CREATE INDEX idx_leistungen_art ON public.leistungen(art);
CREATE INDEX idx_leistungen_gueltig ON public.leistungen(gueltig_von, gueltig_bis);
CREATE INDEX idx_leistungs_historie_leistung ON public.leistungs_status_historie(leistung_id);
CREATE INDEX idx_kostentraeger_typ ON public.kostentraeger(typ);

-- 12. Dokumentation
COMMENT ON TABLE public.leistungen IS 'DDD: Leistungs-Aggregat mit State-Machine. Bildet bewilligte Leistungen nach SGB XI/V ab.';
COMMENT ON TABLE public.leistungs_status_historie IS 'Append-only Audit-Trail für alle Statusänderungen von Leistungen. Ermöglicht vollständige Rekonstruktion.';
COMMENT ON TABLE public.kostentraeger IS 'Kostenträger (Pflegekassen, Kommunen, etc.) mit Abrechnungsinformationen.';
COMMENT ON TYPE public.leistungs_status IS 'State-Machine: beantragt → genehmigt → aktiv → pausiert → beendet';

-- 13. Hilfsfunktion: Gültige Statusübergänge prüfen
CREATE OR REPLACE FUNCTION public.validate_leistungs_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Definiere erlaubte Übergänge
  IF OLD.status = 'beantragt' AND NEW.status NOT IN ('genehmigt', 'beendet') THEN
    RAISE EXCEPTION 'Ungültiger Statusübergang: % → %', OLD.status, NEW.status;
  ELSIF OLD.status = 'genehmigt' AND NEW.status NOT IN ('aktiv', 'beendet') THEN
    RAISE EXCEPTION 'Ungültiger Statusübergang: % → %', OLD.status, NEW.status;
  ELSIF OLD.status = 'aktiv' AND NEW.status NOT IN ('pausiert', 'beendet') THEN
    RAISE EXCEPTION 'Ungültiger Statusübergang: % → %', OLD.status, NEW.status;
  ELSIF OLD.status = 'pausiert' AND NEW.status NOT IN ('aktiv', 'beendet') THEN
    RAISE EXCEPTION 'Ungültiger Statusübergang: % → %', OLD.status, NEW.status;
  ELSIF OLD.status = 'beendet' THEN
    RAISE EXCEPTION 'Beendete Leistungen können nicht mehr geändert werden';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_leistungs_status
  BEFORE UPDATE OF status ON public.leistungen
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_leistungs_status_transition();