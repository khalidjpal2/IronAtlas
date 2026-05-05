-- Adds the per-user "personal goal" column used by the tiered Journey
-- scoring system. Base goal is fixed at 10,000 in code; personal goal
-- defaults to 20,000 and must be > 10,000 (enforced server-side).

alter table public.step_goals
  add column if not exists personal_goal integer default 20000;
