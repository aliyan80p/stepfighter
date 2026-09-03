#!/usr/bin/env node
// Copies storage object bytes from Lovable Cloud storage into the mirror
// Supabase project. Resumable: skips objects already present with same size.
const BUCKET = process.env.BUCKET || 'qbank-media-plain';
const SRC = process.env.SUPABASE_URL;
const SRC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DST = process.env.MIRROR_SUPABASE_URL;
const DST_KEY = process.env.MIRROR_SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

if (!SRC || !SRC_KEY || !DST || !DST_KEY) throw new Error('missing credentials');

const h = (k) => ({ Authorization: `Bearer ${k}`, apikey: k });

async function listAll(base, key) {
  const out = new Map();
  let offset = 0;
  for (;;) {
    const res = await fetch(`${base}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...h(key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset, prefix: '', sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`list ${base}: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;
    for (const r of rows) if (r.id) out.set(r.name, r.metadata?.size ?? null);
    offset += rows.length;
    if (rows.length < 1000) break;
  }
  return out;
}

async function copyOne(name) {
  const get = await fetch(`${SRC}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, { headers: h(SRC_KEY) });
  if (!get.ok) throw new Error(`download ${name}: ${get.status}`);
  const body = Buffer.from(await get.arrayBuffer());
  const type = get.headers.get('content-type') || 'application/octet-stream';
  const put = await fetch(`${DST}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...h(DST_KEY), 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'public, max-age=31536000, immutable' },
    body,
  });
  if (!put.ok) throw new Error(`upload ${name}: ${put.status} ${await put.text()}`);
  return body.length;
}

// SRC_LIST: CSV of "name,size" (recursive listing exported from storage.objects).
const src = new Map();
if (process.env.SRC_LIST) {
  const fs = await import('node:fs');
  for (const line of fs.readFileSync(process.env.SRC_LIST, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const i = line.lastIndexOf(',');
    src.set(line.slice(0, i), Number(line.slice(i + 1)));
  }
} else {
  for (const [k, v] of await listAll(SRC, SRC_KEY)) src.set(k, v);
}
const dst = await listAll(DST, DST_KEY);
const todo = [...src.entries()].filter(([n, s]) => dst.get(n) !== s).map(([n]) => n);
console.log(`source=${src.size} mirror=${dst.size} to_copy=${todo.length}`);

let done = 0, bytes = 0, failed = [];
const started = Date.now();
async function worker() {
  for (;;) {
    const name = todo.pop();
    if (!name) return;
    try {
      bytes += await copyOne(name);
    } catch (e) {
      failed.push(name);
      if (failed.length < 20) console.error(String(e.message || e));
    }
    if (++done % 200 === 0) {
      const s = (Date.now() - started) / 1000;
      console.log(`${done}/${done + todo.length} copied  ${(bytes / 1e9).toFixed(2)}GB  ${(done / s).toFixed(1)}/s  failed=${failed.length}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`DONE copied=${done} bytes=${(bytes / 1e9).toFixed(2)}GB failed=${failed.length}`);
if (failed.length) console.log('failed sample:', failed.slice(0, 30).join(','));
