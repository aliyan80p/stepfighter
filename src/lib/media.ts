import imgManifest from "@/data/media-manifest.json";
import vidManifest from "@/data/video-manifest.json";

const manifestName: Record<string, string> = {};
for (const k of Object.keys({ ...imgManifest, ...vidManifest } as Record<string, string>)) {
  manifestName[k.toLowerCase()] = k;
}

const QBANK_SLUG: Record<number, string> = { 1: "", 2: "step1", 3: "step3" };
const MEDIA_VERSION = "20261126-media-decrypted";

function mediaRoute(prefix: string, name: string, token?: string): string {
  const tokenPart = token ? `&t=${encodeURIComponent(token)}` : "";
  return `${prefix}${encodeURIComponent(name)}?v=${MEDIA_VERSION}${tokenPart}`;
}

function refreshApiMediaToken(src: string, token?: string): string {
  if (!token) return src;
  try {
    const isAbs = /^https?:\/\//i.test(src);
    const u = new URL(src, "https://local.invalid");
    u.searchParams.set("t", token);
    u.searchParams.delete("r");
    return isAbs ? u.toString() : `${u.pathname}${u.search}${u.hash}`;
  } catch {
    const cleaned = src.replace(/([?&])(t|r)=[^&]*/g, "$1").replace(/[?&]+$/, "");
    const sep = cleaned.includes("?") ? "&" : "?";
    return `${cleaned}${sep}t=${encodeURIComponent(token)}`;
  }
}

function resolve(src: string, qbankId = 1, token?: string): string | null {
  if (/^\/api\/media\//i.test(src)) {
    return token ? refreshApiMediaToken(src, token) : null;
  }
  if (/^(https?:|data:|\/__l5e\/)/i.test(src)) return null;
  const slug = QBANK_SLUG[qbankId] ?? "";
  const prefix = slug ? `/api/media/${slug}/` : `/api/media/`;
  const original = src.split("/").pop() ?? src;
  const base = original.toLowerCase();
  if (qbankId === 1 && manifestName[base]) return mediaRoute(prefix, manifestName[base], token);
  const strippedLower = base.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/, "");
  if (qbankId === 1 && strippedLower !== base && manifestName[strippedLower]) return mediaRoute(prefix, manifestName[strippedLower], token);
  return mediaRoute(prefix, original, token);
}

/** Append or replace the media access token on a raw /api/media URL built outside rewriteMedia. */
export function withMediaToken(url: string, token: string | undefined): string {
  if (!token) return url;
  return refreshApiMediaToken(url, token);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type RewriteMediaOptions = {
  deferMedia?: boolean;
  qbankId?: number;
  mediaToken?: string;
};

function renderImage(url: string, alt: string): string {
  return `<img src="${url}" alt="${escapeAttr(alt)}" class="qbank-inline-media" loading="lazy" decoding="async" />`;
}

function withMediaAnchorClass(openTag: string): string {
  if (/\bclass\s*=/.test(openTag)) {
    return openTag.replace(/\bclass=(['"])(.*?)\1/i, (match, quote, classes) => {
      return String(classes).split(/\s+/).includes("qbank-media-anchor")
        ? match
        : `class=${quote}${classes} qbank-media-anchor${quote}`;
    });
  }
  return openTag.replace(/^<a\b/i, '<a class="qbank-media-anchor"');
}

/** Rewrite media URLs in question HTML to point to the decrypting media route. */
export function rewriteMedia(html: string, options: RewriteMediaOptions = {}): string {
  if (!html) return html;
  const qb = options.qbankId ?? 1;
  const token = options.mediaToken;
  let out = html.replace(
    /(<(?:img|source|video|audio)\b[^>]*\bsrc=)(["'])([^"']+)\2/gi,
    (full, prefix, q, src) => {
      const url = resolve(src, qb, token);
      return url ? `${prefix}${q}${url}${q}` : full;
    },
  );

  const parked: string[] = [];
  const parkMedia = (mediaHtml: string, labelHtml: string) => {
    const idx = parked.push(mediaHtml) - 1;
    return `${labelHtml}<!--QBM:${idx}-->`;
  };

  out = out.replace(
    /<a\b([^>]*?)\bhref=["']([^"']+\.(?:png|jpe?g|gif|webp|bmp|svg))["']([^>]*)>(.*?)<\/a>/gis,
    (full, _before, href, _after, labelHtml) => {
      if (/<img\b/i.test(labelHtml)) return full;
      const url = resolve(href, qb, token);
      if (!url) return full;
      const label = stripTags(labelHtml);
      const media = renderImage(url, label || "Related image");
      if (options.deferMedia) return parkMedia(media, labelHtml);
      return `${labelHtml}${media}`;
    },
  );
  out = out.replace(
    /<a\b([^>]*?)\bhref=(["'])([^"']+\.(?:mp4|webm|mov|m4v|ogv|mp3|wav|ogg|m4a|aac))\2([^>]*)>/gi,
    (full, before, q, href, after) => {
      const url = resolve(href, qb, token);
      if (!url) return withMediaAnchorClass(full);
      return withMediaAnchorClass(`<a${before}href=${q}${url}${q}${after}>`);
    },
  );

  if (options.deferMedia) {
    // Also park any raw <img>/<video>/<audio> tags in the explanation.
    out = out.replace(/<img\b[^>]*>/gi, (tag) => parkMedia(tag, ""));
    out = out.replace(/<video\b[\s\S]*?<\/video>/gi, (tag) => parkMedia(tag, ""));
    out = out.replace(/<audio\b[\s\S]*?<\/audio>/gi, (tag) => parkMedia(tag, ""));

    // Move each parked marker to just after its containing block element.
    const blockClose = /<\/(?:p|li|div|td|tr|section|article|blockquote|figure)>/i;
    let guard = 0;
    while (guard++ < parked.length + 5) {
      const m = out.match(/<!--QBM:(\d+)-->/);
      if (!m) break;
      const idx = Number(m[1]);
      const start = m.index!;
      const afterMarker = start + m[0].length;
      const rest = out.slice(afterMarker);
      const close = rest.match(blockClose);
      const media = `<div class="qbank-inline-media-wrap">${parked[idx]}</div>`;
      if (close) {
        const insertAt = afterMarker + close.index! + close[0].length;
        out = out.slice(0, start) + out.slice(afterMarker, insertAt) + media + out.slice(insertAt);
      } else {
        out = out.slice(0, start) + out.slice(afterMarker) + media;
      }
    }
    out = out.replace(/<!--QBM:\d+-->/g, "");
  }

  out = out.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>');
  return out;
}
