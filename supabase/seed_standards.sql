-- =============================================================
-- IronAtlas — strength_standards seed
-- Idempotent. Safe to re-run.
--
-- Generates 51 exercises × 4 age groups × 2 sexes = 408 rows.
-- Base values are 18-25 male; the CTE applies an age multiplier
-- and a per-zone sex multiplier so all 8 demographic combos are
-- derived consistently.
--
-- Run order:
--   1) The ALTER block adds the `sex` column + the new
--      (exercise_name, age_group, sex) unique constraint.
--   2) The INSERT populates / refreshes every row.
-- =============================================================

-- 1. Schema upgrades --------------------------------------------------
alter table public.strength_standards
  add column if not exists sex text not null default 'male';

alter table public.strength_standards
  drop constraint if exists strength_standards_exercise_name_age_group_key;
alter table public.strength_standards
  drop constraint if exists strength_standards_exercise_name_age_group_sex_key;
alter table public.strength_standards
  add constraint strength_standards_exercise_name_age_group_sex_key
  unique (exercise_name, age_group, sex);

alter table public.strength_standards
  drop constraint if exists strength_standards_sex_check;
alter table public.strength_standards
  add constraint strength_standards_sex_check
  check (sex in ('male', 'female'));

-- 2. Seed -------------------------------------------------------------
with base(muscle_group, exercise_name, zone, b, a, ab, e, el) as (values
  -- Chest
  ('chest',      'Bench Press',                'upper',      135, 185, 235, 290, 350),
  ('chest',      'Incline Bench Press',        'upper',      115, 160, 210, 260, 315),
  ('chest',      'Decline Bench Press',        'upper',      145, 195, 245, 300, 360),
  ('chest',      'Machine Chest Press',        'upper',      130, 180, 230, 285, 345),
  ('chest',      'Pec Deck',                   'upper',       60,  95, 130, 170, 210),
  ('chest',      'Cable Fly',                  'upper',       50,  80, 115, 150, 185),
  ('chest',      'Push Up',                    'bodyweight',  20,  40,  60,  80, 110),
  -- Back
  ('back',       'Pull Up',                    'bodyweight',   0,  25,  60, 100, 145),
  ('back',       'Lat Pulldown',               'upper',      110, 145, 185, 230, 280),
  ('back',       'Cable Row',                  'upper',      110, 145, 185, 230, 280),
  ('back',       'T-Bar Row',                  'upper',      100, 140, 180, 225, 275),
  ('back',       'Barbell Row',                'upper',       95, 145, 195, 245, 305),
  ('back',       'Face Pull',                  'upper',       40,  60,  90, 120, 150),
  ('back',       'Deadlift',                   'lower',      175, 275, 365, 450, 545),
  -- Shoulders
  ('shoulders',  'Lateral Raise',              'upper',       15,  25,  40,  55,  75),
  ('shoulders',  'Front Raise',                'upper',       15,  25,  40,  55,  75),
  ('shoulders',  'Machine Shoulder Press',     'upper',       95, 135, 175, 220, 265),
  ('shoulders',  'Overhead Press',             'upper',       75, 115, 155, 195, 240),
  ('shoulders',  'Arnold Press',               'upper',       50,  80, 115, 150, 185),
  ('shoulders',  'Rear Delt Fly',              'upper',       15,  25,  40,  55,  75),
  -- Biceps
  ('biceps',     'Barbell Curl',               'upper',       55,  80, 110, 145, 185),
  ('biceps',     'Dumbbell Curl',              'upper',       30,  45,  60,  80, 100),
  ('biceps',     'Incline Dumbbell Curl',      'upper',       25,  40,  55,  75,  95),
  ('biceps',     'Hammer Curl',                'upper',       40,  55,  75,  95, 120),
  ('biceps',     'Preacher Curl',              'upper',       50,  75, 100, 130, 165),
  ('biceps',     'Cable Curl',                 'upper',       50,  75, 100, 130, 165),
  -- Triceps
  ('triceps',    'Tricep Pushdown',            'upper',       50,  75, 105, 140, 175),
  ('triceps',    'Overhead Tricep Cable',      'upper',       40,  60,  85, 115, 145),
  ('triceps',    'Skull Crusher',              'upper',       50,  75, 100, 130, 160),
  ('triceps',    'Dumbbell Overhead Extension','upper',       40,  60,  85, 115, 145),
  ('triceps',    'Close Grip Bench Press',     'upper',      115, 165, 215, 270, 325),
  ('triceps',    'Dips',                       'bodyweight',   0,  10,  25,  45,  70),
  -- Quads
  ('quads',      'Squat',                      'lower',      135, 230, 305, 385, 470),
  ('quads',      'Leg Extension',              'lower',       95, 145, 195, 250, 310),
  ('quads',      'Leg Press',                  'lower',      270, 410, 545, 685, 825),
  ('quads',      'Hack Squat',                 'lower',      180, 270, 360, 460, 565),
  ('quads',      'Bulgarian Split Squat',      'lower',       80, 130, 180, 230, 280),
  -- Hamstrings
  ('hamstrings', 'Hamstring Curl',             'lower',       75, 115, 155, 200, 245),
  ('hamstrings', 'Romanian Deadlift',          'lower',      135, 205, 275, 350, 425),
  ('hamstrings', 'Good Morning',               'lower',       95, 145, 195, 245, 305),
  ('hamstrings', 'Nordic Curl',                'bodyweight',   3,   5,  10,  15,  20),
  -- Glutes
  ('glutes',     'Hip Thrust',                 'lower',      185, 275, 360, 450, 545),
  ('glutes',     'Glute Bridge',               'lower',      135, 200, 265, 335, 405),
  ('glutes',     'Cable Kickback',             'lower',       30,  50,  70,  95, 120),
  ('glutes',     'Abductor Machine',           'lower',       90, 135, 180, 230, 280),
  -- Calves
  ('calves',     'Standing Calf Raise',        'lower',       95, 165, 225, 295, 365),
  ('calves',     'Seated Calf Raise',          'lower',       70, 110, 150, 200, 250),
  ('calves',     'Leg Press Calf Raise',       'lower',      180, 270, 360, 460, 565),
  -- Abs
  ('abs',        'Ab Crunch Machine',          'upper',       80, 130, 180, 230, 290),
  ('abs',        'Plank',                      'endurance',   30,  60, 120, 240, 360),
  ('abs',        'Cable Crunch',               'upper',       90, 135, 180, 230, 280),
  ('abs',        'Hanging Leg Raise',          'endurance',    5,  10,  20,  30,  50),
  ('abs',        'Russian Twist',              'endurance',   20,  40,  60,  80, 100),
  ('abs',        'Ab Wheel',                   'endurance',    5,  10,  20,  30,  50)
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
