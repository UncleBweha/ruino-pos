-- Update the handle_new_user_role function to use @ruinu.local emails
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
    IF NEW.email IN ('ceo@ruinu.local', 'md@ruinu.local', 'irungu@ruinu.local') THEN
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