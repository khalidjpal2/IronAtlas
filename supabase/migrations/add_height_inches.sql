-- Add the height_inches column to profiles. Idempotent.
-- Run this once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists height_inches numeric;
