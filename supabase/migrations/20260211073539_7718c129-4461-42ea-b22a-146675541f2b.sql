
-- Leistungsnachweise Tabelle
CREATE TABLE public.leistungsnachweise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunden_id uuid NOT NULL REFERENCES public.kunden(id) ON DELETE CASCADE,
  monat smallint NOT NULL CHECK (monat >= 1 AND monat <= 12),
  jahr smallint NOT NULL CHECK (jahr >= 2020),
  geplante_stunden numeric NOT NULL DEFAULT 0,
  geleistete_stunden numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'offen', 'unterschrieben', 'abgeschlossen')),
  
  -- Abweichende Rechnungsadresse
  abweichende_rechnungsadresse boolean NOT NULL DEFAULT false,
  rechnungsadresse_name text,
  rechnungsadresse_strasse text,
  rechnungsadresse_plz text,
  rechnungsadresse_stadt text,
  
  -- Privat-Abrechnung
  ist_privat boolean NOT NULL DEFAULT false,
  
  -- Kostenträger oder Privatperson
  kostentraeger_id uuid REFERENCES public.kostentraeger(id),
  privat_empfaenger_name text,
  
  -- Unterschrift
  unterschrift_kunde_bild text, -- Base64 encoded signature image
  unterschrift_kunde_zeitstempel timestamptz,
  unterschrift_kunde_durch text, -- Name of signer
  unterschrift_gf_template text, -- Pre-filled GF signature template
  unterschrift_gf_name text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(kunden_id, monat, jahr)
);

ALTER TABLE public.leistungsnachweise ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins can read leistungsnachweise"
  ON public.leistungsnachweise FOR SELECT
  USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Admins can insert leistungsnachweise"
  ON public.leistungsnachweise FOR INSERT
  WITH CHECK (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Admins can update leistungsnachweise"
  ON public.leistungsnachweise FOR UPDATE
  USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Only GF can delete leistungsnachweise"
  ON public.leistungsnachweise FOR DELETE
  USING (public.is_geschaeftsfuehrer(auth.uid()));

-- Mitarbeiter: can read leistungsnachweise of their assigned customers
CREATE POLICY "Mitarbeiter can read assigned leistungsnachweise"
  ON public.leistungsnachweise FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM termine t
    JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
    WHERE t.kunden_id = leistungsnachweise.kunden_id
    AND m.benutzer_id = auth.uid()
  ));

-- Mitarbeiter: can update signature fields only
CREATE POLICY "Mitarbeiter can sign leistungsnachweise"
  ON public.leistungsnachweise FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM termine t
    JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
    WHERE t.kunden_id = leistungsnachweise.kunden_id
    AND m.benutzer_id = auth.uid()
  ));

-- Buchhaltung: read access
CREATE POLICY "Buchhaltung can read leistungsnachweise"
  ON public.leistungsnachweise FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_leistungsnachweise_updated_at
  BEFORE UPDATE ON public.leistungsnachweise
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
