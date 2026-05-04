// Attempts to apply the steps + nutrition migration via every endpoint
// the service-role key can reach. If none accept DDL (the usual case
// with Supabase Cloud), it prints the exact SQL to paste and finishes
// with a verification probe that reports which tables exist.

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
  console.error("Missing env");
  process.exit(1);
}
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const SQL = readFileSync(
  join(__dirname, "..", "supabase", "migrations", "add_steps_and_nutrition.sql"),
  "utf8"
);

const TABLES = [
  "daily_steps",
  "step_goals",
  "daily_nutrition",
  "nutrition_goals",
];

function hr(s) {
  console.log("\n" + "─".repeat(72));
  console.log(s);
  console.log("─".repeat(72));
}

// 1. Try a known-bad endpoint first to characterize the responses, then
//    try every plausible SQL-runner endpoint.
async function tryDDL() {
  const candidates = [
    // Common pattern people set up: a SECURITY DEFINER function in
    // public schema named exec_sql / exec / sql.
    {
      name: "rpc/exec_sql",
      url: `${URL_}/rest/v1/rpc/exec_sql`,
      method: "POST",
      body: JSON.stringify({ sql: SQL }),
    },
    {
      name: "rpc/exec",
      url: `${URL_}/rest/v1/rpc/exec`,
      method: "POST",
      body: JSON.stringify({ sql: SQL }),
    },
    {
      name: "rpc/sql",
      url: `${URL_}/rest/v1/rpc/sql`,
      method: "POST",
      body: JSON.stringify({ query: SQL }),
    },
    // pg_meta — works on self-hosted Supabase, not on the managed
    // service unless the user exposed it themselves.
    {
      name: "pg-meta /query",
      url: `${URL_}/pg/query`,
      method: "POST",
      body: JSON.stringify({ query: SQL }),
    },
    {
      name: "pg-meta /v1/query",
      url: `${URL_}/pg/v1/query`,
      method: "POST",
      body: JSON.stringify({ query: SQL }),
    },
  ];
  for (const c of candidates) {
    try {
      const r = await fetch(c.url, {
        method: c.method,
        headers,
        body: c.body,
      });
      const text = await r.text();
      console.log(`  ${c.name.padEnd(20)} → HTTP ${r.status}`);
      if (r.ok) {
        console.log(`    ✓ accepted! body: ${text.slice(0, 200)}`);
        return c.name;
      }
    } catch (e) {
      console.log(`  ${c.name.padEnd(20)} → network error: ${(e).message}`);
    }
  }
  return null;
}

async function probeTables() {
  const status = {};
  for (const t of TABLES) {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, {
      headers,
    });
    status[t] = r.status;
  }
  return status;
}

async function main() {
  console.log("Supabase URL:", URL_);

  hr("Attempting DDL via every reachable endpoint");
  const accepted = await tryDDL();
  if (accepted) {
    console.log(`\n✓ Migration applied via ${accepted}`);
  } else {
    console.log(
      "\n✗ No SQL-execution endpoint is reachable with the service-role key."
    );
    console.log(
      "  This is expected on Supabase Cloud. PostgREST exposes data\n" +
        "  operations only — DDL has to run via the SQL Editor or the\n" +
        "  Supabase Management API (which needs a Personal Access Token).\n"
    );
    console.log(
      "  Open the Supabase dashboard → SQL Editor → paste the SQL below."
    );
  }

  hr("Verification — table existence");
  const status = await probeTables();
  for (const t of TABLES) {
    const code = status[t];
    if (code === 200 || code === 206) {
      console.log(`  ✓ ${t.padEnd(20)} (HTTP ${code} — exists, readable)`);
    } else if (code === 401 || code === 403) {
      console.log(
        `  ? ${t.padEnd(20)} (HTTP ${code} — exists but blocked by RLS / role)`
      );
    } else {
      console.log(`  ✗ ${t.padEnd(20)} (HTTP ${code} — not found / error)`);
    }
  }

  if (!accepted) {
    hr("SQL to paste");
    console.log(SQL);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
