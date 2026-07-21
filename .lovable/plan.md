# Rebuild Highlight Feature — Cross-Device Engine

## Goal
Replace the current Rangy + custom-touch-drag hybrid with a single, modern highlight engine that behaves identically on desktop, iPad, iPhone, and Android — matching the polish of UWorld / AMBOSS / Kaplan.

## Problems with the current implementation
- Rangy is unmaintained (last release 2018) and does character-offset serialization that drifts when media/DOM reflows.
- Two parallel selection systems: browser-native (desktop) + a hand-rolled long-press touch simulator. They fight each other, especially on iOS after the native handles appear.
- Toolbar (highlight / strike / erase) positioning is fragile on mobile — often opens off-screen or under the iOS callout.
- Erase is class-based unwrap only; overlapping highlights of different colors leave orphan fragments.
- No visible drag handles on touch — users can't extend after initial pick like they can on UWorld.
- Highlights inside images / videos / tables aren't fully supported.

## New architecture

### 1. Serialization: DOM path + text-offset (drop Rangy)
Store each highlight as `{ startPath, startOffset, endPath, endOffset, color, strike }` where path is a compact node-index array from the highlight root. Survives innerHTML round-trip, media loading, and re-renders. Written to the same `highlight_html` column so existing saves upgrade lazily.

### 2. Selection capture: native only, one code path
- Desktop / Android Chrome / Android Firefox: browser `selectionchange` + `pointerup`.
- iOS Safari / iPadOS: same events; we no longer fight the native callout — we **hide** it via `-webkit-touch-callout:none` on the question surface and render our own inline toolbar.
- Remove the entire custom long-press touch-drag simulator (~250 lines).

### 3. Wrapping: bespoke range walker
Small (~150 line) walker that splits text nodes at range boundaries and wraps runs in `<mark data-hl-id data-color>`. Handles:
- Partial-node start/end
- Cross-element ranges (spanning `<p>`, list items, table cells)
- Nested/overlapping highlights via layered `data-color` chips (like AMBOSS)
- Skip zones: `<img>`, `<video>`, `<audio>`, `.qbank-inline-media-wrap`, code blocks

### 4. Toolbar UX (matches UWorld + fighter)
- Floating pill above the selection: 4 color swatches, strikethrough, eraser.
- Positioned via `getBoundingClientRect()` of the selection, clamped to viewport with 8px safe-area padding.
- Auto-dismiss on outside tap / scroll / new selection.
- On touch: appears above native handles, not below.

### 5. Extend after highlight (like UWorld)
Tap an existing highlight → shows two drag handles at its endpoints on touch, or a resize cursor on desktop. Drag handle → live-updates range → recommits on release.

### 6. Erase precision
Eraser wraps the current selection with a "cut" pass that:
- Splits any overlapping `mark` at range boundaries
- Removes only the intersecting portion (not the whole mark)
- Merges adjacent marks of the same color/strike after removal

### 7. Storage & migration
- New format: `{v: 2, ranges: [...]}` in `highlight_html`.
- On load, if column contains raw HTML with `<mark class="qbank-hl-...">` (old format), a one-time parser extracts and converts to v2, then re-saves on next edit.
- No DB migration needed — column already exists.

### 8. Files touched
- **Rewrite:** `src/lib/rangy-highlighter.ts` → `src/lib/highlighter.ts` (new engine, no Rangy).
- **Rewrite:** highlight sections of `src/routes/_authenticated/test.$id.tsx` (~400 lines removed, ~150 added).
- **New:** `src/components/highlight-toolbar.tsx` (portal-rendered floating toolbar).
- **New:** `src/lib/highlight-serialize.ts` (path/offset encode + decode + v1→v2 migration).
- **CSS:** update `src/styles.css` — remove `.qbank-hl-*` runtime injection, add static `mark[data-hl-color]` rules + touch-callout suppression.
- **Remove:** `rangy` from package.json (~120 KB gzipped saved).

## Research inputs
Before coding, I'll analyze the highlight DOM/UX of:
- **UWorld** (via IMD sandbox login you offer) — drag handles, toolbar timing, color palette
- **AMBOSS free-tier** article view — overlapping highlight rendering, mobile toolbar
- **USMLE Fighter** (sandbox login you offer) — mobile toolbar placement
- Public write-ups on Medium/GitHub for `document.caretRangeFromPoint`, `caretPositionFromPoint`, iOS selection quirks

## Verification plan
Playwright script hits `/test/:id` on 4 emulated viewports (desktop 1440, iPad 1024, iPhone 390, Android 360), performs: select-word, select-cross-paragraph, extend, overlap-with-different-color, erase-partial. Screenshots at each step; fail if toolbar off-screen or mark count wrong.

## Out of scope for this PR
- Server-side highlight rendering (SSR)
- Sharing / exporting highlights
- Color palette customization UI (uses current 4 colors)

---

## Open questions before I start

1. **Toolbar style** — pill above selection like UWorld, or bottom-sheet on mobile like AMBOSS?
2. **Overlapping highlights** — allow (AMBOSS-style layered) or replace-on-overlap (UWorld-style)?
3. **UWorld/Fighter access** — please confirm you want me to log into the sandbox with your credentials to inspect their DOM, and paste them in the next message (I'll use once, never store).
