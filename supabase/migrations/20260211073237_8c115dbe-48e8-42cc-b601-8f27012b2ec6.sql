
-- Schritt 1a: app_role Enum um 'buchhaltung' erweitern
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'buchhaltung';

-- Schritt 1b: user_rolle Enum um 'buchhaltung' erweitern
ALTER TYPE public.user_rolle ADD VALUE IF NOT EXISTS 'buchhaltung';
