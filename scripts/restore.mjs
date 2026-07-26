#!/usr/bin/env node
/**
 * StepFighter restore tool. See docs/RESTORE.md.
 *
 *   node scripts/restore.mjs auth      ./backup/2026-07-26     (needs NEW_DB_URL)
 *   node scripts/restore.mjs data      ./backup/2026-07-26     (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   node scripts/restore.mjs sequences
 *
 * Backup files are gzipped JSON: { table: string, rows: object[] }
 */

import { readdir, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const BATCH = 500;

// Restored in this order so foreign keys resolve.
const ORDER = [
  // content
  "qbanks", "subjects", "systems", "questions", "answers", "refs",
  "qbank_media", "library_docs", "library_toc",
  // user data
  "profiles", "user_roles", "user_entitlements", "internal_config",
  "tests", "attempts", "bookmarks", "question_notes",
  "flashcard_decks", "flashcards", "flashcard_reviews",
  "feedback", "qbank_resets",
];

const SERIAL_TABLES = [
  "questions", "answers", "qbanks", "subjects", "systems",
  "refs", "library_docs", "library_toc", "qbank_media",
];

async function loadDump(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json.gz")).sort();
  /** @type {Map<string, object[]>} */
  const tables = new Map();
  for (const f of files) {
    const raw = gunzipSync(await readFile(path.join(dir, f)));
    const parsed = JSON.parse(raw.toString("utf8"));
    const name = parsed.table ?? f.split("-")[0];
    const rows = parsed.rows ?? [];
    tables.set(name, (tables.get(name) ?? []).concat(rows));
  }
  return tables;
}

async function restoreData(dir) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const tables = await loadDump(dir);
  for (const table of ORDER) {
    const rows = tables.get(table);
    if (!rows?.length) { console.log(`- ${table}: nothing in backup, skipped`); continue; }
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(`${table} @${i}: ${res.status} ${await res.text()}`);
      done += chunk.length;
      process.stdout.write(`\r- ${table}: ${done}/${rows.length}`);
    }
    process.stdout.write("\n");
  }
  console.log("\nData restore complete. Now run: node scripts/restore.mjs sequences");
}

async function restoreAuth(dir) {
  const dbUrl = process.env.NEW_DB_URL;
  if (!dbUrl) throw new Error("NEW_DB_URL (direct Postgres connection string) is required");
  const { default: pg } = await import("pg");
  const tables = await loadDump(dir);

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("ALTER TABLE auth.users DISABLE TRIGGER USER");
    for (const table of ["users", "identities", "mfa_factors"]) {
      const rows = tables.get(table) ?? [];
      if (!rows.length) { console.log(`- auth.${table}: empty, skipped`); continue; }
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
        const ph = cols.map((_, i) => `$${i + 1}`).join(",");
        await client.query(
          `INSERT INTO auth.${table} (${cols.map((c) => `"${c}"`).join(",")})
           VALUES (${ph}) ON CONFLICT (id) DO NOTHING`,
          vals,
        );
      }
      console.log(`- auth.${table}: ${rows.length} rows`);
    }
  } finally {
    await client.query("ALTER TABLE auth.users ENABLE TRIGGER USER").catch(() => {});
    await client.end();
  }
  console.log("\nAuth restore complete. Users can sign in with their existing passwords.");
}

function printSequences() {
  console.log("-- run against the restored database:");
  for (const t of SERIAL_TABLES) {
    console.log(
      `SELECT setval(pg_get_serial_sequence('public.${t}','id'), ` +
      `GREATEST(COALESCE((SELECT MAX(id) FROM public.${t}),1),1));`,
    );
  }
}

const [mode, dir] = process.argv.slice(2);
try {
  if (mode === "data") await restoreData(dir ?? "./backup");
  else if (mode === "auth") await restoreAuth(dir ?? "./backup");
  else if (mode === "sequences") printSequences();
  else {
    console.log("usage: restore.mjs <auth|data|sequences> [backup-dir]");
    process.exit(1);
  }
} catch (err) {
  console.error("\nRESTORE FAILED:", err.message);
  process.exit(1);
}
