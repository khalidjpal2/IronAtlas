-- Adds the bulk/cut/maintain mode column used by the Sustenance score.
-- Defaults to 'maintain' so existing rows keep working unchanged.

alter table public.nutrition_goals
  add column if not exists mode text not null default 'maintain';

alter table public.nutrition_goals
  drop constraint if exists nutrition_goals_mode_check;

alter table public.nutrition_goals
  add constraint nutrition_goals_mode_check
  check (mode in ('bulk', 'cut', 'maintain'));
