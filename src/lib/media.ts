import imgManifest from "@/data/media-manifest.json";
import vidManifest from "@/data/video-manifest.json";

const map: Record<string, string> = {};
for (const [k, v] of Object.entries({ ...imgManifest, ...vidManifest } as Record<string, string>)) {
  map[k.toLowerCase()] = v;
}

function resolve(src: string): string | null {
  if (/^(https?:|data:|\/__l5e\/|\/api\/media\/)/i.test(src)) return null;
  const base = (src.split("/").pop() ?? src).toLowerCase();
  if (map[base]) return map[base];
  const stripped = base.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/, "");
  if (stripped !== base && map[stripped]) return map[stripped];
  // Fallback: proxy from Google Drive media-E folder via server route
  return `/api/media/${encodeURIComponent(stripped)}`;
}


/** Rewrite media URLs in question HTML to point to CDN-hosted assets. */
export function rewriteMedia(html: string): string {
  if (!html) return html;
  let out = html.replace(
    /(<(?:img|source|video|audio)\b[^>]*\bsrc=)(["'])([^"']+)\2/gi,
    (full, prefix, q, src) => {
      const url = resolve(src);
      return url ? `${prefix}${q}${url}${q}` : full;
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
  return out;
}
