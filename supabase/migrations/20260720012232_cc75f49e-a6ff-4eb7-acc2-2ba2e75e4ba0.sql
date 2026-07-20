ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS front_image text,
  ADD COLUMN IF NOT EXISTS back_image text;