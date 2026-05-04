-- Expand personal_bests to cover endurance (run times) and athleticism
-- (vertical jump). Drops the existing big-three-only check, adds the
-- new lift_name values, and introduces record_type + time_seconds.

alter table public.personal_bests
  drop constraint if exists personal_bests_lift_name_check;

alter table public.personal_bests
  add column if not exists record_type text not null default 'strength';

alter table public.personal_bests
  add column if not exists time_seconds integer;

alter table public.personal_bests
  drop constraint if exists personal_bests_record_type_check;

alter table public.personal_bests
  add constraint personal_bests_record_type_check
  check (record_type in ('strength', 'endurance', 'athleticism'));

alter table public.personal_bests
  add constraint personal_bests_lift_name_check
  check (lift_name in (
    'bench_press', 'squat', 'deadlift',
    'mile_run', '5k_run', '10k_run',
    'vertical_jump'
  ));
