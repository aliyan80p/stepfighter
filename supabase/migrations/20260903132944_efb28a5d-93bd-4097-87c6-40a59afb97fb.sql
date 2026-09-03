DROP POLICY IF EXISTS "Entitled users can read library toc" ON public.library_toc;
DROP POLICY IF EXISTS "Entitled users can read library docs" ON public.library_docs;

CREATE POLICY "Entitled users can read library toc"
ON public.library_toc
FOR SELECT
TO authenticated
USING (
  array_length(public.effective_qbank_access(auth.uid()), 1) > 0
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Entitled users can read library docs"
ON public.library_docs
FOR SELECT
TO authenticated
USING (
  array_length(public.effective_qbank_access(auth.uid()), 1) > 0
  OR public.has_role(auth.uid(), 'admin')
);