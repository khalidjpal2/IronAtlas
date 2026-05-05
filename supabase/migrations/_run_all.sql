-- ──────────────────────────────────────────────────────────────────
-- IronAtlas — combined migration script.
-- Idempotent. Paste the whole thing into the Supabase SQL editor
-- (Project → SQL → New query → Run). Re-runs are safe.
-- ──────────────────────────────────────────────────────────────────

-- 1) daily_nutrition (one row per user/date — totals only)
create table if not exists public.daily_nutrition (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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
alter table public.daily_nutrition enable row level security;
drop policy if exists "owner all daily_nutrition" on public.daily_nutrition;
create policy "owner all daily_nutrition"
  on public.daily_nutrition
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) nutrition_goals.mode (bulk / cut / maintain) + per-macro direction
alter table public.nutrition_goals
  add column if not exists mode text not null default 'maintain';
alter table public.nutrition_goals
  drop constraint if exists nutrition_goals_mode_check;
alter table public.nutrition_goals
  add constraint nutrition_goals_mode_check
  check (mode in ('bulk', 'cut', 'maintain'));

-- Per-macro direction — what "going over" means for each macro.
-- POSITIVE = over goal is good, NEGATIVE = over goal is bad,
-- NEUTRAL = closeness-to-goal is best.
alter table public.nutrition_goals
  add column if not exists protein_direction text not null default 'positive';
alter table public.nutrition_goals
  add column if not exists carbs_direction text not null default 'neutral';
alter table public.nutrition_goals
  add column if not exists fat_direction text not null default 'neutral';
alter table public.nutrition_goals
  drop constraint if exists nutrition_goals_protein_direction_check;
alter table public.nutrition_goals
  drop constraint if exists nutrition_goals_carbs_direction_check;
alter table public.nutrition_goals
  drop constraint if exists nutrition_goals_fat_direction_check;
alter table public.nutrition_goals
  add constraint nutrition_goals_protein_direction_check
  check (protein_direction in ('negative', 'neutral', 'positive'));
alter table public.nutrition_goals
  add constraint nutrition_goals_carbs_direction_check
  check (carbs_direction in ('negative', 'neutral', 'positive'));
alter table public.nutrition_goals
  add constraint nutrition_goals_fat_direction_check
  check (fat_direction in ('negative', 'neutral', 'positive'));

-- 3) daily_quests
create table if not exists public.daily_quests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  quest_atlas text,
  quest_journey text,
  quest_sustenance text,
  atlas_done boolean not null default false,
  journey_done boolean not null default false,
  sustenance_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists daily_quests_user_date_idx
  on public.daily_quests(user_id, date desc);
alter table public.daily_quests enable row level security;
drop policy if exists "owner all daily_quests" on public.daily_quests;
create policy "owner all daily_quests"
  on public.daily_quests
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) achievements
create table if not exists public.achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
create index if not exists achievements_user_idx
  on public.achievements(user_id, earned_at desc);
alter table public.achievements enable row level security;
drop policy if exists "owner all achievements" on public.achievements;
create policy "owner all achievements"
  on public.achievements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5) profiles.daily_workout_goal
alter table public.profiles
  add column if not exists daily_workout_goal text not null default 'any';
alter table public.profiles
  drop constraint if exists profiles_daily_workout_goal_check;
alter table public.profiles
  add constraint profiles_daily_workout_goal_check
  check (daily_workout_goal in ('any', 'sets_3', 'sets_5', 'sets_10'));

-- 6) personal_bests — broaden to include endurance + athleticism
alter table public.personal_bests
  drop constraint if exists personal_bests_lift_name_check;
alter table public.personal_bests
  add column if not exists record_type text not null default 'strength';
alter table public.personal_bests
  add column if not exists time_seconds integer;
alter table public.personal_bests
  drop constraint if exists personal_bests_record_type_check;
alter table public.personal_bests
  add constraint personal_bests_record_type_check
  check (record_type in ('strength', 'endurance', 'athleticism'));
alter table public.personal_bests
  add constraint personal_bests_lift_name_check
  check (lift_name in (
    'bench_press', 'squat', 'deadlift',
    'mile_run', '5k_run', '10k_run',
    'vertical_jump'
  ));

-- 7) step_goals.personal_goal — tiered Journey scoring (10k base + user goal)
alter table public.step_goals
  add column if not exists personal_goal integer default 20000;

-- 8) workout_presets + preset_exercises (saved workout routines)
create table if not exists public.workout_presets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
create table if not exists public.preset_exercises (
  id uuid default gen_random_uuid() primary key,
  preset_id uuid references public.workout_presets(id) on delete cascade not null,
  exercise_name text not null,
  muscle_group text not null,
  sort_order integer default 0
);
create index if not exists workout_presets_user_id_idx
  on public.workout_presets (user_id);
create index if not exists preset_exercises_preset_id_idx
  on public.preset_exercises (preset_id, sort_order);
alter table public.workout_presets enable row level security;
alter table public.preset_exercises enable row level security;
drop policy if exists "owner all workout_presets" on public.workout_presets;
create policy "owner all workout_presets"
  on public.workout_presets for all
  using (auth.uid() = user_id);
drop policy if exists "owner all preset_exercises" on public.preset_exercises;
create policy "owner all preset_exercises"
  on public.preset_exercises for all
  using (auth.uid() = (
    select user_id from public.workout_presets where id = preset_id
  ));

-- 9) workout_sets.primary_muscle (precomputed primary muscle per set)
alter table public.workout_sets
  add column if not exists primary_muscle text;

-- 10) Strength standards for the recently-added exercises.
--     IMPORTANT: this is what unblocks the Atlas heatmap update for
--     newly-logged sets — without standards, computeLevels skips them
--     entirely. Mirrors the cross-join pattern in seed_standards.sql.
with base(muscle_group, exercise_name, zone, b, a, ab, e, el) as (values
  ('chest',      'Incline Press',                 'upper',      115, 160, 210, 260, 315),
  ('chest',      'Decline Press',                 'upper',      145, 195, 245, 300, 360),
  ('back',       'Lat Pulldown (Machine)',        'upper',      110, 145, 185, 230, 280),
  ('back',       'Seated Machine Row',            'upper',      110, 145, 185, 230, 280),
  ('back',       'Chest Supported T-Bar Row',     'upper',       95, 135, 180, 230, 280),
  ('back',       'Seated Chest Supported Row',    'upper',      100, 140, 180, 225, 275),
  ('back',       'Seated Neutral Row',            'upper',      100, 140, 180, 225, 275),
  ('back',       'Reverse Fly',                   'upper',       15,  25,  40,  55,  75),
  ('back',       'Shrugs',                        'upper',      135, 185, 245, 315, 405),
  ('back',       'Prone Y-Raise',                 'upper',        5,  10,  15,  25,  35),
  ('back',       'Back Extension',                'lower',       25,  45,  70, 100, 135),
  ('triceps',    'Cable Pushdown',                'upper',       50,  75, 105, 140, 175),
  ('triceps',    'Overhead Cable Rope Extension', 'upper',       35,  55,  80, 110, 140),
  ('hamstrings', 'Seated Leg Curl',               'lower',       75, 115, 155, 200, 245),
  ('calves',     'Tibialis Raise',                'lower',       25,  45,  65,  90, 120),
  ('glutes',     'Clam Shell',                    'bodyweight',   0,   5,  10,  20,  35),
  ('glutes',     'Side-Lying Hip Raise',          'bodyweight',   0,   5,  10,  20,  35),
  ('glutes',     'Adductor Machine',              'lower',       90, 135, 180, 230, 280),
  ('forearms',   'Wrist Curl',                    'upper',       30,  50,  75, 100, 130),
  ('forearms',   'Reverse Curl',                  'upper',       25,  45,  65,  90, 115)
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

-- ── Verification ────────────────────────────────────────────────
select 'daily_nutrition' as obj,
       (to_regclass('public.daily_nutrition') is not null) as exists
union all select 'nutrition_goals.mode',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='nutrition_goals'
           and column_name='mode'
       )
union all select 'daily_quests',
       (to_regclass('public.daily_quests') is not null)
union all select 'achievements',
       (to_regclass('public.achievements') is not null)
union all select 'profiles.daily_workout_goal',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='profiles'
           and column_name='daily_workout_goal'
       )
union all select 'nutrition_goals.protein_direction',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='nutrition_goals'
           and column_name='protein_direction'
       )
union all select 'nutrition_goals.carbs_direction',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='nutrition_goals'
           and column_name='carbs_direction'
       )
union all select 'nutrition_goals.fat_direction',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='nutrition_goals'
           and column_name='fat_direction'
       )
union all select 'personal_bests.record_type',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='personal_bests'
           and column_name='record_type'
       )
union all select 'personal_bests.time_seconds',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='personal_bests'
           and column_name='time_seconds'
       )
union all select 'step_goals.personal_goal',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='step_goals'
           and column_name='personal_goal'
       )
union all select 'workout_presets',
       (to_regclass('public.workout_presets') is not null)
union all select 'preset_exercises',
       (to_regclass('public.preset_exercises') is not null)
union all select 'workout_sets.primary_muscle',
       exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='workout_sets'
           and column_name='primary_muscle'
       )
union all select 'standards: Chest Supported T-Bar Row',
       exists (
         select 1 from public.strength_standards
         where exercise_name = 'Chest Supported T-Bar Row'
       )
union all select 'standards: Tibialis Raise',
       exists (
         select 1 from public.strength_standards
         where exercise_name = 'Tibialis Raise'
       );
