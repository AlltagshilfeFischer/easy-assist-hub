-- Rename columns in customers table to German (skip email as it already exists)
ALTER TABLE public.customers 
RENAME COLUMN first_name TO vorname;

ALTER TABLE public.customers 
RENAME COLUMN last_name TO nachname;

ALTER TABLE public.customers 
RENAME COLUMN phone TO telefon;

ALTER TABLE public.customers 
RENAME COLUMN address TO adresse;

ALTER TABLE public.customers 
RENAME COLUMN birth_date TO geburtsdatum;

ALTER TABLE public.customers 
RENAME COLUMN emergency_contact_name TO notfallkontakt_name;

ALTER TABLE public.customers 
RENAME COLUMN emergency_contact_phone TO notfallkontakt_telefon;

ALTER TABLE public.customers 
RENAME COLUMN notes TO notizen;

ALTER TABLE public.customers 
RENAME COLUMN capacity_per_day TO kapazitaet_pro_tag;

ALTER TABLE public.customers 
RENAME COLUMN operating_days TO betriebstage;

ALTER TABLE public.customers 
RENAME COLUMN operating_hours_start TO betriebszeiten_start;

ALTER TABLE public.customers 
RENAME COLUMN operating_hours_end TO betriebszeiten_ende;

ALTER TABLE public.customers 
RENAME COLUMN created_at TO erstellt_am;

ALTER TABLE public.customers 
RENAME COLUMN updated_at TO aktualisiert_am;

-- Rename columns in employees table to German
ALTER TABLE public.employees 
RENAME COLUMN user_id TO benutzer_id;

ALTER TABLE public.employees 
RENAME COLUMN employee_number TO mitarbeiter_nummer;

ALTER TABLE public.employees 
RENAME COLUMN hire_date TO einstellungsdatum;

ALTER TABLE public.employees 
RENAME COLUMN hourly_rate TO stundenlohn;

ALTER TABLE public.employees 
RENAME COLUMN qualifications TO qualifikationen;

ALTER TABLE public.employees 
RENAME COLUMN is_active TO ist_aktiv;

ALTER TABLE public.employees 
RENAME COLUMN notes TO notizen;

ALTER TABLE public.employees 
RENAME COLUMN max_appointments_per_day TO max_termine_pro_tag;

ALTER TABLE public.employees 
RENAME COLUMN working_days TO arbeitstage;

ALTER TABLE public.employees 
RENAME COLUMN working_hours_start TO arbeitszeiten_start;

ALTER TABLE public.employees 
RENAME COLUMN working_hours_end TO arbeitszeiten_ende;

ALTER TABLE public.employees 
RENAME COLUMN vacation_days TO urlaubstage;

ALTER TABLE public.employees 
RENAME COLUMN created_at TO erstellt_am;

ALTER TABLE public.employees 
RENAME COLUMN updated_at TO aktualisiert_am;

-- Rename columns in appointments table to German
ALTER TABLE public.appointments 
RENAME COLUMN customer_id TO kunden_id;

ALTER TABLE public.appointments 
RENAME COLUMN employee_id TO mitarbeiter_id;

ALTER TABLE public.appointments 
RENAME COLUMN title TO titel;

ALTER TABLE public.appointments 
RENAME COLUMN description TO beschreibung;

ALTER TABLE public.appointments 
RENAME COLUMN appointment_date TO termin_datum;

ALTER TABLE public.appointments 
RENAME COLUMN start_time TO startzeit;

ALTER TABLE public.appointments 
RENAME COLUMN end_time TO endzeit;

ALTER TABLE public.appointments 
RENAME COLUMN notes TO notizen;

ALTER TABLE public.appointments 
RENAME COLUMN private_notes TO private_notizen;

ALTER TABLE public.appointments 
RENAME COLUMN created_at TO erstellt_am;

ALTER TABLE public.appointments 
RENAME COLUMN updated_at TO aktualisiert_am;

-- Rename columns in profiles table to German
ALTER TABLE public.profiles 
RENAME COLUMN user_id TO benutzer_id;

ALTER TABLE public.profiles 
RENAME COLUMN first_name TO vorname;

ALTER TABLE public.profiles 
RENAME COLUMN last_name TO nachname;

ALTER TABLE public.profiles 
RENAME COLUMN phone TO telefon;

ALTER TABLE public.profiles 
RENAME COLUMN created_at TO erstellt_am;

ALTER TABLE public.profiles 
RENAME COLUMN updated_at TO aktualisiert_am;

-- Rename columns in schedule_templates table to German
ALTER TABLE public.schedule_templates 
RENAME COLUMN customer_id TO kunden_id;

ALTER TABLE public.schedule_templates 
RENAME COLUMN employee_id TO mitarbeiter_id;

ALTER TABLE public.schedule_templates 
RENAME COLUMN day_of_week TO wochentag;

ALTER TABLE public.schedule_templates 
RENAME COLUMN start_time TO startzeit;

ALTER TABLE public.schedule_templates 
RENAME COLUMN end_time TO endzeit;

ALTER TABLE public.schedule_templates 
RENAME COLUMN is_active TO ist_aktiv;

ALTER TABLE public.schedule_templates 
RENAME COLUMN created_at TO erstellt_am;

ALTER TABLE public.schedule_templates 
RENAME COLUMN updated_at TO aktualisiert_am;