import assert from "node:assert/strict";
import { createCipheriv, pbkdf2Sync } from "node:crypto";

const password = "test-only-imd-passphrase";
process.env.LEGACY_MEDIA_PASSWORD = password;

const { contentTypeFromBytes, decryptImdMedia, looksLikePlainMedia } = await import("./imd-media-crypto");

const id3Audio = Buffer.concat([Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "binary"), Buffer.alloc(32, 7)]);
assert.equal(looksLikePlainMedia(id3Audio), true, "ID3 MP3 audio must be recognised as plain media");
assert.equal(contentTypeFromBytes(id3Audio, "application/octet-stream"), "audio/mpeg");

const mpegAudio = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(128, 11)]);
assert.equal(looksLikePlainMedia(mpegAudio), true, "MPEG-frame MP3 audio must be recognised as plain media");

const name = "21508.mp3";
const iv = Buffer.from([17, 115, 105, 102, 103, 104, 111, 107, 108, 122, 120, 119, 118, 98, 110, 109]);
const key = pbkdf2Sync(password, Buffer.from(name, "utf8"), 19, 16, "sha1");
const cipher = createCipheriv("aes-128-cbc", key, iv);
const encrypted = Buffer.concat([cipher.update(mpegAudio), cipher.final()]);
assert.deepEqual(decryptImdMedia(encrypted, [name]), mpegAudio, "Encrypted MP3 audio must be decrypted and returned");

console.log("IMD media audio tests passed");
