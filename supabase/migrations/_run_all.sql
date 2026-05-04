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
       );
