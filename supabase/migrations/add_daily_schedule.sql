-- Date-keyed workout schedule. Replaces the day-of-week default
-- template for the My Week panel — each calendar date can now hold
-- its own preset/workout, so the user can plan an actual week instead
-- of repeating the same routine on every Monday forever.
--
-- The legacy workout_schedule table is kept as a fallback "default
-- template" — daily_schedule entries take precedence wherever both
-- exist.

create table if not exists public.daily_schedule (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  is_rest boolean default false,
  workout_type text,
  preset_id uuid references public.workout_presets(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_schedule_user_date_idx
  on public.daily_schedule (user_id, date desc);

alter table public.daily_schedule enable row level security;

drop policy if exists "owner all daily_schedule" on public.daily_schedule;
create policy "owner all daily_schedule"
  on public.daily_schedule for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
