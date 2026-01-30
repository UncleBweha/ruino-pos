-- Update the trigger function to use the new @ruinu.local emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
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

    -- Create profile
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email);
    
    -- Create user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);

    RETURN NEW;
END;
$$;

-- Update existing users with @ruinu.local emails to have admin role
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN ('ceo@ruinu.local', 'md@ruinu.local', 'irungu@ruinu.local')
);

-- Update receipt_settings default company name
ALTER TABLE public.receipt_settings 
ALTER COLUMN company_name SET DEFAULT 'Ruinu General Merchants';