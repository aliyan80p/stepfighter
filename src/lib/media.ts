import imgManifest from "@/data/media-manifest.json";
import vidManifest from "@/data/video-manifest.json";

const map: Record<string, string> = {};
for (const [k, v] of Object.entries({ ...imgManifest, ...vidManifest } as Record<string, string>)) {
  map[k.toLowerCase()] = v;
}

const QBANK_SLUG: Record<number, string> = { 1: "", 2: "step1" };

function resolve(src: string, qbankId = 1): string | null {
  if (/^(https?:|data:|\/__l5e\/|\/api\/media\/)/i.test(src)) return null;
  const slug = QBANK_SLUG[qbankId] ?? "";
  const prefix = slug ? `/api/media/${slug}/` : `/api/media/`;
  const original = src.split("/").pop() ?? src;
  const base = original.toLowerCase();
  if (qbankId === 1 && map[base]) return `${prefix}${encodeURIComponent(base)}`;
  const strippedLower = base.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/, "");
  if (qbankId === 1 && strippedLower !== base && map[strippedLower]) return `${prefix}${encodeURIComponent(strippedLower)}`;
  const strippedOriginal = original.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/i, "");
  return `${prefix}${encodeURIComponent(strippedOriginal)}`;
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
};

function renderImage(url: string, alt: string): string {
  return `<img src="${url}" alt="${escapeAttr(alt)}" class="qbank-inline-media" loading="lazy" decoding="async" />`;
}

function renderVideo(url: string): string {
  return `<video controls preload="metadata" class="qbank-inline-media" style="max-width:100%"><source src="${url}"></video>`;
}


/** Rewrite media URLs in question HTML to point to the decrypting media route. */
export function rewriteMedia(html: string, options: RewriteMediaOptions = {}): string {
  if (!html) return html;
  let out = html.replace(
    /(<(?:img|source|video|audio)\b[^>]*\bsrc=)(["'])([^"']+)\2/gi,
    (full, prefix, q, src) => {
      const url = resolve(src);
      return url ? `${prefix}${q}${url}${q}` : full;
    },
  );

  // The imported qbank stores explanation media as text links like
  // <a href="media/L20387.png">erosions</a>. We keep the label inline where
  // the author put it, but insert the actual <img>/<video> AFTER the
  // containing block element (p, li, div, td, ...) so it doesn't split
  // the sentence.
  const parked: string[] = [];
  const parkMedia = (mediaHtml: string, labelHtml: string) => {
    const idx = parked.push(mediaHtml) - 1;
    return `${labelHtml}<!--QBM:${idx}-->`;
  };

  out = out.replace(
    /<a\b([^>]*?)\bhref=["']([^"']+\.(?:png|jpe?g|gif|webp|bmp|svg))["']([^>]*)>(.*?)<\/a>/gis,
    (full, _before, href, _after, labelHtml) => {
      if (/<img\b/i.test(labelHtml)) return full;
      const url = resolve(href);
      if (!url) return full;
      const label = stripTags(labelHtml);
      const media = renderImage(url, label || "Related image");
      if (options.deferMedia) return parkMedia(media, labelHtml);
      return `${labelHtml}${media}`;
    },
  );
  out = out.replace(
    /<a\b[^>]*\bhref=["']([^"']+\.(?:mp4|webm|mov|m4v))["'][^>]*>(.*?)<\/a>/gis,
    (full, href, labelHtml) => {
      const url = resolve(href);
      if (!url) return full;
      const media = renderVideo(url);
      if (options.deferMedia) return parkMedia(media, labelHtml);
      return media;
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
