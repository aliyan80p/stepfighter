import manifest from "@/data/media-manifest.json";

const map = manifest as Record<string, string>;
// Case-insensitive lookup
const lower: Record<string, string> = {};
for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;

/** Rewrite <img src="L1234.jpg"> to point to the CDN-hosted asset. */
export function rewriteMedia(html: string): string {
  if (!html) return html;
  return html.replace(/(<img\b[^>]*\bsrc=)(["'])([^"']+)\2/gi, (full, prefix, quote, src) => {
    if (/^(https?:|data:|\/__l5e\/)/i.test(src)) return full;
    const base = src.split("/").pop() ?? src;
    const url = lower[base.toLowerCase()];
    if (!url) return full;
    return `${prefix}${quote}${url}${quote}`;
  });
}
