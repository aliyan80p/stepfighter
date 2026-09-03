#!/usr/bin/env node
// Phase 2 delta sync: copies user-side rows from the Lovable Supabase project
// into the mirror (own) Supabase project. Idempotent — upserts on primary key,
// never deletes anything on the destination.
//
// Usage: SRC/DST creds from env
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY            (source = Lovable)
//   MIRROR_SUPABASE_URL, MIRROR_SUPABASE_SERVICE_ROLE_KEY (destination = yours)

const SRC = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
const DST = { u: process.env.MIRROR_SUPABASE_URL, k: process.env.MIRROR_SUPABASE_SERVICE_ROLE_KEY };
if (!SRC.u || !SRC.k || !DST.u || !DST.k) throw new Error('missing credentials');

// order matters: parents before children
const TABLES = [
  ['profiles', 'id'],
  ['user_roles', 'id'],
  ['user_entitlements', 'user_id'],
  ['flashcard_decks', 'id'],
  ['flashcards', 'id'],
  ['flashcard_reviews', 'id'],
  ['tests', 'id'],
  ['attempts', 'id'],
  ['bookmarks', 'user_id,question_id'],
  ['question_notes', 'id'],
  ['feedback', 'id'],
  ['qbank_resets', 'id'],
];

const h = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });

async function fetchAll(table) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${SRC.u}/rest/v1/${table}?select=*`, {
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

async function count(env, table) {
  const res = await fetch(`${env.u}/rest/v1/${table}?select=*`, {
    headers: { ...h(env.k), Prefer: 'count=exact', Range: '0-0' },
  });
  return Number((res.headers.get('content-range') || '/0').split('/')[1]) || 0;
}

for (const [table, conflict] of TABLES) {
  const rows = await fetchAll(table);
  if (rows.length) await upsert(table, conflict, rows);
  const after = await count(DST, table);
  console.log(`${table.padEnd(20)} source=${String(rows.length).padEnd(6)} dest=${after}`);
}
console.log('done');
