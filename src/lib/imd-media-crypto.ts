import { createDecipheriv, pbkdf2Sync } from "crypto";

// Server-only. The legacy media passphrase lives in the LEGACY_MEDIA_PASSWORD
// env var (never in source). Without it, legacy files are passed through as-is.
const LEGACY_MEDIA_PASSWORD = process.env.LEGACY_MEDIA_PASSWORD ?? "";
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
  if (!LEGACY_MEDIA_PASSWORD) return null;
  try {
    const key = pbkdf2Sync(LEGACY_MEDIA_PASSWORD, paddedName(name), 19, 16, "sha1");
    const decipher = createDecipheriv("aes-128-cbc", key, LEGACY_MEDIA_IV);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    return null;
  }
}

function looksLikeMp3(b: Buffer): boolean {
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
    b.subarray(4, 8).toString("ascii") === "ftyp" ||
    looksLikeMp3(b) ||
    b.subarray(0, 4).toString("ascii") === "OggS" ||
    (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE") ||
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
  if (b.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (looksLikeMp3(b)) return "audio/mpeg";
  if (b.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  return fallback;
}