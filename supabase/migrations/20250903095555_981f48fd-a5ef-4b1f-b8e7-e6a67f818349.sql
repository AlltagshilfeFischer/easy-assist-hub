-- Rename German tables to English equivalents to match TypeScript definitions

-- Rename kunden to customers
ALTER TABLE public.kunden RENAME TO customers;

-- Rename mitarbeiter to employees  
ALTER TABLE public.mitarbeiter RENAME TO employees;

-- Rename termine to appointments
ALTER TABLE public.termine RENAME TO appointments;

-- Update foreign key constraints to use new table names
ALTER TABLE public.appointments 
  DROP CONSTRAINT IF EXISTS termine_kunden_id_fkey,
  DROP CONSTRAINT IF EXISTS termine_mitarbeiter_id_fkey;

ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (kunden_id) REFERENCES public.customers(id),
  ADD CONSTRAINT appointments_employee_id_fkey FOREIGN KEY (mitarbeiter_id) REFERENCES public.employees(id);

-- Update any other tables that reference the renamed tables
UPDATE pg_constraint 
SET confrelid = 'public.customers'::regclass 
WHERE confrelid = 'public.kunden'::regclass;

UPDATE pg_constraint 
SET confrelid = 'public.employees'::regclass 
WHERE confrelid = 'public.mitarbeiter'::regclass;

UPDATE pg_constraint 
SET confrelid = 'public.appointments'::regclass 
WHERE confrelid = 'public.termine'::regclass;