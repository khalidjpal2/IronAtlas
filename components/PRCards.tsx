"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";
import {
  BIG_THREE,
  BIG_THREE_EXERCISE,
  BIG_THREE_LABEL,
  LEVEL_COLOR,
  LEVEL_LABEL,
  levelForLift,
  type BigThree,
  type StandardRow,
  type StrengthLevel,
} from "@/lib/strength";

export type PR = {
  lift: BigThree;
  weight: number;
  date: string;
};

type Props = {
  userId: string;
  prs: PR[];
  standards: StandardRow[];
  variant?: "default" | "compact";
};

export default function PRCards({
  userId,
  prs,
  standards,
  variant = "default",
}: Props) {
  const [editing, setEditing] = useState<BigThree | null>(null);

  const stdByExercise = new Map<string, StandardRow>();
  standards.forEach((s) => stdByExercise.set(s.exercise_name, s));

  const cells = BIG_THREE.map((lift) => {
    const pr = prs.find((p) => p.lift === lift) ?? null;
    const std = stdByExercise.get(BIG_THREE_EXERCISE[lift]);
    const level: StrengthLevel =
      pr && std ? levelForLift(pr.weight, std) : "untrained";
    return { lift, pr, level };
  });

  return (
    <>
      {variant === "compact" ? (
        <div className="grid grid-cols-3 gap-3">
          {cells.map(({ lift, pr, level }) => (
            <CompactPRCell
              key={lift}
              lift={lift}
              pr={pr}
              level={level}
              onEdit={() => setEditing(lift)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cells.map(({ lift, pr, level }) => (
            <PRCard
              key={lift}
              lift={lift}
              pr={pr}
              level={level}
              onEdit={() => setEditing(lift)}
            />
          ))}
        </div>
      )}

      {editing && (
        <PRModal
          userId={userId}
          lift={editing}
          current={prs.find((p) => p.lift === editing) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/**
 * Thin horizontal PR pill — for the Atlas-page top strip.
 * Max height ~76px including padding. Click anywhere to edit.
 */
function CompactPRCell({
  lift,
  pr,
  level,
  onEdit,
}: {
  lift: BigThree;
  pr: PR | null;
  level: StrengthLevel;
  onEdit: () => void;
}) {
  const hasPR = pr !== null;
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`tablet relative rounded p-3 flex items-center gap-3 text-left transition ${
        hasPR ? "tablet-arcane" : ""
      }`}
      style={{ minHeight: 64 }}
    >
      <span className="corner-bl" />
      <span className="corner-br" />
      <CrownIcon dim={!hasPR} />
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase tracking-[0.22em] font-bold truncate"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            color: hasPR ? "#b8860b" : "#8b8275",
          }}
        >
          {BIG_THREE_LABEL[lift]}
        </div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          {hasPR ? (
            <>
              <span
                className="text-2xl font-bold tabular-nums leading-none gold-text"
                style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
              >
                {pr!.weight}
              </span>
              <span className="text-[11px] text-muted">lbs</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-ink-muted leading-none">
              —
            </span>
          )}
        </div>
      </div>
      {hasPR && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="seal"
            style={{
              width: 12,
              height: 12,
              background: LEVEL_COLOR[level],
            }}
          />
          <span
            className="text-[9px] uppercase tracking-[0.16em] font-bold whitespace-nowrap"
            style={{ color: LEVEL_COLOR[level] }}
          >
            {LEVEL_LABEL[level]}
          </span>
        </div>
      )}
    </button>
  );
}

function PRCard({
  lift,
  pr,
  level,
  onEdit,
}: {
  lift: BigThree;
  pr: PR | null;
  level: StrengthLevel;
  onEdit: () => void;
}) {
  const hasPR = pr !== null;
  return (
    <div
      className={`tablet lift rounded p-6 flex flex-col text-center ${
        hasPR ? "tablet-arcane" : ""
      }`}
    >
      <span className="corner-bl" />
      <span className="corner-br" />
      {hasPR && (
        <div
          aria-hidden
          className="absolute top-3 right-3 text-gold"
          style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.7))" }}
        >
          <CrownIcon />
        </div>
      )}
      <div
        className="text-[11px] uppercase tracking-[0.22em] font-bold"
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          color: hasPR ? "#b8860b" : "#8b8275",
        }}
      >
        {BIG_THREE_LABEL[lift]}
      </div>

      {hasPR ? (
        <>
          <div className="mt-3 mb-1 leading-none">
            <span
              className="text-5xl font-bold tracking-tight tabular-nums gold-text"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              {pr!.weight}
            </span>
            <span className="text-sm font-medium text-muted ml-1">lbs</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span
              className="seal"
              style={{
                width: 10,
                height: 10,
                background: LEVEL_COLOR[level],
              }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.18em] font-bold"
              style={{ color: LEVEL_COLOR[level] }}
            >
              {LEVEL_LABEL[level]}
            </span>
          </div>
          <div className="text-[11px] text-muted mt-1">
            {formatDate(pr!.date)}
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 mb-1 text-3xl font-semibold text-ink-muted leading-none">
            —
          </div>
          <div className="text-[11px] text-muted mt-2 italic">
            No record yet
          </div>
        </>
      )}

      <button
        onClick={onEdit}
        className={`mt-5 w-full ${
          hasPR ? "btn-stone-ghost btn-stone" : "btn-stone btn-stone-gold"
        }`}
      >
        {hasPR ? "Update" : "Inscribe"}
      </button>
    </div>
  );
}

function CrownIcon({ dim = false }: { dim?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-5 h-5 shrink-0 ${dim ? "text-ink-muted" : "text-gold"}`}
      style={{ filter: dim ? undefined : "drop-shadow(0 1px 0 rgba(0,0,0,0.7))" }}
      aria-hidden
    >
      <path d="M3 7l4 3 5-6 5 6 4-3-2 11H5L3 7zm3 13h12v1.5H6V20z" />
    </svg>
  );
}

function PRModal({
  userId,
  lift,
  current,
  onClose,
}: {
  userId: string;
  lift: BigThree;
  current: PR | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [weight, setWeight] = useState(current?.weight?.toString() ?? "");
  const [date, setDate] = useState(
    current?.date ?? todayPT()
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const w = Number(weight);
      if (!w || w <= 0) throw new Error("Enter a valid weight");
      const { error } = await supabase.from("personal_bests").upsert(
        {
          user_id: userId,
          lift_name: lift,
          weight_lbs: w,
          date_achieved: date,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lift_name" }
      );
      if (error) throw error;
      router.refresh();
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-6"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="tablet rounded p-6 w-full max-w-sm space-y-4"
      ><span className="corner-bl" /><span className="corner-br" />
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-gold"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            Inscribe Legendary Lift
          </div>
          <h2
            className="text-xl font-semibold mt-1 text-ink"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            {BIG_THREE_LABEL[lift]}
          </h2>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
            Weight (lbs)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            required
            autoFocus
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
            Date Achieved
          </label>
          <input
            type="date"
            value={date}
            max={todayPT()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="btn-stone btn-stone-gold flex-1"
          >
            {busy ? "Saving…" : "Inscribe"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-stone btn-stone-ghost px-5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function BarbellIcon() {
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
      <path d="M3 8 L3 16" />
      <path d="M21 8 L21 16" />
      <path d="M6 6 L6 18" />
      <path d="M18 6 L18 18" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  );
}

