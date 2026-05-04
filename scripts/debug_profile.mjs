// Diagnostic script — answers the user's debug questions by hitting
// the Supabase PostgREST API with the service-role key.
//
// 1. select * from profiles
// 2. presence of the current user's row
// 3. profiles schema (columns + types)
// 4. dummy upsert + verification round-trip
//
// Triggers (pg_meta) aren't exposed over PostgREST — that one has to
// be run in the SQL editor. The script prints the SQL to paste.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const KNOWN_USER_ID = "28e1062e-9499-4949-b00e-667acb417d25";

function hr(s) {
  console.log("\n" + "═".repeat(72));
  console.log(s);
  console.log("═".repeat(72));
}

async function listAllProfiles() {
  hr("1. select * from public.profiles");
  const r = await fetch(`${URL_}/rest/v1/profiles?select=*`, { headers });
  if (!r.ok) {
    console.error("HTTP", r.status, await r.text());
    return null;
  }
  const rows = await r.json();
  console.log(`Row count: ${rows.length}`);
  console.log(JSON.stringify(rows, null, 2));
  return rows;
}

async function profilesSchema() {
  hr("2. profiles schema (column_name, data_type)");
  // PostgREST publishes a per-row schema in the OpenAPI document at the
  // root of /rest/v1/. We grab just the `profiles` definition.
  const r = await fetch(`${URL_}/rest/v1/`, { headers });
  if (!r.ok) {
    console.error("HTTP", r.status, await r.text());
    return null;
  }
  const spec = await r.json();
  const def = spec?.definitions?.profiles;
  if (!def) {
    console.error("No profiles definition in OpenAPI spec");
    return null;
  }
  const props = def.properties ?? {};
  const cols = Object.entries(props).map(([name, p]) => ({
    column_name: name,
    data_type: (p && p.format) || (p && p.type) || "?",
    description: (p && p.description) ?? "",
  }));
  console.table(cols);
  return cols;
}

async function checkUserRow(userId) {
  hr(`3. profiles row for user ${userId}`);
  const r = await fetch(
    `${URL_}/rest/v1/profiles?select=*&id=eq.${userId}`,
    { headers }
  );
  if (!r.ok) {
    console.error("HTTP", r.status, await r.text());
    return null;
  }
  const rows = await r.json();
  if (rows.length === 0) {
    console.log("✗ NO ROW for this user — upsert / RLS would silently no-op.");
  } else {
    console.log("✓ Row exists:");
    console.log(JSON.stringify(rows[0], null, 2));
  }
  return rows[0] ?? null;
}

async function dummyUpsert(userId) {
  hr(`4. dummy upsert round-trip for ${userId}`);
  const sentinel = Math.round(100 + Math.random() * 100);
  console.log(`Writing bodyweight_lbs=${sentinel} via service-role upsert…`);
  const r = await fetch(
    `${URL_}/rest/v1/profiles?on_conflict=id`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: userId,
        bodyweight_lbs: sentinel,
      }),
    }
  );
  const body = await r.text();
  console.log(`HTTP ${r.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body);
  }

  console.log("\nReading back…");
  const r2 = await fetch(
    `${URL_}/rest/v1/profiles?select=id,bodyweight_lbs&id=eq.${userId}`,
    { headers }
  );
  const rows = await r2.json();
  console.log(JSON.stringify(rows, null, 2));
  if (rows[0]?.bodyweight_lbs === sentinel) {
    console.log(`✓ Round-trip confirmed: bodyweight_lbs is now ${sentinel}.`);
  } else {
    console.log(`✗ Mismatch — wrote ${sentinel}, read ${rows[0]?.bodyweight_lbs}.`);
  }
}

function triggerSqlReminder() {
  hr("5. trigger inspection");
  console.log(
    "PostgREST cannot read pg_catalog. Paste this in the Supabase SQL editor:\n"
  );
  console.log("  select event_object_schema as schema,");
  console.log("         event_object_table as table,");
  console.log("         trigger_name,");
  console.log("         action_timing,");
  console.log("         event_manipulation,");
  console.log("         action_statement");
  console.log("  from information_schema.triggers");
  console.log("  where event_object_schema in ('public','auth')");
  console.log("  order by event_object_schema, event_object_table;\n");
  console.log("Look for `on_auth_user_created` on `auth.users`.");
}

async function main() {
  console.log("Supabase URL:", URL_);
  console.log("Known user id:", KNOWN_USER_ID);

  await listAllProfiles();
  await profilesSchema();
  await checkUserRow(KNOWN_USER_ID);
  await dummyUpsert(KNOWN_USER_ID);
  triggerSqlReminder();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
