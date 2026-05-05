-- Workout presets — user-defined collections of exercises that get
-- played back as a "session" against today's date. Two tables:
--   workout_presets        : header (name, owner)
--   preset_exercises       : ordered exercises per preset
--
-- Idempotent: re-running drops + recreates the policies but never
-- destroys data.

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
