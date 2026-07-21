# Apply USMLE Fighter findings to QBank

Ship everything captured from the USMLE Fighter audit, minus their logo and the AI Prompt quiz mode.

## 1. Exhibit Display modal (media handling)
- New `ExhibitModal` component: centered dialog, navy header "Exhibit Display", ✕ close + ⛶ maximize controls.
- New `MediaLinkParser` util: scan stem + explanation HTML for `.mp4`/`.webm`/`.mp3`/`.wav` anchors, decorate with inline ▶ glyph, intercept click to open modal.
- Modal renders native `<video controls>` / `<audio controls>` (no autoplay). Reusable for image exhibits (click-to-enlarge).

## 2. Loader upgrade
- Replace static "Loading…" text with `<Loader/>`: spinning arc SVG (navy stroke, ~48 px, 1.2 s spin) + muted "Loading…" label.
- Wire into test page, dashboard routes, Notes, Performance, etc.

## 3. Test-view chrome tokens (Verdana + Fighter sizing)
- Top bar: 72 px, `#1a4b7c`.
- Bottom bar: 56 px, `#1a4b7c` — icon 24 px + label 11 px pattern.
- Sidebar: 96 px, `#f2f4f8` bg, blue active pill.
- Font stack: `Verdana, Arial, Georgia, serif`. Stem 14 px, options 16 px.
- Behind a settings toggle so users can revert to your current theme.

## 4. Score Calculator (19 formulas)
- Consume `src/data/usmlefighter-score-formulas.json`.
- Dropdown: Step 1 NBME 25–31 + UWSA 1–3; Step 2 CK NBME 9–14 + UWSA 1–3.
- Inputs: number wrong. Output: predicted 3-digit score + "each question worth X points" card + scatter/regression chart (Recharts) with equation label.

## 5. Test Analysis tab
- New tab on post-test screen beside Results.
- Cards: "Your Score" donut (Correct/Incorrect/Omitted) + "Answer Changes" donut (C→C, C→I, I→C, I→I) — reuse existing answer-change tracking.
- Sortable Subjects / Systems / Topics tables with expandable rows.

## 6. Bottom-bar mode toggles (mid-test flippable)
- Timed / Tutor / Exam as 3 independent switches in the bottom bar, changeable during a block (not just at start).

## 7. Previous Tests polish
- KPI header: Saved / Completed / Suspended counts.
- Row actions: Resume · Results · Test Analysis · duplicate · delete.
- Filters: status dropdown + search + rows-per-page.

## 8. Lab Values panel refresh
- Parse `src/data/usmle-lab-values.raw.json` into structured `{tab, analyte, conventional, si}`.
- Right-side sliding panel, 4 tabs (Blood / Serum / CSF / Urine & BMI), SI toggle adds a third column.

## 9. Excluded (per your request)
- USMLE Fighter logo / brand marks — keep your own.
- AI Prompt quiz mode — not implemented.

## Technical notes
- All new colors added as semantic tokens in `src/styles.css` (`--fighter-navy`, `--fighter-footer`, etc.) — no hardcoded hex in components.
- Recharts already installed for the score chart.
- Exhibit modal uses existing shadcn `Dialog`.
- No schema changes needed; Answer Changes reads from existing `test_attempts` history.

## Build order
1. Loader + chrome tokens (fast, high visual impact)
2. Exhibit Display modal + media link parser
3. Score Calculator with 19 formulas + chart
4. Test Analysis tab
5. Bottom-bar mode toggles
6. Previous Tests polish
7. Lab Values panel refresh
