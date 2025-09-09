-- Fix RLS policy for audit_log table to allow INSERT operations
CREATE POLICY "Authenticated users can insert audit_log" 
ON public.audit_log 
FOR INSERT 
WITH CHECK (true);