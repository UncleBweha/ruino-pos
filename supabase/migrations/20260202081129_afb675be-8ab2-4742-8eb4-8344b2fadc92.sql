-- Create a security definer function to get users for login
-- This bypasses RLS but only returns necessary data for login
CREATE OR REPLACE FUNCTION public.get_login_users()
RETURNS TABLE (
    user_id uuid,
    full_name text,
    email text,
    role app_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.user_id,
        p.full_name,
        p.email,
        r.role
    FROM public.profiles p
    INNER JOIN public.user_roles r ON p.user_id = r.user_id
    ORDER BY p.full_name;
$$;