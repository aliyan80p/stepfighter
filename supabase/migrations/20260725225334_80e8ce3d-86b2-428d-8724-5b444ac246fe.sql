
-- 1) Enforce deck ownership on flashcards inserts/updates
DROP POLICY IF EXISTS "Users manage own flashcards" ON public.flashcards;
CREATE POLICY "Users manage own flashcards"
  ON public.flashcards FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      deck_id IS NULL
      OR EXISTS (SELECT 1 FROM public.flashcard_decks d WHERE d.id = deck_id AND d.user_id = auth.uid())
    )
  );

-- 2) Enforce deck ownership on flashcard_reviews
DROP POLICY IF EXISTS "own reviews" ON public.flashcard_reviews;
CREATE POLICY "own reviews"
  ON public.flashcard_reviews FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      deck_id IS NULL
      OR EXISTS (SELECT 1 FROM public.flashcard_decks d WHERE d.id = deck_id AND d.user_id = auth.uid())
    )
  );

-- 3) Lock down SECURITY DEFINER helpers not meant for direct client use
REVOKE EXECUTE ON FUNCTION public.effective_qbank_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
