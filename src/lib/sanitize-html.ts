// Dependency-free allowlist HTML sanitizer.
// Used for any user-authored rich text that is rendered with
// dangerouslySetInnerHTML (flashcards). Runs on both server and client so
// stored values are cleaned on write AND on render (defence in depth).

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "sub", "sup",
  "ul", "ol", "li", "blockquote", "code", "pre", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tr", "th", "td", "hr", "a", "img",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
};

const SAFE_URL = /^(https?:|mailto:|\/|#)/i;
const SAFE_IMG_SRC = /^(https?:\/\/|\/|data:image\/(png|jpe?g|gif|webp);base64,)/i;

function safeAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  let out = "";
  const re = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (!allowed.has(name)) continue;
    const value = (m[3] ?? m[4] ?? m[5] ?? "").trim();
    if (name === "href" && !SAFE_URL.test(value)) continue;
    if (name === "src" && !SAFE_IMG_SRC.test(value)) continue;
    if (/^on/i.test(name)) continue;
    out += ` ${name}="${value.replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`;
  }
  if (tag === "a" && /href=/.test(out)) out += ' rel="noopener noreferrer nofollow"';
  return out;
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input);
  // Drop entire dangerous elements including their content.
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|svg|math|form|input|button|textarea|select|base)\b[\s\S]*?(<\/\s*\1\s*>|$)/gi,
    "",
  );
  // Drop comments (can hide conditional-comment payloads).
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_full, slash: string, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (slash) return `</${tag}>`;
    const selfClosing = tag === "br" || tag === "hr" || tag === "img";
    return `<${tag}${safeAttrs(tag, attrs)}${selfClosing ? " /" : ""}>`;
  });
}

/** Image fields accept only https URLs or base64 image data URLs. */
export function sanitizeImageSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  return SAFE_IMG_SRC.test(value.trim()) ? value.trim() : null;
}
