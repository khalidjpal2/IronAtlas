-- IronAtlas — steps + nutrition tables
-- Idempotent. Run once in the Supabase SQL editor.

-- ────────────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────
-- RLS — each user only sees their own rows
-- ────────────────────────────────────────────────────────────────
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
