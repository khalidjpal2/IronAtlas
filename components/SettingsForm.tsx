"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
  AGE_GROUPS,
  EXPERIENCE_LABEL,
  SEX_LABEL,
  TRAINING_EXPERIENCES,
  type AgeGroup,
  type Sex,
  type TrainingExperience,
} from "@/lib/strength";

export type WorkoutGoalChoice = "any" | "sets_3" | "sets_5" | "sets_10";

const WORKOUT_GOAL_LABEL: Record<WorkoutGoalChoice, string> = {
  any: "Log any workout",
  sets_3: "Log 3+ sets",
  sets_5: "Log 5+ sets",
  sets_10: "Log 10+ sets",
};
const WORKOUT_GOAL_OPTIONS: WorkoutGoalChoice[] = [
  "any",
  "sets_3",
  "sets_5",
  "sets_10",
];

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  initialAgeGroup: string;
  initialSex: Sex | null;
  initialBodyweight: number | null;
  initialHeight: number | null;
  initialExperience: TrainingExperience;
  initialWorkoutGoal: WorkoutGoalChoice;
};

type ServerError = {
  stage?: string;
  error?: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export default function SettingsForm({
  userId,
  username,
  isAdmin,
  initialAgeGroup,
  initialSex,
  initialBodyweight,
  initialHeight,
  initialExperience,
  initialWorkoutGoal,
}: Props) {
  const router = useRouter();

  console.log("[SettingsForm] initial props:", {
    initialAgeGroup,
    initialSex,
    initialBodyweight,
    initialHeight,
    initialExperience,
    initialWorkoutGoal,
  });

  const [ageGroup, setAgeGroup] = useState<AgeGroup>(
    (AGE_GROUPS.includes(initialAgeGroup as AgeGroup)
      ? (initialAgeGroup as AgeGroup)
      : "18-25") as AgeGroup
  );
  const [sex, setSex] = useState<Sex | "">(initialSex ?? "");
  const [bodyweight, setBodyweight] = useState(
    initialBodyweight != null ? String(initialBodyweight) : ""
  );
  const [height, setHeight] = useState(
    initialHeight != null ? String(initialHeight) : ""
  );
  const [experience, setExperience] =
    useState<TrainingExperience>(initialExperience);
  const [workoutGoal, setWorkoutGoal] =
    useState<WorkoutGoalChoice>(initialWorkoutGoal);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ServerError | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // After router.refresh() the server re-renders this component with new
  // initial* props (the freshly-saved values). useState initializers only
  // run once, so without this effect the form would keep showing the
  // pre-save text and look like the save was ignored.
  useEffect(() => {
    if (busy) return; // never clobber an in-flight edit
    if (AGE_GROUPS.includes(initialAgeGroup as AgeGroup)) {
      setAgeGroup(initialAgeGroup as AgeGroup);
    }
    setSex(initialSex ?? "");
    setBodyweight(initialBodyweight != null ? String(initialBodyweight) : "");
    setHeight(initialHeight != null ? String(initialHeight) : "");
    setExperience(initialExperience);
    setWorkoutGoal(initialWorkoutGoal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialAgeGroup,
    initialSex,
    initialBodyweight,
    initialHeight,
    initialExperience,
    initialWorkoutGoal,
  ]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);

    const payload = {
      age_group: ageGroup,
      sex: sex || null,
      bodyweight_lbs: bodyweight ? Number(bodyweight) : null,
      height_inches: height ? Number(height) : null,
      training_experience: experience,
      daily_workout_goal: workoutGoal,
    };
    console.log("[SettingsForm] → POST /api/profile", payload);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      console.log(
        `[SettingsForm] ← ${res.status} ${res.statusText}`,
        data
      );
      if (!res.ok) {
        setErr(data as ServerError);
        return;
      }
      setMsg("Saved!");
      router.refresh();
    } catch (e: any) {
      console.error("[SettingsForm] network/parse error:", e);
      setErr({ error: e?.message ?? "Network error", stage: "client" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader
        username={username}
        isAdmin={isAdmin}
        profile={{
          bodyweight: bodyweight ? Number(bodyweight) : null,
          height: height ? Number(height) : null,
          sex: (sex || null) as any,
          ageGroup,
          experience,
        }}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 lg:px-10 py-8">
        <div className="mb-8">
          <div
            className="text-[11px] uppercase tracking-[0.32em] text-gold/80 mb-2"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            Forge
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight text-ink"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              textShadow: "0 0 20px rgba(245, 158, 11, 0.30)",
            }}
          >
            Character Profile
          </h1>
          <p className="text-xs uppercase tracking-[0.20em] text-muted mt-3">
            Tune the standards by which your strength is measured.
          </p>
        </div>

        <form
          onSubmit={save}
          className="bg-panel border border-border rounded-xl p-6 space-y-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bodyweight" hint="Used for relative-strength grading">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={bodyweight}
                  onChange={(e) => setBodyweight(e.target.value)}
                  placeholder="—"
                  className="w-full bg-bg border border-border rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">
                  lbs
                </span>
              </div>
            </Field>
            <Field label="Height">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="120"
                  step="0.25"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="—"
                  className="w-full bg-bg border border-border rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">
                  in
                </span>
              </div>
            </Field>
          </div>

          <Field label="Sex" hint="Standards may vary by sex">
            <div className="grid grid-cols-2 gap-2">
              {(["male", "female"] as Sex[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSex(s)}
                  className={`btn-stone ${
                    sex === s ? "" : "btn-stone-ghost"
                  }`}
                >
                  {SEX_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Age Group">
            <div className="grid grid-cols-4 gap-2">
              {AGE_GROUPS.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setAgeGroup(g)}
                  className={`btn-stone ${
                    ageGroup === g ? "" : "btn-stone-ghost"
                  } text-[11px]`}
                  style={{ padding: "0.6rem 0.5rem" }}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Training Experience"
            hint="A baseline boost is applied to your first sessions in each muscle group, then fades as you log real data."
          >
            <select
              value={experience}
              onChange={(e) =>
                setExperience(e.target.value as TrainingExperience)
              }
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            >
              {TRAINING_EXPERIENCES.map((e) => (
                <option key={e} value={e}>
                  {EXPERIENCE_LABEL[e]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Daily workout quest"
            hint="Sets the daily quest target on the Atlas page. Pick a level you can realistically clear most days."
          >
            <select
              value={workoutGoal}
              onChange={(e) =>
                setWorkoutGoal(e.target.value as WorkoutGoalChoice)
              }
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            >
              {WORKOUT_GOAL_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {WORKOUT_GOAL_LABEL[g]}
                </option>
              ))}
            </select>
          </Field>

          {err && (
            <div className="bg-danger/10 border border-danger/40 rounded-md px-3 py-2.5 text-xs space-y-1">
              <div className="text-danger font-bold uppercase tracking-wider">
                Save failed
                {err.stage ? ` (${err.stage})` : ""}
              </div>
              {err.error && (
                <div className="text-danger/90 break-words">{err.error}</div>
              )}
              {err.code && (
                <div className="text-danger/70 font-mono">
                  code: {err.code}
                </div>
              )}
              {err.details && (
                <div className="text-danger/70 break-words">
                  details: {err.details}
                </div>
              )}
              {err.hint && (
                <div className="text-danger/70 break-words">
                  hint: {err.hint}
                </div>
              )}
              <div className="text-danger/60 mt-1">
                Open the browser console for the full request/response trace.
              </div>
            </div>
          )}

          {msg && (
            <div
              role="status"
              aria-live="polite"
              className="bg-nature/15 border border-nature/50 rounded-md px-4 py-3 text-sm flex items-center gap-2.5 text-nature font-medium"
            >
              <CheckIcon />
              {msg}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="btn-stone flex-1"
            >
              {busy ? "Saving…" : "Forge"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[10px] uppercase tracking-[0.22em] text-gold/80 mb-2 font-bold"
        style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-muted/70">{hint}</p>}
    </div>
  );
}
