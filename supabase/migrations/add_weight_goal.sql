-- Persistent weight goal stored on the user's profile. Used by the
-- Scales page to project required daily calorie balance and compare
-- against the user's actual 14-day pace.

alter table public.profiles
  add column if not exists weight_goal_lbs numeric
    check (weight_goal_lbs is null or (weight_goal_lbs > 0 and weight_goal_lbs < 2000));

alter table public.profiles
  add column if not exists weight_goal_date date;
