// Cross-device highlighter — no Rangy, no runtime dep.
//
// Wraps arbitrary Range objects in <mark class="qbank-hl" data-color=... [data-strike]>.
// Handles: partial nodes, cross-element ranges, overlapping highlights
// (replace-on-overlap semantics like UWorld), precise erase, cleanup/merge.
//
// Storage stays the innerHTML snapshot in localStorage (per-question, per hlkey)
// so nothing about persistence changes for existing users.

const MARK_TAG = "MARK";
const MARK_CLASS = "qbank-hl";
const SKIP_SELECTOR = "img,video,audio,svg,canvas,iframe,.qbank-inline-media-wrap";

function isSkippable(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return (node as Element).matches?.(SKIP_SELECTOR) ?? false;
}

function isMark(node: Node | null): node is HTMLElement {
  return !!node && node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === MARK_TAG && (node as Element).classList.contains(MARK_CLASS);
}

/** Collect every text node fully or partially inside the range, in document order. */
function textNodesInRange(range: Range): Text[] {
  const root = range.commonAncestorContainer;
  const rootEl: Node = root.nodeType === Node.ELEMENT_NODE ? root : (root.parentNode as Node);
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        return isSkippable(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      const text = n as Text;
      if (!text.textContent) return NodeFilter.FILTER_REJECT;
      // NodeIterator-like intersects test using a probe range
      const probe = document.createRange();
      try {
        probe.selectNodeContents(text);
      } catch {
        return NodeFilter.FILTER_REJECT;
      }
      const startsBefore = probe.compareBoundaryPoints(Range.END_TO_START, range) < 0;
      const endsAfter = probe.compareBoundaryPoints(Range.START_TO_END, range) > 0;
      return startsBefore && endsAfter ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  return nodes;
}

/** Split a text node so [start,end) becomes its own text node; returns that middle node. */
function sliceTextNode(node: Text, start: number, end: number): Text {
  const len = node.length;
  const s = Math.max(0, Math.min(len, start));
  const e = Math.max(s, Math.min(len, end));
  let middle: Text = node;
  if (e < len) middle.splitText(e); // tail becomes next sibling
  if (s > 0) middle = middle.splitText(s); // middle becomes new text starting at s
  return middle;
}

/** Unwrap a <mark> element in place: replace it with its children. */
function unwrapMark(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
}

/** Remove any qbank-hl marks that intersect the range, splitting them at the range boundaries. */
export function eraseInRange(root: HTMLElement, range: Range) {
  // Snapshot first — mutating during iteration is fine because we work on the *original* mark set.
  const marks = Array.from(root.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`));
  for (const m of marks) {
    if (!range.intersectsNode(m)) continue;
    // Compute the sub-range of the mark that falls inside `range`.
    const markRange = document.createRange();
    markRange.selectNodeContents(m);
    const cut = document.createRange();
    // start = max(range.start, markRange.start)
    if (range.compareBoundaryPoints(Range.START_TO_START, markRange) > 0) {
      cut.setStart(range.startContainer, range.startOffset);
    } else {
      cut.setStart(markRange.startContainer, markRange.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, markRange) < 0) {
      cut.setEnd(range.endContainer, range.endOffset);
    } else {
      cut.setEnd(markRange.endContainer, markRange.endOffset);
    }

    // Fully covered → unwrap whole mark
    const fullyCovered =
      cut.compareBoundaryPoints(Range.START_TO_START, markRange) <= 0 &&
      cut.compareBoundaryPoints(Range.END_TO_END, markRange) >= 0;
    if (fullyCovered) {
      unwrapMark(m);
      continue;
    }

    // Partial: split the mark into up to 3 marks (before | erased | after),
    // then unwrap the erased middle one.
    const color = m.getAttribute("data-color") ?? "";
    const strike = m.hasAttribute("data-strike");
    const originalHtml = m.innerHTML;
    // Convert cut boundaries to text offsets inside the mark
    const startOffset = offsetWithin(m, cut.startContainer, cut.startOffset);
    const endOffset = offsetWithin(m, cut.endContainer, cut.endOffset);
    if (startOffset == null || endOffset == null || endOffset <= startOffset) continue;
    const text = m.textContent ?? "";

    // Rebuild: preserve inner HTML by walking. Simpler & good enough for our
    // content: since marks only ever wrap plain text runs (we wrap post-render
    // HTML but only across text nodes), textContent slicing is safe.
    const before = text.slice(0, startOffset);
    const after = text.slice(endOffset);
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(makeMark(before, color, strike));
    frag.appendChild(document.createTextNode(text.slice(startOffset, endOffset)));
    if (after) frag.appendChild(makeMark(after, color, strike));
    m.replaceWith(frag);
    // originalHtml unused but kept for future rich-content splitting
    void originalHtml;
  }
  mergeAdjacentMarks(root);
  root.normalize();
}

function makeMark(text: string, color: string, strike: boolean): HTMLElement {
  const m = document.createElement("mark");
  m.className = MARK_CLASS;
  if (color) m.setAttribute("data-color", color);
  if (strike) m.setAttribute("data-strike", "");
  m.appendChild(document.createTextNode(text));
  return m;
}

function offsetWithin(root: Node, container: Node, containerOffset: number): number | null {
  try {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(container, containerOffset);
    return r.toString().length;
  } catch {
    return null;
  }
}

/** Merge neighbouring marks with the same color+strike (created by successive wraps). */
function mergeAdjacentMarks(root: HTMLElement) {
  const marks = Array.from(root.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`));
  for (const m of marks) {
    let next = m.nextSibling;
    while (
      isMark(next) &&
      next.getAttribute("data-color") === m.getAttribute("data-color") &&
      next.hasAttribute("data-strike") === m.hasAttribute("data-strike")
    ) {
      while (next.firstChild) m.appendChild(next.firstChild);
      const toRemove = next;
      next = next.nextSibling;
      toRemove.parentNode?.removeChild(toRemove);
    }
  }
}

/** Apply a highlight to the given range. Replaces overlapping highlights (UWorld semantics). */
export function highlightRange(
  root: HTMLElement,
  range: Range,
  opts: { color: string; strike?: boolean },
) {
  if (range.collapsed) return;
  // Replace-on-overlap: erase any existing highlights inside the range first.
  eraseInRange(root, range.cloneRange());

  // Re-resolve text nodes AFTER erase (nodes may have been split/merged).
  // We resolve by text offsets within `root` to survive the mutation.
  const startOffset = offsetWithin(root, range.startContainer, range.startOffset);
  const endOffset = offsetWithin(root, range.endContainer, range.endOffset);
  if (startOffset == null || endOffset == null || endOffset <= startOffset) return;

  const rebuilt = rangeFromRootOffsets(root, startOffset, endOffset);
  if (!rebuilt) return;

  const textNodes = textNodesInRange(rebuilt);
  const from = startOffset;
  const to = endOffset;

  // Walk text nodes in reverse so splitting one doesn't shift the others.
  let cursor = 0;
  const slices: Array<{ node: Text; localStart: number; localEnd: number }> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE ? (isSkippable(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT),
  });
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.length;
    const next = cursor + len;
    if (next > from && cursor < to) {
      const localStart = Math.max(0, from - cursor);
      const localEnd = Math.min(len, to - cursor);
      if (localEnd > localStart && textNodes.includes(node)) {
        slices.push({ node, localStart, localEnd });
      }
    }
    cursor = next;
    node = walker.nextNode() as Text | null;
  }

  for (const s of slices.reverse()) {
    const middle = sliceTextNode(s.node, s.localStart, s.localEnd);
    const mark = document.createElement("mark");
    mark.className = MARK_CLASS;
    mark.setAttribute("data-color", opts.color);
    if (opts.strike) mark.setAttribute("data-strike", "");
    middle.parentNode?.insertBefore(mark, middle);
    mark.appendChild(middle);
  }

  mergeAdjacentMarks(root);
  root.normalize();
}

/** Rebuild a Range from character offsets within `root`. */
function rangeFromRootOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE ? (isSkippable(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT),
  });
  const range = document.createRange();
  let pos = 0;
  let didStart = false;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.length;
    const next = pos + len;
    if (!didStart && start >= pos && start <= next) {
      range.setStart(node, start - pos);
      didStart = true;
    }
    if (didStart && end >= pos && end <= next) {
      range.setEnd(node, end - pos);
      return range;
    }
    pos = next;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

/** Public: erase highlights intersecting the range (used by eraser tool). */
export function unwrapHighlightsInRange(root: HTMLElement, range: Range) {
  eraseInRange(root, range);
}
