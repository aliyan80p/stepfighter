## Goal
Transform the Flashcards area into a full deck-based study system matching the uploaded screenshots (Browse Decks, Study Mode, Create Deck, rich Create Flashcard editor, deck stats & settings).

## Scope
Rebuild `/flashcards/my-decks` as the main Flashcards hub. The existing per-question `FlashcardsModal` (tutor/exam quick-add) stays but writes into a deck.

## Features to build

### 1. Decks
- New table `flashcard_decks` (id, user_id, name, color, created_at).
- CRUD server fns: `listDecks`, `createDeck`, `updateDeck`, `deleteDeck`.
- Extend `flashcards` table: add `deck_id` (nullable FK), `tags text[]`, plus SRS fields (`state`: new/learning/review, `due_at`, `interval_days`, `ease`, `reps`, `lapses`, `last_reviewed_at`, `time_spent_ms`).
- Migrate existing cards into a per-user auto-created "Default" deck.

### 2. Browse Decks tab
- Search bar + Create Deck + New Card buttons.
- Each deck card: colored circle avatar (initial), name, card count, New/Learning/Review pill counts, "See All" + 3-dot menu (Edit / Delete).
- Horizontally scrollable strip of card previews per deck; click preview → open card editor.

### 3. Study Mode tab
- Table: Choose Deck | New Cards | Learning | To Review | Last Used | Action (gear).
- Search decks, "View Stats" link (opens Statistics panel: Today / Forecast / Review Count / Time Spent).
- Gear → Settings modal with tabs (New Cards: max/day + order; Reviews: max/day; General). Persist in `deck_settings` table or JSON column on deck.
- Clicking a deck row starts a study session (simple SM-2-lite: show front → flip → Again/Hard/Good/Easy → schedule).

### 4. Create Deck modal
- Name + color swatch picker (blue/red/orange/yellow/purple/violet/gray/brown/pink/teal).

### 5. Create Flashcard modal (rich)
- Deck selector chip (top-left with color dot).
- Front / Back panels with a lightweight rich-text toolbar (Paragraph/H1/H2, font size +/-, B/I/U/S, color, highlight, bullet/number/align, link, image, media, code, table, undo/redo). Store as HTML.
- Character counter (x / 3000).
- Tag input (comma-separated).
- Maximize toggle, Cancel / Save.
- Reuse for edit; per-card 3-dot Edit/Delete menu on tiles.

### 6. Integration
- Keep the existing quick-add modal from tutor/exam/search, but let it target a deck (default: auto "Quick Adds" deck for that qbank).
- Update `notes.index.tsx` etc. unaffected.

## Technical notes
- Rich text: `@tiptap/react` + starter kit + underline/link/image/color/highlight/text-align/table extensions. `bun add` all.
- SRS: simple SM-2 in `src/lib/srs.ts`.
- All server fns use `requireSupabaseAuth`; migration adds tables with GRANTs + RLS (user_id = auth.uid()).
- Files:
  - migration: decks, deck_settings, extend flashcards.
  - `src/lib/decks.functions.ts`, `src/lib/flashcards.functions.ts` (extend), `src/lib/srs.ts`.
  - `src/routes/_authenticated/flashcards.my-decks.tsx` (main hub with tabs).
  - `src/components/flashcards/DeckCard.tsx`, `CreateDeckModal.tsx`, `CardEditorModal.tsx` (tiptap), `StudySession.tsx`, `DeckSettingsModal.tsx`, `StatsPanel.tsx`.

## Out of scope (ask if wanted)
- Media/video embeds beyond image (toolbar buttons will be present but only image works initially).
- Import/export decks (Anki .apkg).
- Cross-device sync of study timer beyond DB writes.

Confirm and I'll build it, or tell me what to trim (e.g. skip SRS, skip rich text, single tab only).
