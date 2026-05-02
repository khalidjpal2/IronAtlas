export type StrengthLevel =
  | "untrained"
  | "below"
  | "average"
  | "above"
  | "exceptional"
  | "elite";

export const LEVEL_COLOR: Record<StrengthLevel, string> = {
  untrained: "#6b7280",
  below: "#3b82f6",
  average: "#22c55e",
  above: "#eab308",
  exceptional: "#f97316",
  elite: "#a855f7",
};

export const LEVEL_LABEL: Record<StrengthLevel, string> = {
  untrained: "Untrained",
  below: "Below Average",
  average: "Average",
  above: "Above Average",
  exceptional: "Exceptional",
  elite: "Elite",
};

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type StandardRow = {
  muscle_group: string;
  exercise_name: string;
  age_group: string;
  below_average_lbs: number;
  average_lbs: number;
  above_average_lbs: number;
  exceptional_lbs: number;
  elite_lbs: number;
};

export function levelForLift(lift: number, std: StandardRow): StrengthLevel {
  if (lift <= 0) return "untrained";
  if (lift >= std.elite_lbs) return "elite";
  if (lift >= std.exceptional_lbs) return "exceptional";
  if (lift >= std.above_average_lbs) return "above";
  if (lift >= std.average_lbs) return "average";
  if (lift >= std.below_average_lbs) return "below";
  return "untrained";
}

export const EXERCISE_OPTIONS: { name: string; muscle: MuscleGroup }[] = [
  { name: "Bench Press", muscle: "chest" },
  { name: "Overhead Press", muscle: "shoulders" },
  { name: "Barbell Row", muscle: "back" },
  { name: "Pull Up", muscle: "back" },
  { name: "Barbell Curl", muscle: "biceps" },
  { name: "Tricep Pushdown", muscle: "triceps" },
  { name: "Squat", muscle: "quads" },
  { name: "Romanian Deadlift", muscle: "hamstrings" },
  { name: "Hip Thrust", muscle: "glutes" },
  { name: "Calf Raise", muscle: "calves" },
  { name: "Plank", muscle: "abs" },
];
