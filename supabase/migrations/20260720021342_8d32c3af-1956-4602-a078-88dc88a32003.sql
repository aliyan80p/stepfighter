
-- DECKS
CREATE TABLE public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  new_cards_per_day int NOT NULL DEFAULT 20,
  reviews_per_day int NOT NULL DEFAULT 200,
  new_card_order text NOT NULL DEFAULT 'added',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decks" ON public.flashcard_decks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_decks_updated BEFORE UPDATE ON public.flashcard_decks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EXTEND FLASHCARDS
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.flashcard_decks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS interval_days real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ease real NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS reps int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_spent_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS front_html text,
  ADD COLUMN IF NOT EXISTS back_html text;

CREATE INDEX IF NOT EXISTS flashcards_deck_idx ON public.flashcards(deck_id);
CREATE INDEX IF NOT EXISTS flashcards_user_due_idx ON public.flashcards(user_id, due_at);

-- REVIEWS LOG
CREATE TABLE public.flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  deck_id uuid REFERENCES public.flashcard_decks(id) ON DELETE SET NULL,
  rating text NOT NULL,
  time_ms int NOT NULL DEFAULT 0,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_reviews TO authenticated;
GRANT ALL ON public.flashcard_reviews TO service_role;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reviews" ON public.flashcard_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS reviews_user_time_idx ON public.flashcard_reviews(user_id, reviewed_at DESC);
