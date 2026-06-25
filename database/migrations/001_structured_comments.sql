-- Migration 001: structured comments + per-viewer unread tracking
--
-- Before: content_calendars.comments was TEXT[] (plain strings) with no way to
-- know which comments were new. After: comments is JSONB holding objects of the
-- shape { id, text, authorRole, createdAt }, and a new content_comment_reads
-- table records when each viewer last read each item's thread.
--
-- Run this in the Supabase SQL editor (or via psql) BEFORE running
-- scripts/migrate-comments.mjs, which backfills the object shape.
--
-- This file is idempotent and safe to run more than once.

-- 1) Convert comments column TEXT[] -> JSONB ------------------------------------
-- to_jsonb on a text[] yields a JSON array of strings, e.g. '["a","b"]'.
-- The data-migration script then upgrades each string into a full object.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_calendars'
      AND column_name = 'comments'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.content_calendars
      ALTER COLUMN comments DROP DEFAULT;

    ALTER TABLE public.content_calendars
      ALTER COLUMN comments TYPE JSONB USING to_jsonb(comments);

    ALTER TABLE public.content_calendars
      ALTER COLUMN comments SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Normalize any NULLs to an empty array.
UPDATE public.content_calendars SET comments = '[]'::jsonb WHERE comments IS NULL;

-- 2) Per-viewer read tracking --------------------------------------------------
-- One row per (viewer, calendar item). last_read_at is the moment the viewer
-- last opened that item's comment thread. Comments created after this are unread.
-- NOTE: viewer = the authenticated user (an admin keeps their own read state even
-- while viewing a client's calendar), so this is keyed on auth.users, not on the
-- calendar item's owner.
CREATE TABLE IF NOT EXISTS public.content_comment_reads (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.content_calendars(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_content_comment_reads_user
  ON public.content_comment_reads (user_id);

ALTER TABLE public.content_comment_reads ENABLE ROW LEVEL SECURITY;

-- A viewer can only see and write their own read markers.
DROP POLICY IF EXISTS "Viewers manage own read markers" ON public.content_comment_reads;
CREATE POLICY "Viewers manage own read markers" ON public.content_comment_reads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
