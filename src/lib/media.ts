import imgManifest from "@/data/media-manifest.json";
import vidManifest from "@/data/video-manifest.json";

const map: Record<string, string> = {};
for (const [k, v] of Object.entries({ ...imgManifest, ...vidManifest } as Record<string, string>)) {
  map[k.toLowerCase()] = v;
}

function resolve(src: string): string | null {
  if (/^(https?:|data:|\/__l5e\/|\/api\/media\/)/i.test(src)) return null;
  const original = src.split("/").pop() ?? src;
  const base = original.toLowerCase();
  if (map[base]) return `/api/media/${encodeURIComponent(base)}`;
  const strippedLower = base.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/, "");
  if (strippedLower !== base && map[strippedLower]) return `/api/media/${encodeURIComponent(strippedLower)}`;
  // Fallback: preserve original casing since Supabase Storage is case-sensitive.
  const strippedOriginal = original.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/i, "");
  return `/api/media/${encodeURIComponent(strippedOriginal)}`;
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
  const deferredMedia: string[] = [];
  let out = html.replace(
    /(<(?:img|source|video|audio)\b[^>]*\bsrc=)(["'])([^"']+)\2/gi,
    (full, prefix, q, src) => {
      const url = resolve(src);
      return url ? `${prefix}${q}${url}${q}` : full;
    },
  );
  // The imported qbank often stores explanation images as text links like
  // <a href="media/L20387.png">erosions</a>. Render those media files exactly
  // where the source explanation placed the link instead of grouping them above.
  out = out.replace(
    /<a\b([^>]*?)\bhref=["']([^"']+\.(?:png|jpe?g|gif|webp|bmp|svg))["']([^>]*)>(.*?)<\/a>/gis,
    (full, _before, href, _after, labelHtml) => {
      if (/<img\b/i.test(labelHtml)) return full;
      const url = resolve(href);
      if (!url) return full;
      const label = stripTags(labelHtml);
      const media = renderImage(url, label || "Related image");
      if (options.deferMedia) {
        deferredMedia.push(media);
        return labelHtml;
      }
      return `${labelHtml}${media}`;
    },
  );
  // Convert bare <a href="...mp4"> to inline video players
  out = out.replace(
    /<a\b[^>]*\bhref=["']([^"']+\.(?:mp4|webm|mov|m4v))["'][^>]*>(.*?)<\/a>/gis,
    (full, href, labelHtml) => {
      const url = resolve(href);
      if (!url) return full;
      const media = renderVideo(url);
      if (options.deferMedia) {
        deferredMedia.push(media);
        return labelHtml;
      }
      return media;
    },
  );
  if (options.deferMedia) {
    out = out.replace(/<img\b[^>]*>/gi, (tag) => {
      deferredMedia.push(tag);
      return "";
    });
    out = out.replace(/<video\b[\s\S]*?<\/video>/gi, (tag) => {
      deferredMedia.push(tag);
      return "";
    });
    out = out.replace(/<audio\b[\s\S]*?<\/audio>/gi, (tag) => {
      deferredMedia.push(tag);
      return "";
    });
  }
  // Add lazy loading + async decoding hints to <img> tags for faster perceived load.
  out = out.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>');
  if (deferredMedia.length > 0) {
    const mediaHtml = deferredMedia
      .join("")
      .replace(/<img\b(?![^>]*\bloading=)([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>');
    out = `${out}<div class="qbank-deferred-media">${mediaHtml}</div>`;
  }
  return out;
}
