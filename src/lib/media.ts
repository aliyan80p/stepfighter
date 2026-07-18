import imgManifest from "@/data/media-manifest.json";
import vidManifest from "@/data/video-manifest.json";

const map: Record<string, string> = {};
for (const [k, v] of Object.entries({ ...imgManifest, ...vidManifest } as Record<string, string>)) {
  map[k.toLowerCase()] = v;
}

function resolve(src: string): string | null {
  if (/^(https?:|data:|\/__l5e\/|\/api\/media\/)/i.test(src)) return null;
  const base = (src.split("/").pop() ?? src).toLowerCase();
  if (map[base]) return `/api/media/${encodeURIComponent(base)}`;
  const stripped = base.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/, "");
  if (stripped !== base && map[stripped]) return `/api/media/${encodeURIComponent(stripped)}`;
  // Fallback: proxy media through the server route, which decrypts app media.
  return `/api/media/${encodeURIComponent(stripped)}`;
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


/** Rewrite media URLs in question HTML to point to the decrypting media route. */
export function rewriteMedia(html: string): string {
  if (!html) return html;
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
    (full, before, href, after, labelHtml) => {
      if (/<img\b/i.test(labelHtml)) return full;
      const url = resolve(href);
      if (!url) return full;
      const label = stripTags(labelHtml);
      const alt = escapeAttr(label || "Related image");
      return `${labelHtml}<img src="${url}" alt="${alt}" class="qbank-inline-media" loading="lazy" decoding="async" />`;
    },
  );
  // Convert bare <a href="...mp4"> to inline video players
  out = out.replace(
    /<a\b[^>]*\bhref=["']([^"']+\.(?:mp4|webm|mov|m4v))["'][^>]*>.*?<\/a>/gi,
    (full, href) => {
      const url = resolve(href);
      return url
        ? `<video controls preload="metadata" style="max-width:100%"><source src="${url}"></video>`
        : full;
    },
  );
  // Add lazy loading + async decoding hints to <img> tags for faster perceived load.
  out = out.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>');
  return out;
}
