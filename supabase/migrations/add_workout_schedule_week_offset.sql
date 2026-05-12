-- Per-week scheduling: each (user, day_of_week) row now lives at a
-- specific week_offset (0 = current week / template, -1 = last week,
-- +1 = next week, etc.). The previous unique constraint on
-- (user_id, day_of_week) is replaced with one that includes
-- week_offset so different weeks can carry different schedules.

alter table public.workout_schedule
  add column if not exists week_offset integer not null default 0;

-- Drop the prior uniqueness constraint (Supabase auto-names it
-- workout_schedule_user_id_day_of_week_key, but check for the alias
-- the older migration may have used too).
alter table public.workout_schedule
  drop constraint if exists workout_schedule_user_id_day_of_week_key;
alter table public.workout_schedule
  drop constraint if exists workout_schedule_user_dow_key;

alter table public.workout_schedule
  add constraint workout_schedule_user_dow_week_key
    unique (user_id, day_of_week, week_offset);

create index if not exists workout_schedule_user_offset_idx
  on public.workout_schedule (user_id, week_offset);
