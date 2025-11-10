-- Migration: Add Admin Roles and Policies
-- Run this script to update existing database with admin functionality

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

-- Step 4: Drop trigger first, then function, then recreate both
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

-- Step 5: Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can insert own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can update own calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can delete own calendar items" ON public.content_calendars;

-- Drop any existing admin policies from previous attempts
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can insert calendar items for any user" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can update all calendar items" ON public.content_calendars;
DROP POLICY IF EXISTS "Admins can delete all calendar items" ON public.content_calendars;

-- Drop any combined policies from previous attempts
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile or admins can update all" ON public.users;
DROP POLICY IF EXISTS "Users can view own calendar items or admins can view all" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can insert own calendar items or admins can insert any" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can update own calendar items or admins can update all" ON public.content_calendars;
DROP POLICY IF EXISTS "Users can delete own calendar items or admins can delete all" ON public.content_calendars;

-- Step 6: Create separate policies for regular users and admins
-- Regular user policies
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

-- Admin policies using email check (avoids recursion)
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@moilapp.com'
  );

CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@moilapp.com'
  );

CREATE POLICY "Admins can view all calendar items" ON public.content_calendars
  FOR SELECT USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@moilapp.com'
  );

CREATE POLICY "Admins can insert calendar items for any user" ON public.content_calendars
  FOR INSERT WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@moilapp.com'
  );

CREATE POLICY "Admins can update all calendar items" ON public.content_calendars
  FOR UPDATE USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@moilapp.com'
  );

CREATE POLICY "Admins can delete all calendar items" ON public.content_calendars
  FOR DELETE USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) LIKE '%@moilapp.com'
  );

-- Step 7: Verify the migration
SELECT 'Migration completed successfully. Users table now has role column.' as status;
SELECT email, role FROM public.users ORDER BY created_at;
