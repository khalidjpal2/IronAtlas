"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  EXERCISE_OPTIONS,
  exerciseZone,
  ZONE_LABEL,
} from "@/lib/strength";

type Props = {
  userId: string;
  presetExercise?: string | null;
  onConsumePreset?: () => void;
};

export default function WorkoutForm({
  userId,
  presetExercise,
  onConsumePreset,
}: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [exercise, setExercise] = useState(EXERCISE_OPTIONS[0].name);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (presetExercise) {
      setExercise(presetExercise);
      onConsumePreset?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetExercise]);

  const exerciseDef =
    EXERCISE_OPTIONS.find((e) => e.name === exercise) ?? EXERCISE_OPTIONS[0];
  const zone = exerciseZone(exerciseDef);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setMsg(null);
    try {
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({ user_id: userId, date, notes: notes || null })
        .select()
        .single();
      if (wErr) throw wErr;

      const { error: sErr } = await supabase.from("workout_sets").insert({
        workout_id: workout.id,
        exercise_name: exercise,
        muscle_group: zone,
        weight_lbs: Number(weight),
        reps: Number(reps),
        sets: Number(sets),
      });
      if (sErr) throw sErr;

      setMsg("Logged.");
      setWeight("");
      setReps("");
      setSets("");
      setNotes("");
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "Failed to log workout.");
    } finally {
      setSubmitting(false);
    }
  }

  const weightLabel = exercise === "Plank" ? "Time (seconds)" : "Weight (lbs)";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted mb-1">
          Exercise
        </label>
        <select
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
        >
          {EXERCISE_OPTIONS.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name} — {ZONE_LABEL[exerciseZone(opt)]}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
          Targets:{" "}
          <span className="text-muted/80">{exerciseDef.muscles.join(", ")}</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">
            {weightLabel}
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">
            Reps
          </label>
          <input
            type="number"
            min="1"
            required
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">
            Sets
          </label>
          <input
            type="number"
            min="1"
            required
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted mb-1">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted mb-1">
          Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="optional"
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium tracking-wide py-2.5 rounded-lg transition"
      >
        {submitting ? "Logging…" : "Log Workout"}
      </button>
    </form>
  );
}
