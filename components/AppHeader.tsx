"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import StrengthGuideModal from "@/components/StrengthGuideModal";
import ThemeToggle from "@/components/ThemeToggle";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  EXPERIENCE_LABEL,
  SEX_LABEL,
  type Sex,
  type TrainingExperience,
} from "@/lib/strength";

export type HeaderProfile = {
  bodyweight?: number | null;
  height?: number | null;
  sex?: Sex | null;
  ageGroup?: string | null;
  experience?: TrainingExperience | null;
};

type Props = {
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
};

export default function AppHeader({ username, isAdmin, profile }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [guideOpen, setGuideOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const incomplete =
    !!profile &&
    (profile.bodyweight == null ||
      profile.sex == null ||
      profile.ageGroup == null);

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-bronze-deep"
        style={{
          backgroundColor: "#0a0a12",
          backgroundImage: "var(--noise-bg)",
          boxShadow:
            "inset 0 -1px 0 rgba(0,0,0,0.6), 0 8px 24px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Carved bronze rule */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(139,115,85,0.5) 25%, rgba(184,134,11,0.55) 50%, rgba(139,115,85,0.5) 75%, transparent 100%)",
          }}
        />
        <div className="relative w-full px-6 lg:px-10 h-16 grid grid-cols-[auto_1fr_auto] items-center gap-6">
          <Link
            href="/dashboard"
            className="text-[20px] font-bold whitespace-nowrap gradient-text"
            prefetch
          >
            IronAtlas
          </Link>

          <div className="hidden md:flex justify-center">
            <TabBar isAdmin={isAdmin} />
          </div>
          <div className="md:hidden">
            <TabBar isAdmin={isAdmin} />
          </div>

          <div className="flex items-center gap-2 text-xs justify-self-end">
            <ThemeToggle />
            <button
              onClick={() => setGuideOpen(true)}
              className="h-9 px-4 rounded bg-elevated border border-bronze-deep hover:border-bronze hover:text-gold transition flex items-center text-[11px] uppercase tracking-[0.18em] font-medium text-ink"
              title="Open the Tome of Strength"
              aria-label="Open the Tome of Strength"
              style={{
                fontFamily: "var(--font-cinzel), Georgia, serif",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
              }}
            >
              Tome
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="relative w-10 h-10 rounded-full p-[2px] transition"
                style={{
                  background:
                    "linear-gradient(135deg, #d4a020 0%, #8b7355 50%, #6b4f3a 100%)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.5)",
                }}
                title={`${username} — open menu`}
                aria-label="Open profile menu"
                aria-expanded={menuOpen}
              >
                <span className="w-full h-full rounded-full bg-bg flex items-center justify-center text-[13px] font-bold text-gold">
                  {username[0]?.toUpperCase()}
                </span>
                {incomplete && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger ring-2 ring-bg"
                    title="Profile incomplete"
                  />
                )}
              </button>

              <div
                className={`absolute right-0 top-full mt-2 w-72 bg-panel border border-bronze-deep rounded overflow-hidden transition-all duration-150 origin-top-right ${
                  menuOpen
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-95 pointer-events-none"
                }`}
                style={{
                  backgroundImage: "var(--noise-bg)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 36px rgba(0, 0, 0, 0.7)",
                }}
              >
                <div
                  className="px-4 py-4 border-b border-bronze-deep flex items-center gap-3"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(40,30,15,0.30), rgba(20,12,30,0.20))",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full p-[2px]"
                    style={{
                      background:
                        "linear-gradient(135deg, #d4a020 0%, #6b4f3a 100%)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.5)",
                    }}
                  >
                    <span className="w-full h-full rounded-full bg-bg flex items-center justify-center text-[14px] font-bold text-gold">
                      {username[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-ink">
                      {username}
                    </div>
                    {incomplete && (
                      <div className="text-[10px] uppercase tracking-[0.18em] text-danger mt-0.5 font-semibold">
                        Profile incomplete
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 space-y-1.5 text-[12px]">
                  <ProfileRow
                    label="Bodyweight"
                    value={
                      profile?.bodyweight != null
                        ? `${profile.bodyweight} lbs`
                        : null
                    }
                  />
                  <ProfileRow
                    label="Height"
                    value={
                      profile?.height != null
                        ? `${profile.height} in`
                        : null
                    }
                  />
                  <ProfileRow
                    label="Sex"
                    value={profile?.sex ? SEX_LABEL[profile.sex] : null}
                  />
                  <ProfileRow
                    label="Age Group"
                    value={profile?.ageGroup ?? null}
                  />
                  <ProfileRow
                    label="Experience"
                    value={
                      profile?.experience
                        ? EXPERIENCE_LABEL[profile.experience]
                        : null
                    }
                  />
                </div>

                <div className="px-4 py-3 border-t border-bronze-deep">
                  <Link
                    href="/achievements"
                    onClick={() => setMenuOpen(false)}
                    prefetch
                    className="block w-full text-center text-[10px] uppercase tracking-[0.20em] font-semibold text-gold/85 hover:text-gold transition mb-2.5"
                    style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
                  >
                    Hall of Achievements →
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      prefetch
                      className="btn-stone flex-1 text-center text-[11px]"
                      style={{ padding: "0.6rem 0.75rem" }}
                    >
                      Edit Profile
                    </Link>
                    <button
                      onClick={signOut}
                      className="btn-stone btn-stone-ghost text-[11px]"
                      style={{ padding: "0.6rem 1rem" }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <StrengthGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span
        className={
          value
            ? "text-ink font-medium text-right truncate"
            : "text-danger italic"
        }
      >
        {value ?? "Not set"}
      </span>
    </div>
  );
}
