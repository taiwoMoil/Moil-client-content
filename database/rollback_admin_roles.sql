-- Rollback: Remove Admin Roles and Policies
-- Run this script to remove admin functionality if needed

-- Step 1: Drop all admin and user policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can insert own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can update own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can delete own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can insert calendar items for any user" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can update all calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can delete all calendar items" ON public.content_calendars;

-- Step 2: Restore original user creation function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, company_name, brand_color)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
    '#5843BE'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate original trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recreate original policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own calendar items" ON public.content_calendars
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar items" ON public.content_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar items" ON public.content_calendars
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar items" ON public.content_calendars
  FOR DELETE USING (auth.uid() = user_id);

-- Step 3: Remove role column (WARNING: This will delete role data)
-- Uncomment the line below if you want to completely remove the role column
-- ALTER TABLE public.users DROP COLUMN IF EXISTS role;

SELECT 'Rollback completed. Admin policies removed.' as status;
