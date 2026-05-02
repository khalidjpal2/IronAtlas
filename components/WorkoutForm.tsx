"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { EXERCISE_OPTIONS } from "@/lib/strength";

export default function WorkoutForm({ userId }: { userId: string }) {
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

  const exerciseDef = EXERCISE_OPTIONS.find((e) => e.name === exercise)!;

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
        muscle_group: exerciseDef.muscle,
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
        <label className="block text-xs uppercase tracking-wide text-muted mb-1">Exercise</label>
        <select
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
        >
          {EXERCISE_OPTIONS.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name} — {opt.muscle}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">{weightLabel}</label>
          <input
            type="number"
            min="0"
            step="0.5"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-strength-elite"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Reps</label>
          <input
            type="number"
            min="1"
            required
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-strength-elite"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Sets</label>
          <input
            type="number"
            min="1"
            required
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-strength-elite"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="optional"
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-strength-elite"
        />
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {msg && <p className="text-sm text-strength-average">{msg}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-strength-elite hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-md transition"
      >
        {submitting ? "Logging..." : "Log Workout"}
      </button>
    </form>
  );
}
