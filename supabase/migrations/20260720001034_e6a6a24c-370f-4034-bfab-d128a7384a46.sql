CREATE TABLE public.qbank_resets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  qbank_id INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX qbank_resets_user_qbank_idx ON public.qbank_resets (user_id, qbank_id);
GRANT SELECT, INSERT ON public.qbank_resets TO authenticated;
GRANT ALL ON public.qbank_resets TO service_role;
ALTER TABLE public.qbank_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own resets read" ON public.qbank_resets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own resets insert" ON public.qbank_resets FOR INSERT WITH CHECK (auth.uid() = user_id);