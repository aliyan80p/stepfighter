#!/usr/bin/env node
// Copies QBank CONTENT (questions and everything attached to them) from the
// Lovable Supabase project into your own managed Supabase project.
// Idempotent — upserts on primary key, never deletes on the destination.
//
// Source (Lovable):      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Destination (yours):   MANAGED_SUPABASE_URL, MANAGED_SUPABASE_SERVICE_ROLE_KEY
//                        (falls back to MIRROR_SUPABASE_* if managed not set)
//
// Usage:
//   node scripts/sync-qbank-content.mjs                # all qbanks
//   node scripts/sync-qbank-content.mjs --qbank=nbme29 # one qbank slug
//   node scripts/sync-qbank-content.mjs --dry-run      # report only

const SRC = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
const DST = {
  u: process.env.MANAGED_SUPABASE_URL || process.env.MIRROR_SUPABASE_URL,
  k: process.env.MANAGED_SUPABASE_SERVICE_ROLE_KEY || process.env.MIRROR_SUPABASE_SERVICE_ROLE_KEY,
};
if (!SRC.u || !SRC.k || !DST.u || !DST.k) throw new Error('missing credentials');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const slugArg = args.find((a) => a.startsWith('--qbank='));
const SLUG = slugArg ? slugArg.split('=')[1] : null;

// parents before children; each entry: [table, conflictTarget]
const TABLES = [
  ['qbanks', 'id'],
  ['subjects', 'id'],
  ['systems', 'id'],
  ['questions', 'id'],
  ['answers', 'id'],
  ['refs', 'id'],
  ['library_docs', 'id'],
  ['library_toc', 'id'],
  ['qbank_media', 'qbank_id,name'],
];

const h = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });

async function resolveQbankIds() {
  if (!SLUG) return null;
  const res = await fetch(`${SRC.u}/rest/v1/qbanks?select=id,slug&slug=eq.${encodeURIComponent(SLUG)}`, {
    headers: h(SRC.k),
  });
  const rows = await res.json();
  if (!res.ok || !rows.length) throw new Error(`qbank slug "${SLUG}" not found in source`);
  return rows.map((r) => r.id);
}

function filterFor(table, ids) {
  if (!ids) return '';
  const col = table === 'qbanks' ? 'id' : 'qbank_id';
  return `&${col}=in.(${ids.join(',')})`;
}

async function fetchAll(table, ids) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${SRC.u}/rest/v1/${table}?select=*${filterFor(table, ids)}`, {
      headers: { ...h(SRC.k), Range: `${from}-${from + page - 1}` },
    });
    if (!res.ok) throw new Error(`read ${table}: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

async function upsert(table, conflict, rows) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const res = await fetch(`${DST.u}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...h(DST.k), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + chunk)),
    });
    if (!res.ok) throw new Error(`write ${table}: ${res.status} ${await res.text()}`);
  }
}

async function count(env, table, ids) {
  const res = await fetch(`${env.u}/rest/v1/${table}?select=id${filterFor(table, ids)}`, {
    headers: { ...h(env.k), Prefer: 'count=exact', Range: '0-0' },
  });
  return Number((res.headers.get('content-range') || '/0').split('/')[1]) || 0;
}

const ids = await resolveQbankIds();
console.log(`scope: ${SLUG ? `qbank ${SLUG} (id ${ids.join(',')})` : 'all qbanks'}${DRY ? ' [dry run]' : ''}`);

for (const [table, conflict] of TABLES) {
  const rows = await fetchAll(table, ids);
  if (rows.length && !DRY) await upsert(table, conflict, rows);
  const after = DRY ? await count(DST, table, ids) : await count(DST, table, ids);
  console.log(`${table.padEnd(16)} source=${String(rows.length).padEnd(7)} dest=${after}`);
}
console.log('done');
