-- Create users table (extends Supabase auth.users)
-- Each user IS a client with their own branding and content
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  brand_color TEXT DEFAULT '#5843BE',
  logo_url TEXT,
  industry TEXT,
  onedrive_team_review_link TEXT,
  onedrive_client_dropoff_link TEXT,
  onedrive_ready_schedule_link TEXT,
  onedrive_status_report_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_calendars table
CREATE TABLE IF NOT EXISTS public.content_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  day TEXT NOT NULL,
  platform TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL,
  team_status TEXT NOT NULL DEFAULT 'not-started' CHECK (team_status IN ('not-started', 'in-progress', 'ready-review', 'ready-post')),
  client_status TEXT NOT NULL DEFAULT 'not-submitted' CHECK (client_status IN ('not-submitted', 'under-review', 'approved', 'needs-changes')),
  is_new BOOLEAN DEFAULT FALSE,
  hook TEXT NOT NULL,
  copy TEXT NOT NULL,
  kpi TEXT NOT NULL,
  image_prompt_1 TEXT NOT NULL,
  image_prompt_2 TEXT NOT NULL,
  comments TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendars ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Create policies for content_calendars table
CREATE POLICY "Users can view own calendar items" ON public.content_calendars
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar items" ON public.content_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar items" ON public.content_calendars
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar items" ON public.content_calendars
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to handle user creation
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

-- Create trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_content_calendars_updated_at
  BEFORE UPDATE ON public.content_calendars
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
