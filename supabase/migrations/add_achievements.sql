-- Earned-only ledger. A row exists iff the user has earned that badge.
-- Badge IDs are string keys defined in lib/badges.ts. Awarding is done
-- server-side on each dashboard load by inserting any newly-qualified
-- badge IDs (insert ... on conflict do nothing).

create table if not exists public.achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index if not exists achievements_user_idx
  on public.achievements(user_id, earned_at desc);

alter table public.achievements enable row level security;

drop policy if exists "achievements_owner" on public.achievements;
create policy "achievements_owner"
  on public.achievements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
