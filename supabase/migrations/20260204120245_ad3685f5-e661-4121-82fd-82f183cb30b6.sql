-- =====================================================
-- SECURITY DEFINER FUNKTIONEN ERSTELLEN
-- =====================================================

CREATE FUNCTION public.is_geschaeftsfuehrer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'geschaeftsfuehrer'::app_role) $$;

CREATE FUNCTION public.is_admin_or_higher(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('geschaeftsfuehrer'::app_role, 'admin'::app_role)) $$;

CREATE FUNCTION public.can_delete(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'geschaeftsfuehrer'::app_role) $$;

CREATE FUNCTION public.is_authenticated_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('geschaeftsfuehrer'::app_role, 'admin'::app_role, 'mitarbeiter'::app_role)) $$;

CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id $$;

CREATE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_admin_or_higher(_user_id) $$;

CREATE FUNCTION public.is_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_admin_or_higher(_user_id) $$;

-- =====================================================
-- BENUTZER POLICIES
-- =====================================================

CREATE POLICY "Admins can read all benutzer" ON public.benutzer FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert benutzer" ON public.benutzer FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()) OR (status = 'pending'::benutzer_status AND rolle = 'mitarbeiter'::user_rolle));
CREATE POLICY "Admins can update benutzer" ON public.benutzer FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete benutzer" ON public.benutzer FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Users can read own benutzer" ON public.benutzer FOR SELECT USING (id = auth.uid());

-- =====================================================
-- USER_ROLES POLICIES
-- =====================================================

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete roles" ON public.user_roles FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- MITARBEITER POLICIES
-- =====================================================

CREATE POLICY "Admins can read mitarbeiter" ON public.mitarbeiter FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert mitarbeiter" ON public.mitarbeiter FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update mitarbeiter" ON public.mitarbeiter FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete mitarbeiter" ON public.mitarbeiter FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read own data" ON public.mitarbeiter FOR SELECT USING (benutzer_id = auth.uid());

-- =====================================================
-- KUNDEN POLICIES
-- =====================================================

CREATE POLICY "Admins can read kunden" ON public.kunden FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert kunden" ON public.kunden FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update kunden" ON public.kunden FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete kunden" ON public.kunden FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read assigned kunden" ON public.kunden FOR SELECT USING (
  EXISTS (SELECT 1 FROM mitarbeiter m JOIN termine t ON t.mitarbeiter_id = m.id WHERE m.benutzer_id = auth.uid() AND t.kunden_id = kunden.id)
);

-- =====================================================
-- TERMINE POLICIES
-- =====================================================

CREATE POLICY "Admins can read termine" ON public.termine FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert termine" ON public.termine FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update termine" ON public.termine FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete termine" ON public.termine FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Employees can read own termine" ON public.termine FOR SELECT USING (
  EXISTS (SELECT 1 FROM mitarbeiter m WHERE m.benutzer_id = auth.uid() AND m.id = termine.mitarbeiter_id)
);
CREATE POLICY "Employees can update own termine" ON public.termine FOR UPDATE USING (
  EXISTS (SELECT 1 FROM mitarbeiter m WHERE m.benutzer_id = auth.uid() AND m.id = termine.mitarbeiter_id)
);

-- =====================================================
-- DOKUMENTE POLICIES (Mitarbeiter erweitert)
-- =====================================================

CREATE POLICY "Admins can read dokumente" ON public.dokumente FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert dokumente" ON public.dokumente FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update dokumente" ON public.dokumente FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete dokumente" ON public.dokumente FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read assigned customer dokumente" ON public.dokumente FOR SELECT USING (
  EXISTS (SELECT 1 FROM mitarbeiter m JOIN termine t ON t.mitarbeiter_id = m.id WHERE m.benutzer_id = auth.uid() AND (t.kunden_id = dokumente.kunden_id OR dokumente.mitarbeiter_id = m.id))
  OR mitarbeiter_id = (SELECT id FROM mitarbeiter WHERE benutzer_id = auth.uid())
);
CREATE POLICY "Mitarbeiter can upload dokumente for assigned customers" ON public.dokumente FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM mitarbeiter m JOIN termine t ON t.mitarbeiter_id = m.id WHERE m.benutzer_id = auth.uid() AND (t.kunden_id = dokumente.kunden_id OR dokumente.mitarbeiter_id = m.id))
);

-- =====================================================
-- HAUSHALTE POLICIES
-- =====================================================

CREATE POLICY "Admins can read haushalte" ON public.haushalte FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert haushalte" ON public.haushalte FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update haushalte" ON public.haushalte FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete haushalte" ON public.haushalte FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read haushalte via termine" ON public.haushalte FOR SELECT USING (
  EXISTS (SELECT 1 FROM termine t JOIN mitarbeiter m ON m.id = t.mitarbeiter_id JOIN kunden k ON k.id = t.kunden_id WHERE k.haushalt_id = haushalte.id AND m.benutzer_id = auth.uid())
);

-- =====================================================
-- EINSATZORTE POLICIES
-- =====================================================

CREATE POLICY "Admins can read einsatzorte" ON public.einsatzorte FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert einsatzorte" ON public.einsatzorte FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update einsatzorte" ON public.einsatzorte FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete einsatzorte" ON public.einsatzorte FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read einsatzorte via termine" ON public.einsatzorte FOR SELECT USING (
  EXISTS (SELECT 1 FROM termine t JOIN mitarbeiter m ON m.id = t.mitarbeiter_id WHERE t.einsatzort_id = einsatzorte.id AND m.benutzer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM haushalte h JOIN kunden k ON k.haushalt_id = h.id JOIN termine t ON t.kunden_id = k.id JOIN mitarbeiter m ON m.id = t.mitarbeiter_id WHERE einsatzorte.haushalt_id = h.id AND m.benutzer_id = auth.uid())
);

-- =====================================================
-- KOSTENTRAEGER POLICIES
-- =====================================================

CREATE POLICY "Admins can read kostentraeger" ON public.kostentraeger FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert kostentraeger" ON public.kostentraeger FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update kostentraeger" ON public.kostentraeger FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete kostentraeger" ON public.kostentraeger FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Authenticated can read kostentraeger" ON public.kostentraeger FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- LEISTUNGEN POLICIES
-- =====================================================

CREATE POLICY "Admins can read leistungen" ON public.leistungen FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert leistungen" ON public.leistungen FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update leistungen" ON public.leistungen FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete leistungen" ON public.leistungen FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read leistungen of assigned kunden" ON public.leistungen FOR SELECT USING (
  EXISTS (SELECT 1 FROM termine t JOIN mitarbeiter m ON m.id = t.mitarbeiter_id WHERE t.kunden_id = leistungen.kunden_id AND m.benutzer_id = auth.uid())
);

-- =====================================================
-- RECHNUNGEN POLICIES
-- =====================================================

CREATE POLICY "Admins can read rechnungen" ON public.rechnungen FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert rechnungen" ON public.rechnungen FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update rechnungen" ON public.rechnungen FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete rechnungen" ON public.rechnungen FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- =====================================================
-- RECHNUNGSPOSITIONEN POLICIES
-- =====================================================

CREATE POLICY "Admins can read rechnungspositionen" ON public.rechnungspositionen FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert rechnungspositionen" ON public.rechnungspositionen FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update rechnungspositionen" ON public.rechnungspositionen FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete rechnungspositionen" ON public.rechnungspositionen FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- =====================================================
-- REMAINING TABLES
-- =====================================================

-- TERMIN_AENDERUNGEN
CREATE POLICY "Admins can read termin_aenderungen" ON public.termin_aenderungen FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert termin_aenderungen" ON public.termin_aenderungen FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update termin_aenderungen" ON public.termin_aenderungen FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete termin_aenderungen" ON public.termin_aenderungen FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Mitarbeiter can read own requests" ON public.termin_aenderungen FOR SELECT USING (
  EXISTS (SELECT 1 FROM benutzer b WHERE b.id = auth.uid() AND b.id = termin_aenderungen.requested_by)
);
CREATE POLICY "Mitarbeiter can insert own requests" ON public.termin_aenderungen FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- KUNDEN_ZEITFENSTER
CREATE POLICY "Admins can read kunden_zeitfenster" ON public.kunden_zeitfenster FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert kunden_zeitfenster" ON public.kunden_zeitfenster FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update kunden_zeitfenster" ON public.kunden_zeitfenster FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete kunden_zeitfenster" ON public.kunden_zeitfenster FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- MITARBEITER_VERFUEGBARKEIT
CREATE POLICY "Admins can read mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- MITARBEITER_ABWESENHEITEN
CREATE POLICY "Admins can read mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- TERMIN_VORLAGEN
CREATE POLICY "Admins can read termin_vorlagen" ON public.termin_vorlagen FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert termin_vorlagen" ON public.termin_vorlagen FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update termin_vorlagen" ON public.termin_vorlagen FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete termin_vorlagen" ON public.termin_vorlagen FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- ABRECHNUNGSREGELN
CREATE POLICY "Admins can read abrechnungsregeln" ON public.abrechnungsregeln FOR SELECT USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can insert abrechnungsregeln" ON public.abrechnungsregeln FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update abrechnungsregeln" ON public.abrechnungsregeln FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete abrechnungsregeln" ON public.abrechnungsregeln FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

-- LEISTUNGS_STATUS_HISTORIE
CREATE POLICY "Admins can manage leistungs_status_historie" ON public.leistungs_status_historie FOR ALL USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Authenticated can read historie" ON public.leistungs_status_historie FOR SELECT USING (
  EXISTS (SELECT 1 FROM leistungen l JOIN termine t ON t.kunden_id = l.kunden_id JOIN mitarbeiter m ON m.id = t.mitarbeiter_id WHERE l.id = leistungs_status_historie.leistung_id AND m.benutzer_id = auth.uid())
  OR is_admin_or_higher(auth.uid())
);

-- ABRECHNUNGS_HISTORIE
CREATE POLICY "Admins read abrechnungs_historie" ON public.abrechnungs_historie FOR SELECT USING (is_admin_or_higher(auth.uid()));

-- PENDING_REGISTRATIONS
CREATE POLICY "Admins can view registrations" ON public.pending_registrations FOR SELECT USING (is_admin_or_higher(auth.uid()) AND ignored = false);
CREATE POLICY "Admins can update registrations" ON public.pending_registrations FOR UPDATE USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Anyone can request registration" ON public.pending_registrations FOR INSERT WITH CHECK (true);

-- AUDIT_LOG
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can read audit_log" ON public.audit_log FOR SELECT USING (true);

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

CREATE POLICY "Admins can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND public.is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND public.is_admin_or_higher(auth.uid()));
CREATE POLICY "Only GF can delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND public.is_geschaeftsfuehrer(auth.uid()));
CREATE POLICY "Anyone can read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');