-- One row per (user, date). The three quest_* columns store the picked
-- quest IDs; the *_done flags are recomputed from logged data on every
-- dashboard load. Server upserts this row to record which quests the
-- user saw on a given day so the picks stay stable across page reloads.

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  quest_atlas text not null,
  quest_journey text not null,
  quest_sustenance text not null,
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

drop policy if exists "daily_quests_owner" on public.daily_quests;
create policy "daily_quests_owner"
  on public.daily_quests
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
