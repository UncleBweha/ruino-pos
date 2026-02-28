-- Fix casuals: drop restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can view casuals" ON public.casuals;
CREATE POLICY "Authenticated users can view casuals"
  ON public.casuals FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Fix profiles: drop restrictive individual SELECT policies and create a permissive one
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);