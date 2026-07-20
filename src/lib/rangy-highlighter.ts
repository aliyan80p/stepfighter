// Rangy-based highlighter helpers.
// Modeled on the IMD app's approach: use rangy's CssClassApplier to wrap
// arbitrary selection ranges in a semantic tag, and rely on the browser's
// native selection to drive the drag-extend UX.
//
// We expose a color-agnostic API: pass a hex color and we allocate/reuse
// a CSS class named "qbank-hl-<colorHash>" so highlights survive
// serialization (innerHTML snapshot) and can be re-applied by class.

let rangyPromise: Promise<any> | null = null;
async function loadRangy(): Promise<any> {
  if (!rangyPromise) {
    rangyPromise = (async () => {
      const [core, classapplier] = await Promise.all([
        import("rangy/lib/rangy-core.js"),
        import("rangy/lib/rangy-classapplier.js"),
      ]);
      const rangy = (core as any).default ?? core;
      // classapplier module registers itself onto the same rangy singleton
      void classapplier;
      if (!rangy.initialized) rangy.init();
      return rangy;
    })();
  }
  return rangyPromise;
}

const appliers = new Map<string, any>();

function classForColor(color: string): string {
  // Normalize to a stable, CSS-safe class name.
  const key = color.replace(/[^a-z0-9]/gi, "").toLowerCase() || "def";
  return `qbank-hl-${key}`;
}

function ensureStyle(cls: string, color: string, opts?: { strike?: boolean }) {
  if (typeof document === "undefined") return;
  const id = `style-${cls}`;
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = opts?.strike
    ? `.${cls}{background-color:transparent!important;color:inherit!important;text-decoration:line-through!important;text-decoration-color:${color}!important;}`
    : `.${cls}{background-color:${color}!important;color:inherit!important;}`;
}

async function getApplier(cls: string) {
  const rangy = await loadRangy();
  let a = appliers.get(cls);
  if (!a) {
    a = rangy.createClassApplier(cls, {
      elementTagName: "mark",
      elementProperties: { className: `${cls} qbank-hl` },
      ignoreWhiteSpace: true,
      tagNames: ["mark", "span", "hl", "a", "b", "i", "em", "strong", "u"],
      normalize: true,
    });
    appliers.set(cls, a);
  }
  return a;
}

/**
 * Apply a highlight to the current browser selection (or provided range).
 * Uses rangy internally so partial nodes, multi-line, and cross-element
 * selections all wrap correctly — this is what UWorld/IMD do.
 */
export async function applyHighlight(color: string, range?: Range, opts?: { strike?: boolean }) {
  const cls = opts?.strike ? `${classForColor(color)}-strike` : classForColor(color);
  ensureStyle(cls, color, opts);
  const applier = await getApplier(cls);
  const rangy = await loadRangy();
  if (range) {
    const rr = rangy.createRange();
    rr.setStart(range.startContainer, range.startOffset);
    rr.setEnd(range.endContainer, range.endOffset);
    applier.applyToRange(rr);
  } else {
    const sel = rangy.getSelection();
    if (!sel || sel.isCollapsed) return;
    applier.applyToSelection();
  }
}

/**
 * Remove any qbank highlight marks that intersect the given range (or the
 * live selection when omitted).
 */
export function unwrapHighlightsInRange(root: HTMLElement, range: Range) {
  const marks = root.querySelectorAll<HTMLElement>("mark.qbank-hl");
  marks.forEach((m) => {
    if (!range.intersectsNode(m)) return;
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  });
  root.normalize();
}
