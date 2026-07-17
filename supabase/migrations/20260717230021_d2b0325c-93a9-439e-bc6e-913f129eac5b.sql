
-- Reference/lookup tables (public read)
CREATE TABLE public.subjects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects are readable by everyone" ON public.subjects FOR SELECT USING (true);

CREATE TABLE public.systems (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);
GRANT SELECT ON public.systems TO anon, authenticated;
GRANT ALL ON public.systems TO service_role;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Systems are readable by everyone" ON public.systems FOR SELECT USING (true);

-- Questions (auth required)
CREATE TABLE public.questions (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER REFERENCES public.subjects(id),
  system_id INTEGER REFERENCES public.systems(id),
  title TEXT,
  question TEXT NOT NULL,
  explanation TEXT,
  correct_answer INTEGER,
  ppl_taken NUMERIC,
  corr_taken NUMERIC,
  question_type INTEGER,
  question_format_type INTEGER,
  media_name TEXT,
  other_medias TEXT
);
CREATE INDEX questions_subject_idx ON public.questions(subject_id);
CREATE INDEX questions_system_idx ON public.questions(system_id);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read questions" ON public.questions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.answers (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_index INTEGER NOT NULL,
  answer_text TEXT NOT NULL,
  correct_percentage INTEGER DEFAULT 0
);
CREATE INDEX answers_question_idx ON public.answers(question_id);
GRANT SELECT ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read answers" ON public.answers FOR SELECT TO authenticated USING (true);

CREATE TABLE public.refs (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  ref_title TEXT,
  ref_link TEXT,
  ref_type INTEGER
);
CREATE INDEX refs_question_idx ON public.refs(question_id);
GRANT SELECT ON public.refs TO authenticated;
GRANT ALL ON public.refs TO service_role;
ALTER TABLE public.refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read refs" ON public.refs FOR SELECT TO authenticated USING (true);

-- User progress
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles are updatable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Per-user attempts
CREATE TABLE public.attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer INTEGER,
  is_correct BOOLEAN,
  time_seconds INTEGER,
  test_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attempts_user_idx ON public.attempts(user_id);
CREATE INDEX attempts_user_q_idx ON public.attempts(user_id, question_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attempts" ON public.attempts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bookmarks/flags
CREATE TABLE public.bookmarks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Test sessions
CREATE TABLE public.tests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'practice',
  question_ids INTEGER[] NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  right_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  subject_label TEXT,
  system_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tests_user_idx ON public.tests(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tests" ON public.tests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
