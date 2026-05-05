-- Per-user weekly workout schedule. One row per (user, day_of_week);
-- a missing row means "no schedule set for that day" and the daily
-- workout quest falls back to the legacy "any set logged today" rule.
--
-- day_of_week uses JS getDay() convention: 0=Sunday … 6=Saturday.

create table if not exists public.workout_schedule (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week integer not null,
  is_rest boolean not null default false,
  workout_type text,
  updated_at timestamptz not null default now(),
  unique (user_id, day_of_week),
  constraint workout_schedule_dow_check
    check (day_of_week between 0 and 6),
  constraint workout_schedule_type_check
    check (workout_type is null or workout_type in (
      'push','pull','legs','upper','lower','full_body','custom'
    ))
);

create index if not exists workout_schedule_user_idx
  on public.workout_schedule (user_id);

alter table public.workout_schedule enable row level security;
drop policy if exists "owner all workout_schedule" on public.workout_schedule;
create policy "owner all workout_schedule"
  on public.workout_schedule for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
