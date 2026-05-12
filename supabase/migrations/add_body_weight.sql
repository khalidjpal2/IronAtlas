-- Body-weight log for the Scales page. One row per (user, date);
-- inserting again on the same date overwrites (upsert). Cascades on
-- profile delete so leaving the app removes the data cleanly.

create table if not exists public.body_weight (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  weight_lbs numeric not null check (weight_lbs > 0 and weight_lbs < 2000),
  date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists body_weight_user_date_idx
  on public.body_weight (user_id, date desc);

alter table public.body_weight enable row level security;

drop policy if exists "owner all body_weight" on public.body_weight;
create policy "owner all body_weight"
  on public.body_weight
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
