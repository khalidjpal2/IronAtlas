import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "./supabase-server";
import {
  AGE_GROUPS,
  TRAINING_EXPERIENCES,
  type AgeGroup,
  type Sex,
  type TrainingExperience,
} from "./strength";

/**
 * Single source of truth for the current user's profile data. Every
 * page/route that needs profile fields must call this — never read the
 * profiles table directly. That guarantees:
 *
 *   1. The read bypasses Next.js's data cache (noStore()), so a fresh
 *      save is reflected on the very next render.
 *   2. The read uses the service-role client (no RLS surprises after
 *      the recent recursion fix).
 *   3. Every consumer sees the same normalized UserProfile shape with
 *      a single `isComplete` flag — no more bespoke completeness checks.
 */

export type WorkoutGoal = "any" | "sets_3" | "sets_5" | "sets_10";

export type UserProfile = {
  id: string;
  username: string;
  role: "user" | "admin";
  ageGroup: AgeGroup;
  sex: Sex | null;
  bodyweight: number | null;
  height: number | null;
  experience: TrainingExperience;
  /**
   * Daily workout goal — drives the Atlas pillar quest. Defaults to
   * "any" (log at least 1 exercise) so existing accounts immediately
   * have a low-friction goal to clear.
   */
  workoutGoal: WorkoutGoal;
  /**
   * True if every field the rest of the app cares about is explicitly
   * set: bodyweight_lbs, sex, age_group, training_experience.
   * (age_group + training_experience have DB defaults so are never NULL
   * after a save — but we still check them so the rule is uniform.)
   */
  isComplete: boolean;
};

const WORKOUT_GOALS: readonly WorkoutGoal[] = [
  "any",
  "sets_3",
  "sets_5",
  "sets_10",
] as const;

export async function loadProfile(
  userId: string,
  fallbackUsername: string
): Promise<UserProfile> {
  noStore();

  const admin = createSupabaseAdminClient();
  let { data, error } = await admin
    .from("profiles")
    .select(
      "id, username, role, age_group, sex, bodyweight_lbs, height_inches, training_experience, daily_workout_goal"
    )
    .eq("id", userId)
    .maybeSingle();

  // If `daily_workout_goal` column doesn't exist yet, retry with the
  // legacy column set so the app still loads.
  if (error && /daily_workout_goal/i.test(error.message)) {
    const legacy = await admin
      .from("profiles")
      .select(
        "id, username, role, age_group, sex, bodyweight_lbs, height_inches, training_experience"
      )
      .eq("id", userId)
      .maybeSingle();
    data = legacy.data as any;
    error = legacy.error;
  }

  if (error) {
    console.error(`[loadProfile] error for user=${userId}:`, error);
  }

  const ageGroupRaw = data?.age_group ?? "18-25";
  const ageGroup: AgeGroup = AGE_GROUPS.includes(ageGroupRaw as AgeGroup)
    ? (ageGroupRaw as AgeGroup)
    : "18-25";

  const expRaw = data?.training_experience ?? "never";
  const experience: TrainingExperience = TRAINING_EXPERIENCES.includes(
    expRaw as TrainingExperience
  )
    ? (expRaw as TrainingExperience)
    : "never";

  const sex: Sex | null =
    data?.sex === "male" || data?.sex === "female" ? data.sex : null;

  const bodyweight =
    data?.bodyweight_lbs != null ? Number(data.bodyweight_lbs) : null;
  const height =
    data?.height_inches != null ? Number(data.height_inches) : null;

  const isComplete =
    data?.bodyweight_lbs != null &&
    data?.sex != null &&
    data?.age_group != null &&
    data?.training_experience != null;

  const wgRaw = (data as any)?.daily_workout_goal ?? "any";
  const workoutGoal: WorkoutGoal = WORKOUT_GOALS.includes(wgRaw as WorkoutGoal)
    ? (wgRaw as WorkoutGoal)
    : "any";

  const profile: UserProfile = {
    id: userId,
    username: data?.username ?? fallbackUsername,
    role: data?.role === "admin" ? "admin" : "user",
    ageGroup,
    sex,
    bodyweight,
    height,
    experience,
    workoutGoal,
    isComplete,
  };

  console.log(`[loadProfile] user=${userId}`, {
    ageGroup: profile.ageGroup,
    sex: profile.sex,
    bodyweight: profile.bodyweight,
    height: profile.height,
    experience: profile.experience,
    isComplete: profile.isComplete,
  });

  return profile;
}
