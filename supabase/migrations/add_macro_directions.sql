-- Per-macro direction — what "going over" means for each macro.
-- Used by the Sustenance score so the user's intent (bulk vs cut vs
-- hit-the-mark) is judged correctly per macro, not just per calorie.

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
