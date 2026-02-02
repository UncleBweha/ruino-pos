-- Update the trigger function to handle conflicts gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    user_role app_role;
BEGIN
    -- Assign role based on email
    IF NEW.email IN ('ceo@ruinu.local', 'md@ruinu.local', 'irungu@ruinu.local') THEN
        user_role := 'admin';
    ELSE
        user_role := 'cashier';
    END IF;
    
    -- Insert the role, but ignore if already exists (allows edge function to set role first)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$function$;