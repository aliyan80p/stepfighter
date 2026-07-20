## Improvements Required (AI Study Plan)

New page at `/performance/improvements` (also linked from sidebar and reachable in place of / alongside the current AI Test Analysis). Course selector in the top-right (Step 1/2/3) drives all data.

### Sections (top → bottom, matching screenshots)

1. **Header + "How does this page work?" accordion** — collapsible explainer card with 6 tiles: Your Score, Weak Areas, Performance Over Time, Performance Trend, Performance Prediction, Study Plan.
2. **Your Score donut** — overall correct % across all answered questions in the active course (used answers, latest per question).
3. **Weak Areas** — up to 3 cards. Rule: subjects with accuracy < 40% first; if none, take the 3 lowest-scoring subjects (capped at 90%). Each card shows subject, its weakest system, and the subject accuracy %.
4. **Performance Over Time** — line chart of accuracy % per completed test, chronological.
5. **Performance Trend** — compares average accuracy of most-recent half of tests vs earlier half; renders "+X.X points" (or "-X.X"). Needs ≥ 4 completed tests, otherwise a "not enough data" state.
6. **Performance Prediction** — one AI-generated sentence: current overall %, total questions in the study plan, predicted overall if user scores ≥70% on the plan quizzes. Uses Lovable AI (`google/gemini-3.5-flash`) via server function; falls back to a deterministic formula if the AI call fails.
7. **Study Plan** — 5 quizzes of 40 questions each, built from the user's previously-incorrect questions in the weakest subjects. Quiz #1 unlocked initially; each subsequent quiz unlocks after the previous is completed. "Start Quiz" launches a test in existing test flow (reuses `startTest` server fn with a fixed question-id list).

### Statistics by Category modal

Opened via "Statistics by Category" button. Tabs: **Subjects / Systems / Topics**. Rows sorted strongest → weakest with a colored badge (green ↑ / red ↓). Threshold for red arrow: <50%. Info banner: "Your category statistics are sorted from strongest to weakest." Scrollable list.

### Backend

New server functions in `src/lib/performance.functions.ts`:
- `getImprovementsOverview({ qbankId })` → `{ overallPct, totalAnswered, weakAreas: [{subject, weakestSystem, pct}], perfOverTime: [{testId, name, pct, date}], trendDelta }`.
- `getCategoryStats({ qbankId, kind: 'subject'|'system'|'topic' })` → `[{name, pct, count}]` sorted strongest→weakest.
- `getStudyPlan({ qbankId })` → `{ quizzes: [{index, questionIds, subjectsLabel, unlocked, completedTestId}], totalQuestions }`. Deterministically picks weak-subject wrong-answered questions, chunks of 40, up to 5 quizzes. Unlock state derived from existing tests that used exactly those question ids (stored via `tests.metadata` marker `study_plan_index`).
- `generatePerformancePrediction({ qbankId })` → `{ text }` via Lovable AI Gateway.

Reuses existing tables — no schema changes required (quizzes are ephemeral question-id lists persisted only when the user starts them; the `tests` row is tagged with `study_plan_index` in an existing metadata/notes column, or a new nullable column `study_plan_index INTEGER` added via migration if none exists).

### Files

- `src/routes/_authenticated/performance.improvements.tsx` (new page)
- `src/components/performance/statistics-by-category-modal.tsx` (new)
- `src/components/performance/weak-area-card.tsx`, `study-plan-list.tsx` (new)
- `src/lib/performance.functions.ts` (extend)
- `src/components/app-sidebar.tsx` (add "Improvements Required" link under Performance)
- migration: add `study_plan_index INTEGER` to `tests` if not present, and grants unchanged.

### Non-goals

- Not touching existing Overall / Graphs / Peer Ranking / Charts / AI Test Analysis pages.
- No changes to test-taking UI; Study Plan quizzes use the existing runner.
