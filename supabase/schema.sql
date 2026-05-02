-- =============================================================
-- IronAtlas — Supabase schema
-- Run this in the Supabase SQL editor (one-shot).
-- =============================================================

-- Required extensions ------------------------------------------------
create extension if not exists "pgcrypto";

-- profiles -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null default 'user' check (role in ('user', 'admin')),
  age_group text not null default '18-25',
  created_at timestamptz not null default now()
);

-- workouts -----------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_id_idx on public.workouts(user_id);

-- workout_sets -------------------------------------------------------
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_name text not null,
  muscle_group text not null,
  weight_lbs numeric not null default 0,
  reps integer not null default 0,
  sets integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists workout_sets_workout_id_idx on public.workout_sets(workout_id);

-- strength_standards -------------------------------------------------
create table if not exists public.strength_standards (
  id uuid primary key default gen_random_uuid(),
  muscle_group text not null,
  exercise_name text not null,
  age_group text not null,
  below_average_lbs numeric not null,
  average_lbs numeric not null,
  above_average_lbs numeric not null,
  exceptional_lbs numeric not null,
  elite_lbs numeric not null,
  unique (exercise_name, age_group)
);

-- Auto-create a profile row whenever a new auth user is created ------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles         enable row level security;
alter table public.workouts         enable row level security;
alter table public.workout_sets     enable row level security;
alter table public.strength_standards enable row level security;

-- profiles: each user can read/update their own row; admins can read all.
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles admin select" on public.profiles;
create policy "profiles admin select" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- workouts: each user can manage their own.
drop policy if exists "workouts owner all" on public.workouts;
create policy "workouts owner all" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- workout_sets: through the parent workout.
drop policy if exists "workout_sets owner all" on public.workout_sets;
create policy "workout_sets owner all" on public.workout_sets
  for all using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id and w.user_id = auth.uid()
    )
  );

-- strength_standards: readable by any signed-in user.
drop policy if exists "standards read all" on public.strength_standards;
create policy "standards read all" on public.strength_standards
  for select using (auth.role() = 'authenticated');

-- =============================================================
-- Seed strength standards (18-25 age group, lbs unless noted)
-- Plank values are seconds.
-- =============================================================
insert into public.strength_standards
  (muscle_group, exercise_name, age_group,
   below_average_lbs, average_lbs, above_average_lbs, exceptional_lbs, elite_lbs)
values
  ('chest',      'Bench Press',         '18-25', 135, 185, 235, 290, 350),
  ('shoulders',  'Overhead Press',      '18-25',  75, 115, 155, 195, 240),
  ('back',       'Barbell Row',         '18-25',  95, 145, 195, 245, 305),
  ('back',       'Pull Up',             '18-25',   0,  25,  60, 100, 145),
  ('biceps',     'Barbell Curl',        '18-25',  55,  80, 110, 145, 185),
  ('triceps',    'Tricep Pushdown',     '18-25',  50,  75, 105, 140, 175),
  ('quads',      'Squat',               '18-25', 135, 230, 305, 385, 470),
  ('hamstrings', 'Romanian Deadlift',   '18-25', 135, 205, 275, 350, 425),
  ('glutes',     'Hip Thrust',          '18-25', 185, 275, 360, 450, 545),
  ('calves',     'Calf Raise',          '18-25',  95, 165, 225, 295, 365),
  ('abs',        'Plank',               '18-25',  30,  60, 120, 240, 360)
on conflict (exercise_name, age_group) do update set
  muscle_group        = excluded.muscle_group,
  below_average_lbs   = excluded.below_average_lbs,
  average_lbs         = excluded.average_lbs,
  above_average_lbs   = excluded.above_average_lbs,
  exceptional_lbs     = excluded.exceptional_lbs,
  elite_lbs           = excluded.elite_lbs;

-- =============================================================
-- After running this:
-- 1. In Supabase Auth, create your first user (Authentication > Users > Add user).
-- 2. Promote them to admin:
--      update public.profiles set role = 'admin' where id = '<that-user-id>';
-- =============================================================
