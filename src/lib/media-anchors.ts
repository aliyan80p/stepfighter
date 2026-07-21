/**
 * Detect inline media anchors inside a rendered HTML container and rewrite them
 * as click-to-open triggers for an ExhibitModal (Fighter pattern).
 *
 * When explanation prose contains a link like
 *     <a href="https://.../42654-7.mp4">decrease LVOT obstruction</a>
 * this decorates the anchor with a ▶ glyph, marks it as a media trigger, and
 * intercepts clicks so the parent can open a centered <video>/<audio> exhibit.
 */

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i;

export type MediaAnchorKind = "video" | "audio";

export interface MediaAnchorHit {
  kind: MediaAnchorKind;
  src: string;
  label: string;
}

export function detectAnchorKind(href: string): MediaAnchorKind | null {
  if (AUDIO_EXT.test(href)) return "audio";
  if (VIDEO_EXT.test(href)) return "video";
  return null;
}

/**
 * Walk a container and decorate media anchors in-place. Returns a
 * disposer that removes the click handler.
 */
export function attachMediaAnchorHandlers(
  root: HTMLElement,
  onOpen: (hit: MediaAnchorHit) => void,
): () => void {
  const anchors = root.querySelectorAll<HTMLAnchorElement>("a[href]");
  anchors.forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const kind = detectAnchorKind(href);
    if (!kind) return;
    if (a.dataset.mediaDecorated === "1") return;
    a.dataset.mediaDecorated = "1";
    a.dataset.mediaKind = kind;
    a.classList.add("qbank-media-anchor");
    // Fighter renders plain blue underlined links — no glyph.

  });

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const a = target?.closest?.("a[data-media-decorated='1']") as HTMLAnchorElement | null;
    if (!a || !root.contains(a)) return;
    const href = a.getAttribute("href");
    const kind = (a.dataset.mediaKind as MediaAnchorKind | undefined) ?? null;
    if (!href || !kind) return;
    e.preventDefault();
    e.stopPropagation();
    onOpen({ kind, src: href, label: a.textContent?.trim() || "Exhibit" });
  };

  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
