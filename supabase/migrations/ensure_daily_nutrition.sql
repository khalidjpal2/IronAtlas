-- Ensures the per-day totals table exists. Safe to re-run.
-- This is the canonical home for nutrition data going forward; the
-- earlier `meal_entries` design has been retired in favour of single
-- daily totals.

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
