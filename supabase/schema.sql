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

-- profile fields added in later iterations (idempotent)
alter table public.profiles
  add column if not exists training_experience text default 'never',
  add column if not exists sex text,
  add column if not exists bodyweight_lbs numeric,
  add column if not exists height_inches numeric;

alter table public.profiles drop constraint if exists profiles_training_experience_check;
alter table public.profiles
  add constraint profiles_training_experience_check
  check (training_experience in ('never', 'beginner', 'intermediate', 'advanced'));

alter table public.profiles drop constraint if exists profiles_sex_check;
alter table public.profiles
  add constraint profiles_sex_check
  check (sex is null or sex in ('male', 'female'));

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

-- Sex-specific standards (added in a later iteration). The original table
-- only keyed standards by (exercise_name, age_group) — switch to a
-- (exercise_name, age_group, sex) key so we can store separate rows for
-- male and female. Existing rows get sex = 'male'.
alter table public.strength_standards
  add column if not exists sex text not null default 'male';

alter table public.strength_standards
  drop constraint if exists strength_standards_exercise_name_age_group_key;
alter table public.strength_standards
  drop constraint if exists strength_standards_exercise_name_age_group_sex_key;
alter table public.strength_standards
  add constraint strength_standards_exercise_name_age_group_sex_key
  unique (exercise_name, age_group, sex);

alter table public.strength_standards
  drop constraint if exists strength_standards_sex_check;
alter table public.strength_standards
  add constraint strength_standards_sex_check
  check (sex in ('male', 'female'));

-- personal_bests -----------------------------------------------------
create table if not exists public.personal_bests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lift_name text not null check (lift_name in ('bench_press', 'squat', 'deadlift')),
  weight_lbs numeric not null,
  date_achieved date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lift_name)
);
create index if not exists personal_bests_user_id_idx on public.personal_bests(user_id);

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
alter table public.personal_bests   enable row level security;

-- profiles: each user can read/update their own row.
-- Admin reads happen through createSupabaseAdminClient (service-role key)
-- which bypasses RLS, so we deliberately do NOT add an "admin can read all"
-- policy here — that would have to query public.profiles from inside a
-- public.profiles policy and trigger infinite recursion in Postgres RLS.
drop policy if exists "profiles self select"  on public.profiles;
drop policy if exists "profiles admin select" on public.profiles;
drop policy if exists "profiles self update"  on public.profiles;

create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

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

-- personal_bests: each user can manage their own.
drop policy if exists "personal_bests owner all" on public.personal_bests;
create policy "personal_bests owner all" on public.personal_bests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================
-- Seed strength standards (51 exercises × 4 age groups × 2 sexes)
-- Generated from a base of 18-25 male values × age multiplier × sex
-- multiplier per body-zone.
--
-- Plank values are seconds. Push Up / Pull Up / Dips / Nordic Curl
-- / Hanging Leg Raise / Russian Twist / Ab Wheel are reps.
-- =============================================================
with base(muscle_group, exercise_name, zone, b, a, ab, e, el) as (values
  -- Chest
  ('chest',      'Bench Press',                'upper',      135, 185, 235, 290, 350),
  ('chest',      'Incline Bench Press',        'upper',      115, 160, 210, 260, 315),
  ('chest',      'Decline Bench Press',        'upper',      145, 195, 245, 300, 360),
  ('chest',      'Machine Chest Press',        'upper',      130, 180, 230, 285, 345),
  ('chest',      'Pec Deck',                   'upper',       60,  95, 130, 170, 210),
  ('chest',      'Cable Fly',                  'upper',       50,  80, 115, 150, 185),
  ('chest',      'Push Up',                    'bodyweight',  20,  40,  60,  80, 110),
  -- Back
  ('back',       'Pull Up',                    'bodyweight',   0,  25,  60, 100, 145),
  ('back',       'Lat Pulldown',               'upper',      110, 145, 185, 230, 280),
  ('back',       'Cable Row',                  'upper',      110, 145, 185, 230, 280),
  ('back',       'T-Bar Row',                  'upper',      100, 140, 180, 225, 275),
  ('back',       'Barbell Row',                'upper',       95, 145, 195, 245, 305),
  ('back',       'Face Pull',                  'upper',       40,  60,  90, 120, 150),
  ('back',       'Deadlift',                   'lower',      175, 275, 365, 450, 545),
  -- Shoulders
  ('shoulders',  'Lateral Raise',              'upper',       15,  25,  40,  55,  75),
  ('shoulders',  'Front Raise',                'upper',       15,  25,  40,  55,  75),
  ('shoulders',  'Machine Shoulder Press',     'upper',       95, 135, 175, 220, 265),
  ('shoulders',  'Overhead Press',             'upper',       75, 115, 155, 195, 240),
  ('shoulders',  'Arnold Press',               'upper',       50,  80, 115, 150, 185),
  ('shoulders',  'Rear Delt Fly',              'upper',       15,  25,  40,  55,  75),
  -- Biceps
  ('biceps',     'Barbell Curl',               'upper',       55,  80, 110, 145, 185),
  ('biceps',     'Dumbbell Curl',              'upper',       30,  45,  60,  80, 100),
  ('biceps',     'Incline Dumbbell Curl',      'upper',       25,  40,  55,  75,  95),
  ('biceps',     'Hammer Curl',                'upper',       40,  55,  75,  95, 120),
  ('biceps',     'Preacher Curl',              'upper',       50,  75, 100, 130, 165),
  ('biceps',     'Cable Curl',                 'upper',       50,  75, 100, 130, 165),
  -- Triceps
  ('triceps',    'Tricep Pushdown',            'upper',       50,  75, 105, 140, 175),
  ('triceps',    'Overhead Tricep Cable',      'upper',       40,  60,  85, 115, 145),
  ('triceps',    'Skull Crusher',              'upper',       50,  75, 100, 130, 160),
  ('triceps',    'Dumbbell Overhead Extension','upper',       40,  60,  85, 115, 145),
  ('triceps',    'Close Grip Bench Press',     'upper',      115, 165, 215, 270, 325),
  ('triceps',    'Dips',                       'bodyweight',   0,  10,  25,  45,  70),
  -- Quads
  ('quads',      'Squat',                      'lower',      135, 230, 305, 385, 470),
  ('quads',      'Leg Extension',              'lower',       95, 145, 195, 250, 310),
  ('quads',      'Leg Press',                  'lower',      270, 410, 545, 685, 825),
  ('quads',      'Hack Squat',                 'lower',      180, 270, 360, 460, 565),
  ('quads',      'Bulgarian Split Squat',      'lower',       80, 130, 180, 230, 280),
  -- Hamstrings
  ('hamstrings', 'Hamstring Curl',             'lower',       75, 115, 155, 200, 245),
  ('hamstrings', 'Romanian Deadlift',          'lower',      135, 205, 275, 350, 425),
  ('hamstrings', 'Good Morning',               'lower',       95, 145, 195, 245, 305),
  ('hamstrings', 'Nordic Curl',                'bodyweight',   3,   5,  10,  15,  20),
  -- Glutes
  ('glutes',     'Hip Thrust',                 'lower',      185, 275, 360, 450, 545),
  ('glutes',     'Glute Bridge',               'lower',      135, 200, 265, 335, 405),
  ('glutes',     'Cable Kickback',             'lower',       30,  50,  70,  95, 120),
  ('glutes',     'Abductor Machine',           'lower',       90, 135, 180, 230, 280),
  -- Calves
  ('calves',     'Standing Calf Raise',        'lower',       95, 165, 225, 295, 365),
  ('calves',     'Seated Calf Raise',          'lower',       70, 110, 150, 200, 250),
  ('calves',     'Leg Press Calf Raise',       'lower',      180, 270, 360, 460, 565),
  -- Abs
  ('abs',        'Ab Crunch Machine',          'upper',       80, 130, 180, 230, 290),
  ('abs',        'Plank',                      'endurance',   30,  60, 120, 240, 360),
  ('abs',        'Cable Crunch',               'upper',       90, 135, 180, 230, 280),
  ('abs',        'Hanging Leg Raise',          'endurance',    5,  10,  20,  30,  50),
  ('abs',        'Russian Twist',              'endurance',   20,  40,  60,  80, 100),
  ('abs',        'Ab Wheel',                   'endurance',    5,  10,  20,  30,  50)
),
demos(age_group, age_mult) as (values
  ('18-25', 1.00::numeric),
  ('26-35', 1.00::numeric),
  ('36-45', 0.92::numeric),
  ('46+',   0.80::numeric)
),
sexes(sex) as (values ('male'), ('female')),
sex_mults(zone, sex, sm) as (values
  ('upper',      'male',   1.00::numeric),
  ('lower',      'male',   1.00::numeric),
  ('bodyweight', 'male',   1.00::numeric),
  ('endurance',  'male',   1.00::numeric),
  ('upper',      'female', 0.65::numeric),
  ('lower',      'female', 0.75::numeric),
  ('bodyweight', 'female', 0.55::numeric),
  ('endurance',  'female', 0.85::numeric)
)
insert into public.strength_standards
  (muscle_group, exercise_name, age_group, sex,
   below_average_lbs, average_lbs, above_average_lbs, exceptional_lbs, elite_lbs)
select
  base.muscle_group,
  base.exercise_name,
  demos.age_group,
  sexes.sex,
  greatest(0, round(base.b  * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.a  * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.ab * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.e  * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.el * demos.age_mult * sex_mults.sm))
from base
cross join demos
cross join sexes
join sex_mults on sex_mults.zone = base.zone and sex_mults.sex = sexes.sex
on conflict (exercise_name, age_group, sex) do update set
  muscle_group        = excluded.muscle_group,
  below_average_lbs   = excluded.below_average_lbs,
  average_lbs         = excluded.average_lbs,
  above_average_lbs   = excluded.above_average_lbs,
  exceptional_lbs     = excluded.exceptional_lbs,
  elite_lbs           = excluded.elite_lbs;

-- =============================================================
-- Steps + Nutrition tracking
-- =============================================================
create table if not exists public.daily_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  steps integer not null default 0,
  goal integer not null default 10000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists daily_steps_user_id_idx on public.daily_steps(user_id);
create index if not exists daily_steps_date_idx on public.daily_steps(date);

create table if not exists public.step_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  daily_goal integer not null default 10000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_nutrition (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  calories integer not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists daily_nutrition_user_id_idx on public.daily_nutrition(user_id);
create index if not exists daily_nutrition_date_idx on public.daily_nutrition(date);

create table if not exists public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  calorie_goal integer not null default 2000,
  protein_goal_g numeric,
  carbs_goal_g numeric,
  fat_goal_g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_steps      enable row level security;
alter table public.step_goals       enable row level security;
alter table public.daily_nutrition  enable row level security;
alter table public.nutrition_goals  enable row level security;

drop policy if exists "daily_steps owner all" on public.daily_steps;
create policy "daily_steps owner all" on public.daily_steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "step_goals owner all" on public.step_goals;
create policy "step_goals owner all" on public.step_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_nutrition owner all" on public.daily_nutrition;
create policy "daily_nutrition owner all" on public.daily_nutrition
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nutrition_goals owner all" on public.nutrition_goals;
create policy "nutrition_goals owner all" on public.nutrition_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================
-- After running this:
-- 1. In Supabase Auth, create your first user (Authentication > Users > Add user).
-- 2. Promote them to admin:
--      update public.profiles set role = 'admin' where id = '<that-user-id>';
-- =============================================================
