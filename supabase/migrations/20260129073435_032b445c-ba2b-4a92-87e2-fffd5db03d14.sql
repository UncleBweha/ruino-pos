-- Create trigger function to auto-assign roles on user signup based on email
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role app_role;
BEGIN
    -- Assign role based on email
    IF NEW.email IN ('ceo@ruino.local', 'md@ruino.local', 'irungu@ruino.local') THEN
        user_role := 'admin';
    ELSE
        user_role := 'cashier';
    END IF;
    
    -- Insert the role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);
    
    RETURN NEW;
END;
$$;

-- Create trigger to run after user creation
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Fix existing users by inserting their roles
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 
    CASE 
        WHEN au.email IN ('ceo@ruino.local', 'md@ruino.local', 'irungu@ruino.local') THEN 'admin'::app_role
        ELSE 'cashier'::app_role
    END
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id
);