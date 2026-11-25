#!/usr/bin/env node
// One-time: decrypt legacy-encrypted .jpg/.png left in qbank-media-plain.
// Usage: STORE_URL=... STORE_KEY=... LEGACY_MEDIA_PASSWORD=... node scripts/fix-encrypted-images.mjs [--dry]
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
const URL_ = process.env.STORE_URL, KEY = process.env.STORE_KEY, PW = process.env.LEGACY_MEDIA_PASSWORD;
const DRY = process.argv.includes("--dry");
const BUCKET = "qbank-media-plain";
const IV = Buffer.from([17,115,105,102,103,104,111,107,108,122,120,119,118,98,110,109]);
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const magic = (b) => b.length >= 4 && (
  (b[0]===0xff&&b[1]===0xd8&&b[2]===0xff) || (b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47) ||
  (b[0]===0x47&&b[1]===0x49&&b[2]===0x46&&b[3]===0x38) || (b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46));
const ctype = (b) => b[0]===0xff?"image/jpeg":b[0]===0x89?"image/png":b[0]===0x47?"image/gif":"image/webp";
async function list(prefix) {
  const out = [];
  for (let offset = 0;; offset += 1000) {
    const r = await fetch(`${URL_}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }) });
    const j = await r.json(); if (!Array.isArray(j)) throw new Error(JSON.stringify(j));
    out.push(...j); if (j.length < 1000) break;
  }
  return out.filter((o) => o.id).map((o) => ({ path: prefix ? `${prefix}/${o.name}` : o.name, name: o.name, size: o.metadata?.size ?? 0 }));
}
function decrypt(data, name) {
  const cands = new Set([name, name.toLowerCase()]);
  if (/^[LU]\d/i.test(name)) { cands.add("L"+name.slice(1)); cands.add("U"+name.slice(1)); }
  for (let n of cands) { while (n.length < 8) n += " ";
    try { const k = pbkdf2Sync(PW, Buffer.from(n,"utf8"), 19, 16, "sha1"); const d = createDecipheriv("aes-128-cbc", k, IV);
      const o = Buffer.concat([d.update(data), d.final()]); if (magic(o)) return o; } catch {} }
  return null;
}
const all = [...await list(""), ...await list("step1"), ...await list("step3")];
const cand = all.filter((f) => /\.(jpe?g|png)$/i.test(f.name) && f.size > 0 && f.size % 16 === 0);
let decrypted = 0, skipped = 0, failed = 0; const fails = [];
let i = 0;
async function worker() { while (i < cand.length) { const f = cand[i++];
  const enc = f.path.split("/").map(encodeURIComponent).join("/");
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${enc}`, { headers: H });
  const b = Buffer.from(await r.arrayBuffer());
  if (magic(b)) { skipped++; continue; }
  const out = decrypt(b, f.name);
  if (!out) { failed++; fails.push(f.path); continue; }
  if (!DRY) { const u = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${enc}`, { method: "PUT", headers: { ...H, "content-type": ctype(out), "x-upsert": "true", "cache-control": "3600" }, body: out });
    if (!u.ok) { failed++; fails.push(f.path + " upload " + u.status); continue; } }
  decrypted++; } }
await Promise.all(Array.from({ length: 12 }, worker));
console.log(JSON.stringify({ totalFiles: all.length, candidates: cand.length, decrypted, skippedAlreadyPlain: skipped, failed, fails: fails.slice(0, 30), dry: DRY }));
