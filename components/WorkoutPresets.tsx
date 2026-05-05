"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";
import {
  EXERCISE_OPTIONS,
  ZONES,
  ZONE_LABEL,
  exerciseZone,
  exercisesForZone,
  type Zone,
} from "@/lib/strength";

export type PresetExercise = {
  id?: string;
  exerciseName: string;
  muscleGroup: string;
};

export type WorkoutPreset = {
  id: string;
  name: string;
  exercises: PresetExercise[];
};

export type LastSetByExercise = Record<
  string,
  { weight: number; reps: number; sets: number; date: string }
>;

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

export default function WorkoutPresets({
  userId,
  presets,
  lastByExercise,
}: {
  userId: string;
  presets: WorkoutPreset[];
  lastByExercise: LastSetByExercise;
}) {
  const [editorPreset, setEditorPreset] = useState<WorkoutPreset | "new" | null>(
    null
  );
  const [sessionPreset, setSessionPreset] = useState<WorkoutPreset | null>(null);
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function deletePreset(p: WorkoutPreset) {
    if (!window.confirm(`Delete preset "${p.name}"? This can't be undone.`))
      return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/presets/${p.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete preset.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2
          className="text-[12px] uppercase tracking-[0.22em] text-gold font-bold"
          style={fontDisplay}
        >
          My Presets
        </h2>
        <div className="rune-divider flex-1" />
        <button
          type="button"
          onClick={() => setEditorPreset("new")}
          className="btn-stone btn-stone-ghost text-[10px]"
          style={{ padding: "0.5rem 0.9rem" }}
        >
          Create Preset +
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="tablet relative rounded p-6 text-center">
          <span className="corner-bl" />
          <span className="corner-br" />
          <p className="text-sm text-muted italic">
            No presets yet. Create one to play back a workout routine in a
            single tap.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              busy={busyId === p.id}
              onStart={() => setSessionPreset(p)}
              onEdit={() => setEditorPreset(p)}
              onDelete={() => deletePreset(p)}
            />
          ))}
        </div>
      )}

      {editorPreset && (
        <PresetEditorModal
          mode={editorPreset === "new" ? "create" : "edit"}
          initial={editorPreset === "new" ? null : editorPreset}
          onClose={() => setEditorPreset(null)}
          onSaved={() => {
            setEditorPreset(null);
            router.refresh();
          }}
        />
      )}

      {sessionPreset && (
        <StartSessionModal
          userId={userId}
          preset={sessionPreset}
          lastByExercise={lastByExercise}
          onClose={() => setSessionPreset(null)}
          onSaved={() => {
            setSessionPreset(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

// ─── Preset Card ───────────────────────────────────────────────────
function PresetCard({
  preset,
  onStart,
  onEdit,
  onDelete,
  busy,
}: {
  preset: WorkoutPreset;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <article className="tablet relative rounded p-4 flex flex-col gap-3">
      <span className="corner-bl" />
      <span className="corner-br" />
      <header className="flex items-start justify-between gap-2">
        <h3
          className="text-base font-bold tracking-tight text-ink truncate"
          style={fontDisplay}
        >
          {preset.name}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-40 transition"
            title="Edit preset"
            aria-label="Edit preset"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40 transition"
            title="Delete preset"
            aria-label="Delete preset"
          >
            <TrashIcon />
          </button>
        </div>
      </header>

      <ul className="text-[11px] text-muted space-y-0.5 max-h-32 overflow-y-auto">
        {preset.exercises.length === 0 ? (
          <li className="italic">No exercises</li>
        ) : (
          preset.exercises.map((ex, i) => (
            <li key={`${ex.id ?? i}`} className="truncate">
              <span className="text-ink/80">{ex.exerciseName}</span>{" "}
              <span className="text-muted/60">·</span>{" "}
              <span className="uppercase tracking-[0.16em] text-[10px]">
                {ZONE_LABEL[ex.muscleGroup as Zone] ?? ex.muscleGroup}
              </span>
            </li>
          ))
        )}
      </ul>

      <button
        type="button"
        onClick={onStart}
        disabled={busy || preset.exercises.length === 0}
        className="btn-stone w-full text-[11px]"
        style={{
          ...fontDisplay,
          letterSpacing: "0.22em",
          background: "linear-gradient(180deg, #7747b0, #3a2466)",
          borderColor: "#7747b0",
          color: "#f0e6ff",
        }}
      >
        Start Session
      </button>
    </article>
  );
}

// ─── Preset Editor (create + edit) ─────────────────────────────────
function PresetEditorModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial: WorkoutPreset | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [exercises, setExercises] = useState<PresetExercise[]>(
    initial?.exercises ?? []
  );
  const [pickerZone, setPickerZone] = useState<Zone | "">("");
  const [pickerExercise, setPickerExercise] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const pickerExerciseList = useMemo(
    () => (pickerZone ? exercisesForZone(pickerZone) : []),
    [pickerZone]
  );

  function addExercise() {
    if (!pickerZone || !pickerExercise) return;
    setExercises((xs) => [
      ...xs,
      { exerciseName: pickerExercise, muscleGroup: pickerZone },
    ]);
    setPickerExercise("");
  }
  function removeAt(i: number) {
    setExercises((xs) => xs.filter((_, idx) => idx !== i));
  }
  function moveUp(i: number) {
    if (i === 0) return;
    setExercises((xs) => {
      const next = xs.slice();
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }
  function moveDown(i: number) {
    setExercises((xs) => {
      if (i >= xs.length - 1) return xs;
      const next = xs.slice();
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      return next;
    });
  }

  async function save() {
    setErr(null);
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        exercises: exercises.map((e) => ({
          exercise_name: e.exerciseName,
          muscle_group: e.muscleGroup,
        })),
      };
      const res = await fetch(
        mode === "edit" && initial
          ? `/api/presets/${initial.id}`
          : "/api/presets",
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save preset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              {mode === "edit" ? "Edit Preset" : "New Preset"}
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink"
              style={fontDisplay}
            >
              Routine
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Preset Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Push Day, Pull Day, Leg Day…"
            className="w-full"
            autoFocus
          />
        </div>

        {/* Add Exercise picker */}
        <div className="bg-elevated/60 border border-bronze-deep/60 rounded p-3 space-y-2">
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold"
            style={fontDisplay}
          >
            Add Exercise
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={pickerZone}
              onChange={(e) => {
                setPickerZone((e.target.value || "") as Zone | "");
                setPickerExercise("");
              }}
              className="w-full"
            >
              <option value="">Muscle Group</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </select>
            <select
              value={pickerExercise}
              onChange={(e) => setPickerExercise(e.target.value)}
              disabled={!pickerZone}
              className="w-full"
            >
              <option value="">Exercise</option>
              {pickerExerciseList.map((ex) => (
                <option key={ex.name} value={ex.name}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addExercise}
            disabled={!pickerZone || !pickerExercise}
            className="btn-stone btn-stone-ghost w-full text-[10px]"
            style={{ padding: "0.55rem 0.75rem" }}
          >
            Add
          </button>
        </div>

        {/* Ordered list */}
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold mb-2"
            style={fontDisplay}
          >
            Exercises ({exercises.length})
          </div>
          {exercises.length === 0 ? (
            <p className="text-[11px] text-muted italic">
              No exercises added yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {exercises.map((ex, i) => (
                <li
                  key={`${ex.exerciseName}-${i}`}
                  className="flex items-center gap-2 bg-elevated/40 border border-bronze-deep/40 rounded px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">
                      {ex.exerciseName}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                      {ZONE_LABEL[ex.muscleGroup as Zone] ?? ex.muscleGroup}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-30 transition"
                    title="Move up"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    disabled={i === exercises.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-30 transition"
                    title="Move down"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-danger/10 transition"
                    title="Remove"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="text-[11px] text-danger">{err}</p>}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-stone flex-1"
            style={{
              background: "linear-gradient(180deg, #7747b0, #3a2466)",
              borderColor: "#7747b0",
              color: "#f0e6ff",
            }}
          >
            {busy ? "Saving…" : "Save Preset"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-stone btn-stone-ghost px-4"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Start Session Modal ───────────────────────────────────────────
type SessionRow = {
  rowKey: string; // local key, NOT a DB id
  exerciseName: string;
  muscleGroup: string;
  weight: string;
  reps: string;
  sets: string;
  saved?: boolean; // pulses briefly after save
};

function StartSessionModal({
  userId,
  preset,
  lastByExercise,
  onClose,
  onSaved,
}: {
  userId: string;
  preset: WorkoutPreset;
  lastByExercise: LastSetByExercise;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [date, setDate] = useState<string>(todayPT());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SessionRow[]>(() =>
    preset.exercises.map((ex, i) => ({
      rowKey: `preset-${i}`,
      exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      weight: "",
      reps: "",
      sets: "",
    }))
  );
  const [pickerZone, setPickerZone] = useState<Zone | "">("");
  const [pickerExercise, setPickerExercise] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const pickerExerciseList = useMemo(
    () => (pickerZone ? exercisesForZone(pickerZone) : []),
    [pickerZone]
  );

  function setField<K extends keyof SessionRow>(
    rowKey: string,
    field: K,
    value: SessionRow[K]
  ) {
    setRows((rs) =>
      rs.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r))
    );
  }
  function adjustWeight(rowKey: string, delta: number) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.rowKey !== rowKey) return r;
        const cur = Number(r.weight) || 0;
        const next = Math.max(0, cur + delta);
        return { ...r, weight: String(next) };
      })
    );
  }
  function addAnotherSet(rowKey: string) {
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.rowKey === rowKey);
      if (idx < 0) return rs;
      const src = rs[idx];
      const newRow: SessionRow = {
        rowKey: `${rowKey}-extra-${Date.now()}`,
        exerciseName: src.exerciseName,
        muscleGroup: src.muscleGroup,
        weight: "",
        reps: "",
        sets: "",
      };
      const next = rs.slice();
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  }
  function removeRow(rowKey: string) {
    setRows((rs) => rs.filter((r) => r.rowKey !== rowKey));
  }
  function addExtraExercise() {
    if (!pickerZone || !pickerExercise) return;
    setRows((rs) => [
      ...rs,
      {
        rowKey: `extra-${Date.now()}`,
        exerciseName: pickerExercise,
        muscleGroup: pickerZone,
        weight: "",
        reps: "",
        sets: "",
      },
    ]);
    setPickerExercise("");
  }

  async function complete() {
    setErr(null);
    const valid = rows.filter(
      (r) =>
        Number(r.weight) > 0 && Number(r.reps) > 0 && Number(r.sets) > 0
    );
    if (valid.length === 0) {
      setErr("Fill in at least one row before completing the session.");
      return;
    }
    setBusy(true);
    try {
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({ user_id: userId, date, notes: notes || null })
        .select()
        .single();
      if (wErr) throw wErr;

      const exerciseLookup = new Map(
        EXERCISE_OPTIONS.map((e) => [e.name, e])
      );
      const baseRows = valid.map((r) => ({
        workout_id: workout.id,
        exercise_name: r.exerciseName,
        muscle_group: r.muscleGroup,
        weight_lbs: Number(r.weight),
        reps: Number(r.reps),
        sets: Number(r.sets),
      }));
      const withPrimary = baseRows.map((row, i) => ({
        ...row,
        primary_muscle:
          exerciseLookup.get(valid[i].exerciseName)?.muscles?.[0] ?? null,
      }));
      const insertResult = await supabase
        .from("workout_sets")
        .insert(withPrimary);
      if (insertResult.error) {
        const code = (insertResult.error as any).code;
        const missingCol =
          code === "42703" ||
          code === "PGRST204" ||
          /primary_muscle/i.test(insertResult.error.message ?? "");
        if (!missingCol) throw insertResult.error;
        const fallback = await supabase.from("workout_sets").insert(baseRows);
        if (fallback.error) throw fallback.error;
      }

      // Visual feedback — pulse all rows then auto-close.
      setRows((rs) =>
        rs.map((r) => ({
          ...r,
          saved:
            Number(r.weight) > 0 &&
            Number(r.reps) > 0 &&
            Number(r.sets) > 0,
        }))
      );
      setSavedPulse(true);
      setTimeout(() => {
        onSaved();
      }, 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to complete session.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center"
      onClick={() => !busy && !savedPulse && onClose()}
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(2, 2, 8, 0.85)", backdropFilter: "blur(3px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl flex flex-col"
        style={{
          background: "var(--noise-bg), #0a0a14",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-bronze-deep/60 shrink-0">
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Session
            </div>
            <h2
              className="text-lg font-bold text-ink truncate"
              style={fontDisplay}
            >
              {preset.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={date}
              max={todayPT()}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs"
              style={{ minHeight: 36, padding: "4px 8px" }}
            />
            <button
              type="button"
              onClick={complete}
              disabled={busy}
              className="btn-stone text-[10px]"
              style={{
                ...fontDisplay,
                letterSpacing: "0.22em",
                padding: "0.55rem 0.85rem",
                background: "linear-gradient(180deg, #7747b0, #3a2466)",
                borderColor: "#7747b0",
                color: "#f0e6ff",
              }}
            >
              {busy ? "Saving…" : "Complete Session"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition disabled:opacity-40"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted italic">
              No exercises in this session yet — add one below.
            </p>
          ) : (
            rows.map((row) => (
              <SessionRowCard
                key={row.rowKey}
                row={row}
                last={lastByExercise[row.exerciseName]}
                onField={(field, value) => setField(row.rowKey, field, value)}
                onAdjustWeight={(delta) => adjustWeight(row.rowKey, delta)}
                onAddAnother={() => addAnotherSet(row.rowKey)}
                onRemove={() => removeRow(row.rowKey)}
              />
            ))
          )}

          {/* Add extra exercise */}
          <div className="bg-elevated/40 border border-bronze-deep/40 rounded p-3 space-y-2">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold"
              style={fontDisplay}
            >
              + Add Exercise
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select
                value={pickerZone}
                onChange={(e) => {
                  setPickerZone((e.target.value || "") as Zone | "");
                  setPickerExercise("");
                }}
                className="w-full"
              >
                <option value="">Muscle Group</option>
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {ZONE_LABEL[z]}
                  </option>
                ))}
              </select>
              <select
                value={pickerExercise}
                onChange={(e) => setPickerExercise(e.target.value)}
                disabled={!pickerZone}
                className="w-full"
              >
                <option value="">Exercise</option>
                {pickerExerciseList.map((ex) => (
                  <option key={ex.name} value={ex.name}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addExtraExercise}
                disabled={!pickerZone || !pickerExercise}
                className="btn-stone btn-stone-ghost text-[10px]"
                style={{ padding: "0.5rem 0.75rem" }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
              style={fontDisplay}
            >
              Session Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="optional"
              className="w-full"
            />
          </div>

          {err && <p className="text-[11px] text-danger">{err}</p>}
        </div>
      </div>

      <style jsx>{`
        :global(.session-pulse) {
          animation: sessionPulse 1.2s ease-out;
        }
        @keyframes sessionPulse {
          0% { box-shadow: 0 0 0 rgba(212, 160, 23, 0); border-color: rgba(212, 160, 23, 0.4); }
          25% { box-shadow: 0 0 24px rgba(212, 160, 23, 0.55); border-color: rgba(212, 160, 23, 1); }
          100% { box-shadow: 0 0 0 rgba(212, 160, 23, 0); border-color: rgba(212, 160, 23, 0.4); }
        }
      `}</style>
    </div>
  );
}

function SessionRowCard({
  row,
  last,
  onField,
  onAdjustWeight,
  onAddAnother,
  onRemove,
}: {
  row: SessionRow;
  last: LastSetByExercise[string] | undefined;
  onField: <K extends keyof SessionRow>(field: K, value: SessionRow[K]) => void;
  onAdjustWeight: (delta: number) => void;
  onAddAnother: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`bg-elevated/60 border border-bronze-deep/60 rounded p-3 space-y-2 ${
        row.saved ? "session-pulse" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">
            {row.exerciseName}
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
            {ZONE_LABEL[row.muscleGroup as Zone] ?? row.muscleGroup}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-danger text-lg w-7 h-7 flex items-center justify-center rounded transition shrink-0"
          aria-label="Remove row"
          title="Remove"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Weight
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={row.weight}
            onChange={(e) => onField("weight", e.target.value)}
            className="w-full"
            inputMode="decimal"
          />
        </div>
        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Reps
          </label>
          <input
            type="number"
            min="0"
            value={row.reps}
            onChange={(e) => onField("reps", e.target.value)}
            className="w-full"
            inputMode="numeric"
          />
        </div>
        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Sets
          </label>
          <input
            type="number"
            min="0"
            value={row.sets}
            onChange={(e) => onField("sets", e.target.value)}
            className="w-full"
            inputMode="numeric"
          />
        </div>
      </div>

      {/* Last-time reference */}
      <div className="text-[11px]" style={{ color: "#b8860b" }}>
        {last ? (
          <>
            Last time:{" "}
            <span className="tabular-nums font-semibold">
              {last.weight} × {last.reps} × {last.sets}
            </span>
            <span className="text-muted/80"> — {formatDate(last.date)}</span>
          </>
        ) : (
          <span className="text-muted italic">No previous data</span>
        )}
      </div>

      {/* Quick weight adjust */}
      <div className="flex items-center gap-1">
        {[-5, -2.5, 2.5, 5].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onAdjustWeight(d)}
            className="flex-1 text-[10px] uppercase tracking-[0.18em] py-1.5 rounded border border-bronze-deep/40 text-muted hover:text-ink hover:border-gold/60 transition"
            style={fontDisplay}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddAnother}
          className="px-3 text-[10px] uppercase tracking-[0.18em] py-1.5 rounded border border-bronze-deep/40 text-muted hover:text-accent hover:border-accent/60 transition"
          style={fontDisplay}
          title="Add another set with the same exercise"
        >
          + Set
        </button>
      </div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
