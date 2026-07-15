-- Migration: add content_type to content_calendars
-- content_type describes the media format of a calendar item:
-- 'Video', 'Still Image', 'Carousel', 'Animated Flyer'.
-- Nullable so existing rows remain valid; the app treats an empty value as "unset".

ALTER TABLE public.content_calendars
  ADD COLUMN IF NOT EXISTS content_type TEXT;
