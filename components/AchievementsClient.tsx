"use client";

import AppHeader, { type HeaderProfile } from "@/components/AppHeader";
import { BADGES, type BadgeCategory } from "@/lib/badges";

type Scores = {
  atlas: number;
  journey: number;
  sustenance: number;
  overall: number;
  rank: string;
  rankLabel: string;
};

type Props = {
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
  scores: Scores;
  earnedAtById: Record<string, string>;
  newlyEarned: string[];
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

// Section banners — Khalid's flavor names per category.
const SECTION_TITLES: Record<BadgeCategory, string> = {
  lifting: "Iron Discipline",
  journey: "The Long March",
  sustenance: "Sustenance of the Realm",
  overall: "Hall of Legends",
};

// Category color theme — Khalid's spec.
const CATEGORY_THEME: Record<
  BadgeCategory,
  { color: string; soft: string; ring: string; flavor: string }
> = {
  lifting: {
    color: "#a83232",
    soft: "rgba(168, 50, 50, 0.18)",
    ring: "rgba(168, 50, 50, 0.5)",
    flavor: "Crimson",
  },
  journey: {
    color: "#3a5a8a",
    soft: "rgba(58, 90, 138, 0.18)",
    ring: "rgba(58, 90, 138, 0.5)",
    flavor: "Sapphire",
  },
  sustenance: {
    color: "#3d6b3a",
    soft: "rgba(61, 107, 58, 0.18)",
    ring: "rgba(61, 107, 58, 0.5)",
    flavor: "Emerald",
  },
  overall: {
    color: "#7747b0",
    soft: "rgba(119, 71, 176, 0.20)",
    ring: "rgba(119, 71, 176, 0.55)",
    flavor: "Arcane",
  },
};

const FLAVOR_LINES = [
  "Your legend grows.",
  "Tales are told of these deeds.",
  "The chronicle remembers.",
  "Honored by the realm.",
  "Worthy of a saga.",
];

function flavorFor(score: number): string {
  // Pick a line proportional to score, but stable.
  const idx = Math.min(
    FLAVOR_LINES.length - 1,
    Math.floor((score / 100) * FLAVOR_LINES.length)
  );
  return FLAVOR_LINES[idx];
}

function rankColor(score: number): string {
  if (score >= 81) return "#5b3993";
  if (score >= 61) return "#b8860b";
  if (score >= 41) return "#3d6b3a";
  if (score >= 21) return "#3a5a8a";
  return "#4a4a52";
}

export default function AchievementsClient({
  username,
  isAdmin,
  profile,
  scores,
  earnedAtById,
  newlyEarned,
}: Props) {
  const newSet = new Set(newlyEarned);

  const grouped: Record<BadgeCategory, typeof BADGES> = {
    lifting: [],
    journey: [],
    sustenance: [],
    overall: [],
  };
  BADGES.forEach((b) => grouped[b.category].push(b));

  const earnedCount = BADGES.filter((b) => earnedAtById[b.id]).length;

  return (
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader username={username} isAdmin={isAdmin} profile={profile} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 lg:px-10 py-8 space-y-8">
        {/* === HEADER — carved stone inscription === */}
        <header className="text-center">
          <div
            className="text-[11px] uppercase tracking-[0.32em] text-gold/80 mb-2"
            style={fontDisplay}
          >
            Chronicle of Deeds
          </div>
          <div
            className="inline-block px-8 py-4 rounded relative"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #1a1a22 0%, #0c0c18 100%), var(--noise-bg)",
              border: "1px solid #6b4f3a",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.5)",
            }}
          >
            <span
              aria-hidden
              className="absolute"
              style={{ top: -3, left: -3, width: 6, height: 6, transform: "rotate(45deg)", background: "#8b7355" }}
            />
            <span
              aria-hidden
              className="absolute"
              style={{ top: -3, right: -3, width: 6, height: 6, transform: "rotate(45deg)", background: "#8b7355" }}
            />
            <span
              aria-hidden
              className="absolute"
              style={{ bottom: -3, left: -3, width: 6, height: 6, transform: "rotate(45deg)", background: "#8b7355" }}
            />
            <span
              aria-hidden
              className="absolute"
              style={{ bottom: -3, right: -3, width: 6, height: 6, transform: "rotate(45deg)", background: "#8b7355" }}
            />
            <h1
              className="text-3xl md:text-5xl font-bold tracking-[0.18em]"
              style={{
                ...fontDisplay,
                color: "#b8860b",
                textShadow:
                  "0 0 18px rgba(184, 134, 11, 0.40), 0 1px 0 rgba(0,0,0,0.8), 0 -1px 0 rgba(0,0,0,0.5)",
              }}
            >
              HALL OF ACHIEVEMENTS
            </h1>
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.20em] text-muted">
            <span className="text-gold font-semibold tabular-nums">
              {earnedCount}
            </span>{" "}
            of{" "}
            <span className="text-ink tabular-nums">{BADGES.length}</span>{" "}
            unlocked
          </div>
          <div
            className="rune-divider mt-5 mx-auto"
            style={{ maxWidth: 380 }}
          />
        </header>

        {/* === HERO RANK === */}
        <RankHero scores={scores} />

        {/* === SECTIONS === */}
        {(["lifting", "journey", "sustenance", "overall"] as BadgeCategory[]).map(
          (cat) => (
            <section key={cat} className="space-y-4">
              <SectionHeader
                title={SECTION_TITLES[cat]}
                color={CATEGORY_THEME[cat].color}
                count={`${
                  grouped[cat].filter((b) => earnedAtById[b.id]).length
                } / ${grouped[cat].length}`}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {grouped[cat].map((b) => {
                  const earnedAt = earnedAtById[b.id] ?? null;
                  return (
                    <Medallion
                      key={b.id}
                      id={b.id}
                      name={b.name}
                      description={b.description}
                      category={b.category}
                      earnedAt={earnedAt}
                      isNew={newSet.has(b.id)}
                    />
                  );
                })}
              </div>
            </section>
          )
        )}
      </main>
    </div>
  );
}

// ─── Rank hero with current pillar scores ────────────────────────
function RankHero({ scores }: { scores: Scores }) {
  const c = rankColor(scores.overall);
  return (
    <section
      className="tablet tablet-arcane relative rounded p-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-center"
    >
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="text-center md:text-left md:border-r md:border-bronze-deep/50 md:pr-6">
        <div
          className="text-[10px] uppercase tracking-[0.32em] text-gold/80 mb-1"
          style={fontDisplay}
        >
          Current Rank
        </div>
        <div className="flex justify-center md:justify-start">
          <RankMedallion score={scores.overall} label={scores.rankLabel} />
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted">
          Combined{" "}
          <span className="text-ink font-semibold tabular-nums">
            {scores.overall}
          </span>
          <span className="text-muted/60">/100</span>
        </div>
        <p
          className="mt-3 text-[11px] italic text-muted/90"
          style={fontDisplay}
        >
          {flavorFor(scores.overall)}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PillarStat label="Atlas"      score={scores.atlas}      color="#a83232" />
        <PillarStat label="Journey"    score={scores.journey}    color="#3a5a8a" />
        <PillarStat label="Sustenance" score={scores.sustenance} color="#3d6b3a" />
      </div>
    </section>
  );
}

function RankMedallion({ score, label }: { score: number; label: string }) {
  const color = rankColor(score);
  return (
    <div className="relative" style={{ width: 100, height: 100 }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        {/* Outer ornate rings */}
        <circle cx="50" cy="50" r="48" fill="#0c0c18" stroke={color} strokeWidth="1.5" />
        <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="0.5" />
        {/* 8 crown points around the rim */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x1 = 50 + Math.cos(a) * 44;
          const y1 = 50 + Math.sin(a) * 44;
          const x2 = 50 + Math.cos(a) * 49;
          const y2 = 50 + Math.sin(a) * 49;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeOpacity="0.6"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{
          textShadow: `0 0 12px ${color}88, 0 1px 0 rgba(0,0,0,0.7)`,
        }}
      >
        <div
          className="font-bold tabular-nums leading-none"
          style={{ ...fontDisplay, fontSize: 26, color }}
        >
          {score}
        </div>
        <div
          className="mt-1 text-[9px] uppercase tracking-[0.22em] font-bold"
          style={{ ...fontDisplay, color }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function PillarStat({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div className="bg-elevated border border-bronze-deep rounded p-3"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.22em] font-bold"
        style={{ ...fontDisplay, color }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold tabular-nums leading-none mt-1"
        style={{
          ...fontDisplay,
          color,
          textShadow: `0 0 8px ${color}55, 0 1px 0 rgba(0,0,0,0.7)`,
        }}
      >
        {score}
        <span className="text-[11px] text-muted/60 ml-1 font-normal">
          /100
        </span>
      </div>
      <div className="mt-2 xp-track" style={{ height: 4 }}>
        {score > 0 && (
          <div
            className="xp-fill"
            style={{
              width: `${score}%`,
              background: color,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Section header (carved-stone banner) ────────────────────────
function SectionHeader({
  title,
  color,
  count,
}: {
  title: string;
  color: string;
  count: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="px-4 py-2 rounded relative"
        style={{
          background:
            "linear-gradient(180deg, #1a1a22 0%, #0c0c18 100%), var(--noise-bg)",
          border: `1px solid ${color}`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="text-[12px] uppercase tracking-[0.28em] font-bold"
          style={{
            ...fontDisplay,
            color,
            textShadow: `0 0 8px ${color}55, 0 1px 0 rgba(0,0,0,0.7)`,
          }}
        >
          {title}
        </div>
      </div>
      <div className="flex-1 rune-divider" />
      <div
        className="text-[10px] uppercase tracking-[0.22em] text-muted tabular-nums"
        style={fontDisplay}
      >
        {count}
      </div>
    </div>
  );
}

// ─── Medallion (one badge) ───────────────────────────────────────
function Medallion({
  id,
  name,
  description,
  category,
  earnedAt,
  isNew,
}: {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  earnedAt: string | null;
  isNew: boolean;
}) {
  const earned = earnedAt != null;
  const theme = CATEGORY_THEME[category];
  return (
    <div
      className={`relative flex flex-col items-center text-center p-3 rounded transition ${
        isNew ? "pulse-legendary" : ""
      }`}
      style={{
        background: earned
          ? `linear-gradient(180deg, ${theme.soft}, transparent), #0c0c18`
          : "#0c0c18",
        border: `1px solid ${earned ? theme.ring : "#2a2630"}`,
        boxShadow: earned
          ? `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 16px ${theme.ring.replace("0.5", "0.18").replace("0.55", "0.20")}`
          : "inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
      title={earned ? description : "Locked — complete the criteria to unlock"}
    >
      {/* Medallion disc */}
      <BadgeDisc id={id} earned={earned} theme={theme} />

      {/* Name */}
      <div
        className="mt-3 text-[11px] uppercase tracking-[0.18em] font-bold"
        style={{
          ...fontDisplay,
          color: earned ? theme.color : "#3a3340",
          textShadow: earned ? "0 1px 0 rgba(0,0,0,0.7)" : undefined,
        }}
      >
        {earned ? name : "???"}
      </div>

      {/* Description / lock */}
      <div className="text-[10px] text-muted/80 leading-snug mt-1 min-h-[2.5em]">
        {earned ? description : "Locked"}
      </div>

      {/* Earned date */}
      {earned && earnedAt && (
        <div className="text-[9px] uppercase tracking-[0.18em] text-muted/60 mt-1">
          {formatEarnedDate(earnedAt)}
        </div>
      )}

      {isNew && (
        <div
          className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-[0.20em] font-bold"
          style={{
            ...fontDisplay,
            background: "#8a6308",
            color: "#1a0f00",
            border: "1px solid #4a3010",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          New
        </div>
      )}
    </div>
  );
}

function BadgeDisc({
  id,
  earned,
  theme,
}: {
  id: string;
  earned: boolean;
  theme: { color: string; ring: string };
}) {
  const fg = earned ? theme.color : "#3a3340";
  const inner = earned ? "#0c0c18" : "#0c0c18";
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
      {/* Outer ornate ring */}
      <circle cx="32" cy="32" r="30" fill={inner} stroke={fg} strokeWidth="1.5" />
      <circle cx="32" cy="32" r="27" fill="none" stroke={fg} strokeOpacity="0.45" strokeWidth="0.5" />
      {/* Crown points around rim */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x1 = 32 + Math.cos(a) * 27;
        const y1 = 32 + Math.sin(a) * 27;
        const x2 = 32 + Math.cos(a) * 30.5;
        const y2 = 32 + Math.sin(a) * 30.5;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={fg}
            strokeOpacity="0.55"
            strokeWidth="0.7"
          />
        );
      })}
      {/* Center sigil */}
      <g
        transform="translate(20 20)"
        style={{
          filter: earned
            ? `drop-shadow(0 0 4px ${theme.color}88)`
            : undefined,
        }}
      >
        <BadgeSigil id={id} color={fg} />
      </g>
    </svg>
  );
}

/**
 * A small SVG sigil per badge ID. Earned = sharp & coloured;
 * locked = drawn in muted slate as a silhouette via the parent fill.
 */
function BadgeSigil({ id, color }: { id: string; color: string }) {
  const c = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    // Lifting
    case "lifting.first_blood":
      // dagger
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M12 2 L13 10 L11 10 Z" />
          <path {...c} d="M9 10 H15" />
          <path {...c} d="M12 10 V20" />
        </svg>
      );
    case "lifting.iron_will":
      // anvil
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M3 9 H21 L18 13 H6 Z" />
          <path {...c} d="M9 13 V19 H15 V13" />
          <path {...c} d="M7 19 H17" />
        </svg>
      );
    case "lifting.awakened":
      // eye
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M2 12 C5 6 12 6 12 6 C12 6 19 6 22 12 C19 18 12 18 12 18 C12 18 5 18 2 12 Z" />
          <circle {...c} cx="12" cy="12" r="3" />
        </svg>
      );
    case "lifting.legendary":
      // flaming sword
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M12 2 L13 14 L11 14 Z" />
          <path {...c} d="M8 14 H16" />
          <path {...c} d="M12 14 V22" />
          <path {...c} d="M10 5 C9 3 11 3 12 5 M14 5 C15 3 13 3 12 5" />
        </svg>
      );
    case "lifting.full_atlas":
      // figure outline
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle {...c} cx="12" cy="6" r="2.5" />
          <path {...c} d="M12 8.5 V16 M7 12 H17 M9 22 L12 16 L15 22" />
        </svg>
      );
    case "lifting.big_three":
      // 3 stars
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M5 6 L6 8 L8 8 L6.5 9 L7 11 L5 10 L3 11 L3.5 9 L2 8 L4 8 Z" />
          <path {...c} d="M12 4 L13 6 L15 6 L13.5 7 L14 9 L12 8 L10 9 L10.5 7 L9 6 L11 6 Z" />
          <path {...c} d="M19 6 L20 8 L22 8 L20.5 9 L21 11 L19 10 L17 11 L17.5 9 L16 8 L18 8 Z" />
          <path {...c} d="M4 16 H20" />
          <path {...c} d="M6 20 H18" />
        </svg>
      );

    // Journey
    case "journey.first_steps":
      // footprint
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <ellipse {...c} cx="10" cy="14" rx="4" ry="5" />
          <circle {...c} cx="14" cy="6" r="1" />
          <circle {...c} cx="16" cy="9" r="1" />
          <circle {...c} cx="17" cy="13" r="1" />
        </svg>
      );
    case "journey.10k_club":
      // milestone marker
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M8 3 H18 L20 7 L18 11 H8 V3 Z" />
          <path {...c} d="M8 11 V21" />
          <path {...c} d="M5 21 H11" />
        </svg>
      );
    case "journey.week_warrior":
      // 7 dots
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <circle
              key={i}
              cx={4 + i * 2.5}
              cy={12}
              r={1.2}
              fill={color}
              stroke="none"
            />
          ))}
          <path {...c} d="M3 17 H21" />
        </svg>
      );
    case "journey.month_march":
      // crescent + path
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M8 4 A8 8 0 1 0 8 20 A6 6 0 1 1 8 4" />
          <path {...c} d="M14 7 L20 10 L14 13 L20 16 L14 19" />
        </svg>
      );

    // Sustenance
    case "sustenance.first_meal":
      // chalice
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M6 4 H18 L17 12 C17 14 14 16 12 16 C10 16 7 14 7 12 Z" />
          <path {...c} d="M12 16 V20" />
          <path {...c} d="M8 20 H16" />
        </svg>
      );
    case "sustenance.week_of_plenty":
      // wheat sheaf
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M12 4 V20" />
          <path {...c} d="M12 6 L9 8 M12 6 L15 8" />
          <path {...c} d="M12 10 L9 12 M12 10 L15 12" />
          <path {...c} d="M12 14 L9 16 M12 14 L15 16" />
        </svg>
      );
    case "sustenance.macro_master":
      // triple ring
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle {...c} cx="9" cy="11" r="4" />
          <circle {...c} cx="15" cy="11" r="4" />
          <circle {...c} cx="12" cy="16" r="4" />
        </svg>
      );

    // Overall
    case "overall.warrior":
      // sword + shield
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M5 3 H11 L11 11 C11 14 8 16 8 16 C8 16 5 14 5 11 Z" />
          <path {...c} d="M16 3 L17 13 L15 13 Z" />
          <path {...c} d="M14 13 H18" />
          <path {...c} d="M16 13 V21" />
        </svg>
      );
    case "overall.champion":
      // laurel crown
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M5 18 C7 10 10 6 12 4 C14 6 17 10 19 18" />
          <path {...c} d="M12 4 V20" />
          <path {...c} d="M5 18 H19" />
        </svg>
      );
    case "overall.legend":
      // ornate crown
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path {...c} d="M3 18 L4 8 L8 12 L12 6 L16 12 L20 8 L21 18 Z" />
          <path {...c} d="M3 21 H21" />
          <circle cx="12" cy="6" r="0.8" fill={color} stroke="none" />
        </svg>
      );
    case "overall.balanced":
      // triquetra
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle {...c} cx="9" cy="10" r="5" />
          <circle {...c} cx="15" cy="10" r="5" />
          <circle {...c} cx="12" cy="16" r="5" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle {...c} cx="12" cy="12" r="6" />
        </svg>
      );
  }
}

function formatEarnedDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
