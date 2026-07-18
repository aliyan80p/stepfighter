
ALTER TABLE public.answers DROP CONSTRAINT answers_pkey;
ALTER TABLE public.answers ADD PRIMARY KEY (qbank_id, id);
ALTER TABLE public.refs DROP CONSTRAINT refs_pkey;
ALTER TABLE public.refs ADD PRIMARY KEY (qbank_id, id);
