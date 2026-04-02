-- Migration: Pflegebudget Abrechnungs- & Budgettracker-System
-- Erstellt neue Tabellen für transaktionsbasiertes Budget-Tracking

-- ============================================================
-- 1. Enums
-- ============================================================

CREATE TYPE service_type AS ENUM ('ENTLASTUNG', 'KOMBI', 'VERHINDERUNG');
CREATE TYPE transaction_source AS ENUM ('APLANO_IMPORT', 'MANUAL');

-- ============================================================
-- 2. Pflegegrad-Budgets (Stammdaten)
-- ============================================================

CREATE TABLE care_levels (
  pflegegrad INTEGER PRIMARY KEY CHECK (pflegegrad BETWEEN 0 AND 5),
  sachleistung_monat NUMERIC NOT NULL DEFAULT 0,
  kombi_max_40_prozent_monat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO care_levels (pflegegrad, sachleistung_monat, kombi_max_40_prozent_monat) VALUES
  (0, 0,    0),
  (1, 0,    0),
  (2, 796,  318.40),
  (3, 1497, 598.80),
  (4, 1859, 743.60),
  (5, 2299, 919.60);

ALTER TABLE care_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read care_levels"
  ON care_levels FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Tarife
-- ============================================================

CREATE TABLE tariffs (
  id TEXT PRIMARY KEY,
  service_type service_type NOT NULL,
  hourly_rate NUMERIC NOT NULL,
  travel_flat_per_visit NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tariffs (id, service_type, hourly_rate, travel_flat_per_visit, active) VALUES
  ('entlastung-std', 'ENTLASTUNG', 39.00, 6.00, true),
  ('kombi-std',      'KOMBI',      39.00, 6.00, true),
  ('vp-std',         'VERHINDERUNG', 46.80, 0.00, true);

ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tariffs"
  ON tariffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tariffs"
  ON tariffs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin')
    )
  );

-- ============================================================
-- 4. Budget-Transaktionen (Kern-Tabelle)
-- ============================================================

CREATE TABLE budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID,                                    -- Legacy / optional
  client_id UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  hours NUMERIC NOT NULL CHECK (hours > 0),
  visits INTEGER NOT NULL DEFAULT 1 CHECK (visits > 0),
  service_type service_type NOT NULL DEFAULT 'ENTLASTUNG',
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  travel_flat_total NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  source transaction_source NOT NULL,
  external_ref TEXT,                                 -- z.B. Aplano-ID
  billed BOOLEAN NOT NULL DEFAULT false,             -- false=offen, true=abgerechnet
  allocation_type TEXT NOT NULL DEFAULT 'AUTO' CHECK (allocation_type IN ('AUTO', 'MANUAL')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX budget_transactions_client_id_idx ON budget_transactions(client_id);
CREATE INDEX budget_transactions_service_date_idx ON budget_transactions(service_date);
CREATE INDEX budget_transactions_billed_idx ON budget_transactions(billed);
CREATE INDEX budget_transactions_month_idx ON budget_transactions(date_trunc('month', service_date::timestamp));

ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read budget_transactions"
  ON budget_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and mitarbeiter can insert budget_transactions"
  ON budget_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin', 'mitarbeiter')
    )
  );

CREATE POLICY "Admins and mitarbeiter can update budget_transactions"
  ON budget_transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin', 'mitarbeiter')
    )
  );

CREATE POLICY "Admins can delete budget_transactions"
  ON budget_transactions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin')
    )
  );

-- ============================================================
-- 5. kunden Tabelle erweitern
-- ============================================================

ALTER TABLE kunden
  ADD COLUMN IF NOT EXISTS entlastung_genehmigt BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS privatrechnung_erlaubt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_budget_entlastung NUMERIC,
  ADD COLUMN IF NOT EXISTS initial_budget_verhinderung NUMERIC,
  ADD COLUMN IF NOT EXISTS verhinderungspflege_genehmigt_am DATE,
  ADD COLUMN IF NOT EXISTS kombileistung_genehmigt_am DATE,
  ADD COLUMN IF NOT EXISTS archiviert BOOLEAN DEFAULT false;

-- Kommentare für Klarheit
COMMENT ON COLUMN kunden.entlastung_genehmigt IS 'Entlastungsbetrag genehmigt (Default: true für alle PG >= 1)';
COMMENT ON COLUMN kunden.privatrechnung_erlaubt IS 'Privatrechnung erlaubt (zusätzlich zu Kassenleistungen)';
COMMENT ON COLUMN kunden.initial_budget_entlastung IS 'Vorjahresrest Entlastungsbetrag (verfällt am 01.07.)';
COMMENT ON COLUMN kunden.initial_budget_verhinderung IS 'Vorjahresrest Verhinderungspflege';
COMMENT ON COLUMN kunden.verhinderungspflege_genehmigt_am IS 'Datum der VP-Genehmigung durch die Kasse';
COMMENT ON COLUMN kunden.kombileistung_genehmigt_am IS 'Datum der Kombileistungs-Genehmigung (pflegesachleistung)';
COMMENT ON COLUMN kunden.archiviert IS 'Archiviert (nicht aktiv, bleibt in Datenbank)';
