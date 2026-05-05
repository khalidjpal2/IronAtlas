-- Strength standards for the back/biceps/triceps/chest/shoulders/legs
-- additions in lib/strength.ts. Idempotent — re-running upserts the
-- same values. Mirrors the cross-join pattern in seed_standards.sql so
-- one row per (exercise, age_group, sex) gets generated for each new
-- exercise (18 × 4 × 2 = 144 rows).

with base(muscle_group, exercise_name, zone, b, a, ab, e, el) as (values
  -- Chest
  ('chest',      'Incline Press',                 'upper',      115, 160, 210, 260, 315),
  ('chest',      'Decline Press',                 'upper',      145, 195, 245, 300, 360),
  -- Back
  ('back',       'Lat Pulldown (Machine)',        'upper',      110, 145, 185, 230, 280),
  ('back',       'Seated Machine Row',            'upper',      110, 145, 185, 230, 280),
  ('back',       'Chest Supported T-Bar Row',     'upper',       95, 135, 180, 230, 280),
  ('back',       'Seated Chest Supported Row',    'upper',      100, 140, 180, 225, 275),
  ('back',       'Seated Neutral Row',            'upper',      100, 140, 180, 225, 275),
  ('back',       'Reverse Fly',                   'upper',       15,  25,  40,  55,  75),
  ('back',       'Shrugs',                        'upper',      135, 185, 245, 315, 405),
  ('back',       'Prone Y-Raise',                 'upper',        5,  10,  15,  25,  35),
  ('back',       'Back Extension',                'lower',       25,  45,  70, 100, 135),
  -- Triceps
  ('triceps',    'Cable Pushdown',                'upper',       50,  75, 105, 140, 175),
  ('triceps',    'Overhead Cable Rope Extension', 'upper',       35,  55,  80, 110, 140),
  -- Hamstrings
  ('hamstrings', 'Seated Leg Curl',               'lower',       75, 115, 155, 200, 245),
  -- Calves
  ('calves',     'Tibialis Raise',                'lower',       25,  45,  65,  90, 120),
  -- Forearms
  ('forearms',   'Wrist Curl',                    'upper',       30,  50,  75, 100, 130),
  ('forearms',   'Reverse Curl',                  'upper',       25,  45,  65,  90, 115),
  -- Glutes
  ('glutes',     'Clam Shell',                    'bodyweight',   0,   5,  10,  20,  35),
  ('glutes',     'Side-Lying Hip Raise',          'bodyweight',   0,   5,  10,  20,  35),
  ('glutes',     'Adductor Machine',              'lower',       90, 135, 180, 230, 280)
),
demos(age_group, age_mult) as (values
  ('18-25', 1.00::numeric),
  ('26-35', 1.00::numeric),
  ('36-45', 0.92::numeric),
  ('46+',   0.80::numeric)
),
sexes(sex) as (values ('male'), ('female')),
sex_mults(zone, sex, sm) as (values
  ('upper',      'male',   1.00::numeric),
  ('lower',      'male',   1.00::numeric),
  ('bodyweight', 'male',   1.00::numeric),
  ('endurance',  'male',   1.00::numeric),
  ('upper',      'female', 0.65::numeric),
  ('lower',      'female', 0.75::numeric),
  ('bodyweight', 'female', 0.55::numeric),
  ('endurance',  'female', 0.85::numeric)
)
insert into public.strength_standards
  (muscle_group, exercise_name, age_group, sex,
   below_average_lbs, average_lbs, above_average_lbs, exceptional_lbs, elite_lbs)
select
  base.muscle_group,
  base.exercise_name,
  demos.age_group,
  sexes.sex,
  greatest(0, round(base.b  * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.a  * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.ab * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.e  * demos.age_mult * sex_mults.sm)),
  greatest(0, round(base.el * demos.age_mult * sex_mults.sm))
from base
cross join demos
cross join sexes
join sex_mults on sex_mults.zone = base.zone and sex_mults.sex = sexes.sex
on conflict (exercise_name, age_group, sex) do update set
  muscle_group        = excluded.muscle_group,
  below_average_lbs   = excluded.below_average_lbs,
  average_lbs         = excluded.average_lbs,
  above_average_lbs   = excluded.above_average_lbs,
  exceptional_lbs     = excluded.exceptional_lbs,
  elite_lbs           = excluded.elite_lbs;
