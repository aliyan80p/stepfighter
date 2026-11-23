#!/usr/bin/env node
/**
 * Decrypt legacy-encrypted media files (the ones stored in the `qbank-media`
 * bucket and mirrored to Google Drive → StepFighter Media Backup / qbank-media).
 *
 * Files in `qbank-media-plain` are already plain and are copied through as-is.
 *
 * Usage:
 *   node scripts/decrypt-media.mjs <inputDir> <outputDir>
 *   node scripts/decrypt-media.mjs ./L10140.jpg ./out
 *
 * The AES key is derived from the *file name*, so do not rename files before
 * decrypting. Flattened names (`step1__L62835.jpg`) are handled: the part after
 * the last `__` is used as the key name and the folder structure is restored.
 */
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";

// Passphrase comes from the environment: LEGACY_MEDIA_PASSWORD=... node scripts/decrypt-media.mjs ...
const PASSWORD = process.env.LEGACY_MEDIA_PASSWORD;
if (!PASSWORD) {
  console.error("LEGACY_MEDIA_PASSWORD env var is required");
  process.exit(1);
}
const IV = Buffer.from([17, 115, 105, 102, 103, 104, 111, 107, 108, 122, 120, 119, 118, 98, 110, 109]);

const isMp3 = (b) => {
  if (b.subarray(0, 3).toString("ascii") === "ID3") return true;
  if (b.length < 4) return false;
  const header = b.readUInt32BE(0);
  return (
    ((header & 0xffe00000) >>> 0) === 0xffe00000 &&
    ((header >>> 19) & 3) !== 1 &&
    ((header >>> 17) & 3) !== 0 &&
    ((header >>> 12) & 15) !== 15 &&
    ((header >>> 10) & 3) !== 3
  );
};

const isPlain = (b) =>
  b.length > 12 &&
  (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    b.subarray(0, 6).toString("ascii").startsWith("GIF8") ||
    (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") ||
    b.subarray(4, 8).toString("ascii") === "ftyp" ||
    isMp3(b) ||
    b.subarray(0, 4).toString("ascii") === "OggS" ||
    (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE"));

function tryDecrypt(data, name) {
  let padded = name;
  while (padded.length < 8) padded += " ";
  try {
    const key = pbkdf2Sync(PASSWORD, Buffer.from(padded, "utf8"), 19, 16, "sha1");
    const d = createDecipheriv("aes-128-cbc", key, IV);
    const out = Buffer.concat([d.update(data), d.final()]);
    return isPlain(out) ? out : null;
  } catch {
    return null;
  }
}

function candidates(name) {
  const set = new Set([name, name.toLowerCase()]);
  if (/^[LU]\d/i.test(name)) {
    set.add("L" + name.slice(1));
    set.add("U" + name.slice(1));
  }
  return [...set];
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("usage: node scripts/decrypt-media.mjs <inputFileOrDir> <outputDir>");
  process.exit(1);
}

const files = statSync(input).isDirectory() ? walk(input) : [input];
let ok = 0;
let plain = 0;
let failed = 0;

for (const file of files) {
  const flat = basename(file);
  const keyName = flat.includes("__") ? flat.slice(flat.lastIndexOf("__") + 2) : flat;
  const relative = flat.split("__").join("/");
  const target = join(outDir, relative);
  const data = readFileSync(file);

  let result = null;
  if (isPlain(data)) {
    result = data;
    plain += 1;
  } else {
    for (const name of candidates(keyName)) {
      result = tryDecrypt(data, name);
      if (result) break;
    }
    if (result) ok += 1;
  }

  if (!result) {
    failed += 1;
    console.warn("could not decrypt:", flat);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, result);
}

console.log(`decrypted ${ok}, already plain ${plain}, failed ${failed} → ${outDir}`);
