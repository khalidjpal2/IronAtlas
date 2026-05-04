-- Daily workout goal — used by the Atlas pillar quest.
-- Values: 'any' (log at least 1 exercise) | 'sets_3' | 'sets_5' | 'sets_10'
-- Defaults to 'any' so existing profiles satisfy a low bar by default.

alter table public.profiles
  add column if not exists daily_workout_goal text not null default 'any';

alter table public.profiles
  drop constraint if exists profiles_daily_workout_goal_check;

alter table public.profiles
  add constraint profiles_daily_workout_goal_check
  check (daily_workout_goal in ('any', 'sets_3', 'sets_5', 'sets_10'));
