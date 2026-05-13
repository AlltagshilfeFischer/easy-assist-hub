-- Tabelle für globale App-Einstellungen (Key-Value)
CREATE TABLE IF NOT EXISTS public.einstellungen (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS aktivieren
ALTER TABLE public.einstellungen ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer können lesen (für Preview-Anzeige)
CREATE POLICY "Authenticated users can read einstellungen"
  ON public.einstellungen
  FOR SELECT
  TO authenticated
  USING (true);

-- Nur Admins (GF + GlobalAdmin) können schreiben
CREATE POLICY "Admins can insert einstellungen"
  ON public.einstellungen
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_higher(auth.uid()));

CREATE POLICY "Admins can update einstellungen"
  ON public.einstellungen
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_higher(auth.uid()))
  WITH CHECK (is_admin_or_higher(auth.uid()));

-- updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION public.update_einstellungen_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER einstellungen_updated_at
  BEFORE UPDATE ON public.einstellungen
  FOR EACH ROW EXECUTE FUNCTION public.update_einstellungen_updated_at();
