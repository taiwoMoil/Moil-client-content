-- Migration: Add Admin Roles and Policies (Version 2)
-- This version uses a simpler approach to avoid permission issues

-- Step 1: Add role column to existing users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client' 
CHECK (role IN ('client', 'admin'));

-- Step 2: Update existing users to have client role (if not already set)
UPDATE public.users 
SET role = 'client' 
WHERE role IS NULL;

-- Step 3: Update users with @moilapp.com emails to have admin role
UPDATE public.users 
SET role = 'admin' 
WHERE email LIKE '%@moilapp.com';

-- Step 4: Temporarily disable RLS to avoid permission issues during setup
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendars DISABLE ROW LEVEL SECURITY;

-- Step 5: Drop ALL existing policies
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
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile or admins can update all" ON public.users;
DROP POLICY IF EXISTS "Users can view own calendar items or admins can view all" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can insert own calendar items or admins can insert any" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can update own calendar items or admins can update all" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can delete own calendar items or admins can delete all" ON public.content_calendars;

-- Step 6: Update user creation function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT := 'client';
BEGIN
  -- Check if email ends with @moilapp.com to assign admin role
  IF NEW.email LIKE '%@moilapp.com' THEN
    user_role := 'admin';
  END IF;

  INSERT INTO public.users (id, email, company_name, brand_color, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
    '#5843BE',
    user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Create bypass function for admin check
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get email from auth.users (not subject to RLS)
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  RETURN user_email LIKE '%@moilapp.com';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create simple, working policies using email check
-- Users table policies
CREATE POLICY "user_select_policy" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.current_user_is_admin());

CREATE POLICY "user_update_policy" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.current_user_is_admin());

-- Content calendars policies  
CREATE POLICY "calendar_select_policy" ON public.content_calendars
  FOR SELECT USING (auth.uid() = user_id OR public.current_user_is_admin());

CREATE POLICY "calendar_insert_policy" ON public.content_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

CREATE POLICY "calendar_update_policy" ON public.content_calendars
  FOR UPDATE USING (auth.uid() = user_id OR public.current_user_is_admin());

CREATE POLICY "calendar_delete_policy" ON public.content_calendars
  FOR DELETE USING (auth.uid() = user_id OR public.current_user_is_admin());

-- Step 9: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendars ENABLE ROW LEVEL SECURITY;

-- Step 10: Verify the migration
SELECT 'Migration completed successfully. Admin functionality enabled.' as status;
SELECT email, role FROM public.users ORDER BY created_at;
