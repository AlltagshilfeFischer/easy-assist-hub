-- Fix permission error caused by audit trigger on benutzer writing to audit_log
GRANT SELECT, INSERT ON TABLE public.audit_log TO service_role;

-- Grant sequence permissions for audit_log primary key sequence
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.audit_log_id_seq TO service_role;