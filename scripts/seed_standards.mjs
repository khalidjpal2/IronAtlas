// One-off seed runner: bulk-upserts the strength_standards table over the
// Supabase REST API using the service role key. Generates 51 exercises ×
// 4 age groups × 2 sexes = 408 rows, then verifies the row count.
//
// Usage: node scripts/seed_standards.mjs
//
// Requires .env.local at the repo root with NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// ─── Base values: 18-25 male × per-zone sex multiplier ────────────────────
// Zone tags: 'upper' / 'lower' / 'bodyweight' / 'endurance'
const BASE = [
  // Chest
  ["chest", "Bench Press", "upper", 135, 185, 235, 290, 350],
  ["chest", "Incline Bench Press", "upper", 115, 160, 210, 260, 315],
  ["chest", "Decline Bench Press", "upper", 145, 195, 245, 300, 360],
  ["chest", "Machine Chest Press", "upper", 130, 180, 230, 285, 345],
  ["chest", "Pec Deck", "upper", 60, 95, 130, 170, 210],
  ["chest", "Cable Fly", "upper", 50, 80, 115, 150, 185],
  ["chest", "Push Up", "bodyweight", 20, 40, 60, 80, 110],
  // Back
  ["back", "Pull Up", "bodyweight", 0, 25, 60, 100, 145],
  ["back", "Lat Pulldown", "upper", 110, 145, 185, 230, 280],
  ["back", "Cable Row", "upper", 110, 145, 185, 230, 280],
  ["back", "T-Bar Row", "upper", 100, 140, 180, 225, 275],
  ["back", "Barbell Row", "upper", 95, 145, 195, 245, 305],
  ["back", "Face Pull", "upper", 40, 60, 90, 120, 150],
  ["back", "Deadlift", "lower", 175, 275, 365, 450, 545],
  // Shoulders
  ["shoulders", "Lateral Raise", "upper", 15, 25, 40, 55, 75],
  ["shoulders", "Front Raise", "upper", 15, 25, 40, 55, 75],
  ["shoulders", "Machine Shoulder Press", "upper", 95, 135, 175, 220, 265],
  ["shoulders", "Overhead Press", "upper", 75, 115, 155, 195, 240],
  ["shoulders", "Arnold Press", "upper", 50, 80, 115, 150, 185],
  ["shoulders", "Rear Delt Fly", "upper", 15, 25, 40, 55, 75],
  // Biceps
  ["biceps", "Barbell Curl", "upper", 55, 80, 110, 145, 185],
  ["biceps", "Dumbbell Curl", "upper", 30, 45, 60, 80, 100],
  ["biceps", "Incline Dumbbell Curl", "upper", 25, 40, 55, 75, 95],
  ["biceps", "Hammer Curl", "upper", 40, 55, 75, 95, 120],
  ["biceps", "Preacher Curl", "upper", 50, 75, 100, 130, 165],
  ["biceps", "Cable Curl", "upper", 50, 75, 100, 130, 165],
  // Triceps
  ["triceps", "Tricep Pushdown", "upper", 50, 75, 105, 140, 175],
  ["triceps", "Overhead Tricep Cable", "upper", 40, 60, 85, 115, 145],
  ["triceps", "Skull Crusher", "upper", 50, 75, 100, 130, 160],
  ["triceps", "Dumbbell Overhead Extension", "upper", 40, 60, 85, 115, 145],
  ["triceps", "Close Grip Bench Press", "upper", 115, 165, 215, 270, 325],
  ["triceps", "Dips", "bodyweight", 0, 10, 25, 45, 70],
  // Quads
  ["quads", "Squat", "lower", 135, 230, 305, 385, 470],
  ["quads", "Leg Extension", "lower", 95, 145, 195, 250, 310],
  ["quads", "Leg Press", "lower", 270, 410, 545, 685, 825],
  ["quads", "Hack Squat", "lower", 180, 270, 360, 460, 565],
  ["quads", "Bulgarian Split Squat", "lower", 80, 130, 180, 230, 280],
  // Hamstrings
  ["hamstrings", "Hamstring Curl", "lower", 75, 115, 155, 200, 245],
  ["hamstrings", "Romanian Deadlift", "lower", 135, 205, 275, 350, 425],
  ["hamstrings", "Good Morning", "lower", 95, 145, 195, 245, 305],
  ["hamstrings", "Nordic Curl", "bodyweight", 3, 5, 10, 15, 20],
  // Glutes
  ["glutes", "Hip Thrust", "lower", 185, 275, 360, 450, 545],
  ["glutes", "Glute Bridge", "lower", 135, 200, 265, 335, 405],
  ["glutes", "Cable Kickback", "lower", 30, 50, 70, 95, 120],
  ["glutes", "Abductor Machine", "lower", 90, 135, 180, 230, 280],
  // Calves
  ["calves", "Standing Calf Raise", "lower", 95, 165, 225, 295, 365],
  ["calves", "Seated Calf Raise", "lower", 70, 110, 150, 200, 250],
  ["calves", "Leg Press Calf Raise", "lower", 180, 270, 360, 460, 565],
  // Abs
  ["abs", "Ab Crunch Machine", "upper", 80, 130, 180, 230, 290],
  ["abs", "Plank", "endurance", 30, 60, 120, 240, 360],
  ["abs", "Cable Crunch", "upper", 90, 135, 180, 230, 280],
  ["abs", "Hanging Leg Raise", "endurance", 5, 10, 20, 30, 50],
  ["abs", "Russian Twist", "endurance", 20, 40, 60, 80, 100],
  ["abs", "Ab Wheel", "endurance", 5, 10, 20, 30, 50],
];

const AGE_MULT = { "18-25": 1.0, "26-35": 1.0, "36-45": 0.92, "46+": 0.8 };
const SEX_MULT = {
  upper: { male: 1.0, female: 0.65 },
  lower: { male: 1.0, female: 0.75 },
  bodyweight: { male: 1.0, female: 0.55 },
  endurance: { male: 1.0, female: 0.85 },
};

function build() {
  const rows = [];
  for (const [muscle_group, exercise_name, zone, b, a, ab, e, el] of BASE) {
    for (const age_group of Object.keys(AGE_MULT)) {
      for (const sex of ["male", "female"]) {
        const am = AGE_MULT[age_group];
        const sm = SEX_MULT[zone][sex];
        const k = (x) => Math.max(0, Math.round(x * am * sm));
        rows.push({
          muscle_group,
          exercise_name,
          age_group,
          sex,
          below_average_lbs: k(b),
          average_lbs: k(a),
          above_average_lbs: k(ab),
          exceptional_lbs: k(e),
          elite_lbs: k(el),
        });
      }
    }
  }
  return rows;
}

async function probeSchema() {
  // PostgREST returns 400 if you select a column that doesn't exist.
  const r = await fetch(
    `${URL}/rest/v1/strength_standards?select=id,sex&limit=1`,
    { headers }
  );
  if (!r.ok) {
    const body = await r.text();
    return { hasSex: false, error: body };
  }
  return { hasSex: true };
}

async function exactCount() {
  const r = await fetch(
    `${URL}/rest/v1/strength_standards?select=*`,
    { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } }
  );
  const range = r.headers.get("content-range"); // "0-0/N"
  return range ? Number(range.split("/")[1]) : null;
}

async function upsertBatch(rows) {
  const r = await fetch(
    `${URL}/rest/v1/strength_standards?on_conflict=exercise_name,age_group,sex`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    }
  );
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`upsert HTTP ${r.status}: ${body}`);
  }
}

async function main() {
  console.log(`Supabase URL: ${URL}`);
  console.log("Probing schema for `sex` column…");
  const probe = await probeSchema();
  if (!probe.hasSex) {
    console.error("\n✗ The strength_standards table is missing the `sex` column.");
    console.error("  PostgREST cannot run DDL (ALTER TABLE) — apply this in the");
    console.error("  Supabase SQL editor first, then re-run this script:\n");
    console.error("  alter table public.strength_standards");
    console.error("    add column if not exists sex text not null default 'male';");
    console.error("  alter table public.strength_standards");
    console.error("    drop constraint if exists strength_standards_exercise_name_age_group_key;");
    console.error("  alter table public.strength_standards");
    console.error("    drop constraint if exists strength_standards_exercise_name_age_group_sex_key;");
    console.error("  alter table public.strength_standards");
    console.error("    add constraint strength_standards_exercise_name_age_group_sex_key");
    console.error("    unique (exercise_name, age_group, sex);");
    console.error("  alter table public.strength_standards");
    console.error("    drop constraint if exists strength_standards_sex_check;");
    console.error("  alter table public.strength_standards");
    console.error("    add constraint strength_standards_sex_check");
    console.error("    check (sex in ('male', 'female'));\n");
    console.error(`  Server response: ${probe.error}`);
    process.exit(2);
  }
  console.log("✓ sex column present");

  const before = await exactCount();
  console.log(`Rows before: ${before}`);

  const rows = build();
  console.log(`Generated ${rows.length} rows. Upserting…`);

  // PostgREST handles batches up to ~1000 fine; 408 is one batch.
  await upsertBatch(rows);
  console.log("✓ upsert complete");

  const after = await exactCount();
  console.log(`\nFinal row count: ${after}`);
  console.log(after >= 408 ? "✓ Target reached (≥ 408)" : "✗ Below target");
  process.exit(after !== null && after >= 408 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
