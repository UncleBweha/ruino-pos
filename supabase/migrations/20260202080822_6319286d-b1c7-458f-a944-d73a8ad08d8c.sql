-- Fix the overly permissive INSERT policy
-- Only the trigger function (running as SECURITY DEFINER) can insert roles
-- Regular users should not be able to insert their own roles

DROP POLICY IF EXISTS "Trigger can insert roles" ON public.user_roles;

-- The handle_new_user_role trigger function runs as SECURITY DEFINER
-- which bypasses RLS, so we don't need an INSERT policy for regular users
-- Only admins should be able to manually insert roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));