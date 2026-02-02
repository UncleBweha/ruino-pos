-- Fix: Allow the trigger function to insert roles for new users
-- The trigger runs as SECURITY DEFINER but we need a policy that allows service role inserts

-- Drop and recreate the policy to allow trigger-based inserts
DROP POLICY IF EXISTS "Trigger can insert roles" ON public.user_roles;

CREATE POLICY "Trigger can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (true);

-- Also ensure we have proper triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_role_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_role_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();