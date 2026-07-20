CREATE TABLE public.question_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id bigint NOT NULL,
  qbank_id bigint,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_notes TO authenticated;
GRANT ALL ON public.question_notes TO service_role;

ALTER TABLE public.question_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own question notes"
  ON public.question_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_question_notes_updated_at
  BEFORE UPDATE ON public.question_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();