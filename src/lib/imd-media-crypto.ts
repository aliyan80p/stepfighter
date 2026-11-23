import { createDecipheriv, pbkdf2Sync } from "crypto";

// Server-only. The legacy media passphrase lives in the LEGACY_MEDIA_PASSWORD
// env var (never in source). Read per-request because Cloudflare Workers inject
// env bindings at request time rather than module import time.
// IVs are not secret.
const LEGACY_MEDIA_IV = Buffer.from([
  17, 115, 105, 102, 103, 104, 111, 107, 108, 122, 120, 119, 118, 98, 110, 109,
]);

function paddedName(name: string): Buffer {
  let padded = name;
  while (padded.length < 8) padded += " ";
  return Buffer.from(padded, "utf8");
}

function tryLegacyDecrypt(data: Buffer, name: string): Buffer | null {
  const password = process.env.LEGACY_MEDIA_PASSWORD ?? "";
  if (!password) return null;
  try {
    const key = pbkdf2Sync(password, paddedName(name), 19, 16, "sha1");
    const decipher = createDecipheriv("aes-128-cbc", key, LEGACY_MEDIA_IV);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    return null;
  }
}

export function looksLikePlainMedia(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  const b = Buffer.from(data.subarray(0, 32));
  return (
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    b.subarray(0, 6).toString("ascii") === "GIF87a" ||
    b.subarray(0, 6).toString("ascii") === "GIF89a" ||
    (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") ||
    (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE") ||
    b.subarray(0, 3).toString("ascii") === "ID3" ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0x00) ||
    b.subarray(0, 4).toString("ascii") === "OggS" ||
    b.subarray(0, 4).toString("ascii") === "fLaC" ||
    b.subarray(4, 8).toString("ascii") === "ftyp" ||
    b.subarray(0, 5).toString("utf8").toLowerCase() === "<?xml" ||
    b.subarray(0, 4).toString("utf8").toLowerCase() === "<svg"
  );
}

export function decryptImdMedia(data: Uint8Array, names: string[]): Buffer {
  const input = Buffer.from(data);
  if (looksLikePlainMedia(input)) return input;

  const attempts = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    attempts.add(name);
    attempts.add(name.toLowerCase());
    if (/^L\d/i.test(name)) attempts.add(`U${name.slice(1)}`);
    if (/^U\d/i.test(name)) attempts.add(`L${name.slice(1)}`);
  }

  for (const name of attempts) {
    const decrypted = tryLegacyDecrypt(input, name);
    if (decrypted && looksLikePlainMedia(decrypted)) return decrypted;
  }

  return input;
}

export function contentTypeFromBytes(data: Uint8Array, fallback: string): string {
  const b = Buffer.from(data.subarray(0, 32));
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  if (b.subarray(0, 3).toString("ascii") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0x00)) return "audio/mpeg";
  if (b.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg";
  if (b.subarray(0, 4).toString("ascii") === "fLaC") return "audio/flac";
  if (b.subarray(4, 8).toString("ascii") === "ftyp") return fallback.startsWith("audio/") ? "audio/mp4" : "video/mp4";
  return fallback;
}