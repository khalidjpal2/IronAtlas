"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BodySVG from "@/components/BodySVG";
import Legend from "@/components/Legend";
import WorkoutForm from "@/components/WorkoutForm";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  MUSCLE_GROUPS,
  type MuscleGroup,
  type StrengthLevel,
} from "@/lib/strength";

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  ageGroup: string;
  levels: Partial<Record<MuscleGroup, StrengthLevel>>;
};

export default function Dashboard({ userId, username, isAdmin, ageGroup, levels }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [view, setView] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<MuscleGroup | null>(null);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          <span>Iron</span>
          <span className="text-strength-elite">Atlas</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted hidden sm:inline">
            {username} · {ageGroup}
          </span>
          {isAdmin && (
            <Link
              href="/admin"
              className="text-muted hover:text-white transition"
            >
              Admin
            </Link>
          )}
          <button
            onClick={signOut}
            className="text-muted hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_360px] gap-6 px-6 py-8 max-w-7xl mx-auto w-full">
        <section className="bg-panel border border-border rounded-xl p-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
              Strength Heatmap
            </h2>
            <div className="flex bg-bg border border-border rounded-md p-1 text-xs">
              <button
                onClick={() => setView("front")}
                className={`px-3 py-1 rounded ${
                  view === "front"
                    ? "bg-strength-elite text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                Front
              </button>
              <button
                onClick={() => setView("back")}
                className={`px-3 py-1 rounded ${
                  view === "back"
                    ? "bg-strength-elite text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                Back
              </button>
            </div>
          </div>

          <BodySVG view={view} levels={levels} onMuscleClick={setSelected} />

          <div className="mt-6 w-full">
            <Legend />
          </div>

          {selected && (
            <div className="mt-4 w-full max-w-md text-center">
              <div className="text-xs uppercase tracking-wide text-muted">Selected</div>
              <div className="text-lg font-medium capitalize">{selected}</div>
              <div
                className="inline-block mt-1 px-2 py-0.5 rounded text-xs"
                style={{
                  background: LEVEL_COLOR[levels[selected] ?? "untrained"],
                  color: "#0a0a0a",
                }}
              >
                {LEVEL_LABEL[levels[selected] ?? "untrained"]}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="bg-panel border border-border rounded-xl p-6">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">
              Log Workout
            </h2>
            <WorkoutForm userId={userId} />
          </div>

          <div className="bg-panel border border-border rounded-xl p-6">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">
              Levels
            </h2>
            <ul className="space-y-2 text-sm">
              {MUSCLE_GROUPS.map((m) => {
                const lvl = levels[m] ?? "untrained";
                return (
                  <li key={m} className="flex items-center justify-between">
                    <span className="capitalize">{m}</span>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ background: LEVEL_COLOR[lvl], color: "#0a0a0a" }}
                    >
                      {LEVEL_LABEL[lvl]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
