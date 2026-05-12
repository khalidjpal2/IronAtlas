-- Link a saved preset to a scheduled day. The schedule row stores the
-- preset_id; deleting the preset clears the link (on delete set null)
-- so the schedule row keeps its workout_type / is_rest values.

alter table public.workout_schedule
  add column if not exists preset_id uuid
    references public.workout_presets(id) on delete set null;

create index if not exists workout_schedule_preset_idx
  on public.workout_schedule (preset_id);
