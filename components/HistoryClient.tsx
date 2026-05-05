"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader, { type HeaderProfile } from "@/components/AppHeader";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  EXERCISE_OPTIONS,
  LEVEL_COLOR,
  LEVEL_LABEL,
  ZONES,
  ZONE_LABEL,
  effectiveStrength,
  exerciseZone,
  levelFromScore,
  type StandardRow,
  type StrengthLevel,
  type Zone,
} from "@/lib/strength";
import { todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";

export type HistoryRow = {
  id: string;
  workoutId: string;
  date: string;
  notes: string | null;
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  sets: number;
};

type Props = {
  username: string;
  isAdmin: boolean;
  rows: HistoryRow[];
  standards: StandardRow[];
  bodyweight?: number;
  profileMeta?: HeaderProfile;
};

type EditState = {
  exerciseName: string;
  weight: string;
  reps: string;
  sets: string;
  date: string;
  notes: string;
};

export default function HistoryClient({
  username,
  isAdmin,
  rows,
  standards,
  bodyweight,
  profileMeta,
}: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [filterZone, setFilterZone] = useState<string>("");
  const [filterExercise, setFilterExercise] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const stdByExercise = useMemo(() => {
    const map = new Map<string, StandardRow>();
    standards.forEach((s) => map.set(s.exercise_name, s));
    return map;
  }, [standards]);

  const muscleByExercise = useMemo(() => {
    const map = new Map<string, string[]>();
    EXERCISE_OPTIONS.forEach((ex) => map.set(ex.name, ex.muscles));
    return map;
  }, []);

  const todayISO = todayPT();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.date && r.date > todayISO) return false; // hide any future-dated rows
      if (filterZone && r.muscleGroup !== filterZone) return false;
      if (filterExercise && r.exerciseName !== filterExercise) return false;
      if (filterFrom && r.date < filterFrom) return false;
      if (filterTo && r.date > filterTo) return false;
      return true;
    });
  }, [rows, filterZone, filterExercise, filterFrom, filterTo, todayISO]);

  const totalSets = rows.length;
  const mostTrained = (() => {
    const counts = new Map<string, number>();
    rows.forEach((r) =>
      counts.set(r.muscleGroup, (counts.get(r.muscleGroup) ?? 0) + 1)
    );
    let best: { zone: string; n: number } | null = null;
    counts.forEach((n, zone) => {
      if (!best || n > best.n) best = { zone, n };
    });
    return best;
  })() as { zone: string; n: number } | null;

  const personalRecords = useMemo(() => {
    const best = new Map<string, number>();
    rows.forEach((r) => {
      const cur = best.get(r.exerciseName);
      if (cur === undefined || r.weight > cur) best.set(r.exerciseName, r.weight);
    });
    const out: { exercise: string; weight: number }[] = [];
    best.forEach((weight, exercise) => out.push({ exercise, weight }));
    out.sort((a, b) => b.weight - a.weight);
    return out;
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    filtered.forEach((r) => {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered]);

  const exerciseNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.exerciseName));
    EXERCISE_OPTIONS.forEach((e) => set.add(e.name));
    return Array.from(set).sort();
  }, [rows]);

  function clearFilters() {
    setFilterZone("");
    setFilterExercise("");
    setFilterFrom("");
    setFilterTo("");
  }

  function startEdit(row: HistoryRow) {
    setEditingId(row.id);
    setEdit({
      exerciseName: row.exerciseName,
      weight: String(row.weight),
      reps: String(row.reps),
      sets: String(row.sets),
      date: row.date,
      notes: row.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit(row: HistoryRow) {
    if (!edit) return;
    setBusyId(row.id);
    try {
      const ex = EXERCISE_OPTIONS.find((e) => e.name === edit.exerciseName);
      const newZone = ex ? exerciseZone(ex) : row.muscleGroup;

      // Update the parent workout row (date + notes)
      const { error: wErr } = await supabase
        .from("workouts")
        .update({
          date: edit.date,
          notes: edit.notes ? edit.notes : null,
        })
        .eq("id", row.workoutId);
      if (wErr) throw wErr;

      // Update the set itself
      const { error: sErr } = await supabase
        .from("workout_sets")
        .update({
          exercise_name: edit.exerciseName,
          muscle_group: newZone,
          weight_lbs: Number(edit.weight),
          reps: Number(edit.reps),
          sets: Number(edit.sets),
        })
        .eq("id", row.id);
      if (sErr) throw sErr;

      setToast("Updated");
      cancelEdit();
      router.refresh();
    } catch (e: any) {
      alert(e.message ?? "Failed to update.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(row: HistoryRow) {
    const ok = window.confirm(
      `Delete ${row.exerciseName}? This can't be undone.`
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      // Delete this set only.
      const { error: setErr } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", row.id);
      if (setErr) throw setErr;

      // If this was the last set on the parent workout, drop the parent.
      const { count, error: countErr } = await supabase
        .from("workout_sets")
        .select("id", { count: "exact", head: true })
        .eq("workout_id", row.workoutId);
      if (countErr) throw countErr;
      if ((count ?? 0) === 0) {
        const { error: wErr } = await supabase
          .from("workouts")
          .delete()
          .eq("id", row.workoutId);
        if (wErr) throw wErr;
      }
      setToast("Deleted");
      cancelEdit();
      router.refresh();
    } catch (e: any) {
      alert(e.message ?? "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader
        username={username}
        isAdmin={isAdmin}
        profile={profileMeta}
      />

      <main className="flex-1 w-full px-6 lg:px-10 py-8 space-y-6">
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.32em] text-gold/80 mb-2"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            Chronicle
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight text-ink"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              textShadow: "0 0 20px rgba(245, 158, 11, 0.30)",
            }}
          >
            Battle Log
          </h1>
          <p className="text-xs uppercase tracking-[0.20em] text-muted mt-3">
            Every battle, every set, every triumph.
          </p>
        </div>

        {/* Summary */}
        <section className="bg-panel border border-border rounded-xl p-6">
          <div
            className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold mb-4"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            Overview
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <Stat label="Total Sets" value={String(totalSets)} />
            <Stat
              label="Most Trained"
              value={mostTrained ? labelForZone(mostTrained.zone) : "—"}
              sub={mostTrained ? `${mostTrained.n} sets` : undefined}
            />
            <Stat
              label="Top PR"
              value={
                personalRecords[0] ? `${personalRecords[0].exercise}` : "—"
              }
              sub={
                personalRecords[0]
                  ? `${personalRecords[0].weight} lbs`
                  : undefined
              }
            />
          </div>

          {personalRecords.length > 0 && (
            <details className="text-sm">
              <summary
                className="text-[11px] uppercase tracking-[0.22em] text-gold cursor-pointer hover:text-gold-soft transition font-bold"
                style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
              >
                Personal Records ({personalRecords.length})
              </summary>
              <ul className="mt-3 grid sm:grid-cols-2 gap-1.5">
                {personalRecords.map((p) => (
                  <li
                    key={p.exercise}
                    className="flex items-center justify-between bg-elevated border border-border rounded-md px-3 py-1.5"
                  >
                    <span className="text-ink">{p.exercise}</span>
                    <span className="text-gold text-xs font-semibold">{p.weight} lbs</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Filters */}
        <section className="bg-panel border border-border rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <FilterField label="Muscle Group">
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">All</option>
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {ZONE_LABEL[z]}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Exercise">
              <select
                value={filterExercise}
                onChange={(e) => setFilterExercise(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">All</option>
                {exerciseNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="From">
              <input
                type="date"
                value={filterFrom}
                max={todayISO}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </FilterField>
            <FilterField label="To">
              <input
                type="date"
                value={filterTo}
                max={todayISO}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </FilterField>
            <FilterField label="&nbsp;">
              <button
                onClick={clearFilters}
                className="w-full bg-elevated border border-border-bright hover:border-gold/40 text-muted hover:text-gold rounded-md px-2 py-2 text-sm transition"
              >
                Clear
              </button>
            </FilterField>
          </div>
        </section>

        {/* List */}
        <section className="space-y-6">
          {grouped.length === 0 && (
            <div className="bg-panel border border-border rounded-xl p-10 text-center text-muted text-sm italic">
              No battles match these filters.
            </div>
          )}
          {grouped.map(([date, items]) => (
            <div key={date}>
              <h3
                className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold mb-3"
                style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
              >
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {items.map((row) => {
                  const std = stdByExercise.get(row.exerciseName);
                  const lvl: StrengthLevel = std
                    ? levelFromScore(
                        effectiveStrength(
                          row.weight,
                          row.reps,
                          row.sets,
                          bodyweight
                        ),
                        std
                      )
                    : "untrained";
                  const muscles = muscleByExercise.get(row.exerciseName) ?? [];
                  const volume = row.weight * row.reps * row.sets;
                  return (
                    <div
                      key={row.id}
                      className="bg-panel border border-border rounded-md p-4 flex items-start gap-4 hover:border-accent/40 transition"
                    >
                      <span
                        className="mt-1 inline-block w-2 h-2 rounded-sm shrink-0"
                        style={{
                          background: LEVEL_COLOR[lvl],
                          boxShadow: `0 0 6px ${LEVEL_COLOR[lvl]}`,
                        }}
                        title={LEVEL_LABEL[lvl]}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-ink truncate">
                            {row.exerciseName}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-gold whitespace-nowrap font-semibold">
                            {ZONE_LABEL[row.muscleGroup as Zone] ??
                              row.muscleGroup}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted mb-1.5 truncate">
                          {muscles.length > 0 ? muscles.join(" · ") : "—"}
                        </div>
                        <div className="text-[12px] text-ink flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>
                            <span className="text-muted">Weight</span>{" "}
                            {row.weight}
                            {row.exerciseName === "Plank" ? "s" : " lbs"}
                          </span>
                          <span>
                            <span className="text-muted">Reps</span> {row.reps}
                          </span>
                          <span>
                            <span className="text-muted">Sets</span> {row.sets}
                          </span>
                          <span>
                            <span className="text-muted">Volume</span>{" "}
                            {volume.toLocaleString()}
                          </span>
                          <span
                            className="font-semibold uppercase tracking-wider text-[10px]"
                            style={{ color: LEVEL_COLOR[lvl] }}
                          >
                            {LEVEL_LABEL[lvl]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <IconButton
                          onClick={() => startEdit(row)}
                          disabled={busyId === row.id}
                          title="Edit"
                        >
                          <PencilIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => deleteRow(row)}
                          disabled={busyId === row.id}
                          title="Delete"
                          danger
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Edit Workout Set modal */}
      {editingId && edit && (() => {
        const row = rows.find((r) => r.id === editingId);
        if (!row) return null;
        return (
          <EditWorkoutSetModal
            row={row}
            edit={edit}
            setEdit={setEdit}
            onCancel={cancelEdit}
            onSave={() => saveEdit(row)}
            onDelete={() => deleteRow(row)}
            busy={busyId === row.id}
            exerciseNames={exerciseNames}
            todayISO={todayISO}
          />
        );
      })()}

      {/* Toast */}
      <div
        className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-bold rounded transition-opacity duration-200 ${
          toast ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          background: "#8a6308",
          color: "#1a0f00",
          border: "1px solid #4a3010",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.55)",
        }}
      >
        {toast}
      </div>
    </div>
  );
}

export function EditWorkoutSetModal({
  row,
  edit,
  setEdit,
  onCancel,
  onSave,
  onDelete,
  busy,
  exerciseNames,
  todayISO,
}: {
  row: HistoryRow;
  edit: EditState;
  setEdit: (e: EditState) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  busy: boolean;
  exerciseNames: string[];
  todayISO: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  // Auto-update muscle group hint when exercise changes (cosmetic — the
  // actual save uses exerciseZone() too, server-side this is the
  // authoritative computation).
  const exMatch = EXERCISE_OPTIONS.find((e) => e.name === edit.exerciseName);
  const liveZone = exMatch ? exerciseZone(exMatch) : row.muscleGroup;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => !busy && onCancel()}
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
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
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              Edit Set
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              {row.exerciseName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <FieldRow label="Exercise">
          <select
            value={edit.exerciseName}
            onChange={(e) =>
              setEdit({ ...edit, exerciseName: e.target.value })
            }
            className="w-full"
          >
            {exerciseNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Muscle Group">
          <div
            className="rounded px-3 py-2 text-sm"
            style={{
              background: "rgba(20, 14, 30, 0.55)",
              border: "1px solid rgba(184, 134, 11, 0.3)",
              color: "#d8d2c2",
            }}
          >
            {ZONE_LABEL[liveZone as Zone] ?? liveZone}
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted">
              auto
            </span>
          </div>
        </FieldRow>

        <div className="grid grid-cols-3 gap-2">
          <FieldRow label="Weight">
            <input
              type="number"
              min="0"
              step="0.5"
              value={edit.weight}
              onChange={(e) => setEdit({ ...edit, weight: e.target.value })}
              className="w-full"
            />
          </FieldRow>
          <FieldRow label="Reps">
            <input
              type="number"
              min="0"
              value={edit.reps}
              onChange={(e) => setEdit({ ...edit, reps: e.target.value })}
              className="w-full"
            />
          </FieldRow>
          <FieldRow label="Sets">
            <input
              type="number"
              min="0"
              value={edit.sets}
              onChange={(e) => setEdit({ ...edit, sets: e.target.value })}
              className="w-full"
            />
          </FieldRow>
        </div>

        <FieldRow label="Date">
          <input
            type="date"
            value={edit.date}
            max={todayISO}
            onChange={(e) => setEdit({ ...edit, date: e.target.value })}
            className="w-full"
          />
        </FieldRow>

        <FieldRow label="Notes">
          <input
            type="text"
            value={edit.notes}
            onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
            placeholder="optional"
            className="w-full"
          />
        </FieldRow>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onSave}
            disabled={busy}
            className="btn-stone flex-1"
            style={{
              background: "linear-gradient(180deg, #7747b0, #3a2466)",
              borderColor: "#7747b0",
              color: "#f0e6ff",
            }}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn-stone btn-stone-ghost px-4"
          >
            Cancel
          </button>
        </div>

        <button
          onClick={onDelete}
          disabled={busy}
          className="w-full text-[11px] uppercase tracking-[0.22em] font-bold py-2 rounded transition disabled:opacity-40"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            background: "rgba(168, 50, 50, 0.12)",
            border: "1px solid rgba(168, 50, 50, 0.45)",
            color: "#d96666",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`w-8 h-8 flex items-center justify-center rounded-md border border-transparent transition disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "text-muted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
          : "text-muted hover:text-white hover:bg-bg hover:border-border"
      }`}
    >
      <span className="w-4 h-4">{children}</span>
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full"
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
      className="w-full h-full"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-elevated border border-border rounded-md px-3 py-3">
      <div
        className="text-[9px] uppercase tracking-[0.20em] text-gold/80 mb-1 font-bold"
        style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
      >
        {label}
      </div>
      <div className="text-base font-bold text-ink truncate">{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[9px] uppercase tracking-[0.18em] text-muted mb-1"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      {children}
    </div>
  );
}

function labelForZone(zone: string): string {
  return ZONE_LABEL[zone as Zone] ?? zone;
}

