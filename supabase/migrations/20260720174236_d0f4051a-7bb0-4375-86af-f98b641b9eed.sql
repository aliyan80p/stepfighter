
-- Delete stale qbank_media rows where a "prefixed" sibling (highresdefault_, hqdefault_, etc.)
-- exists in the same qbank. The stripped/lowercase copies were created during earlier
-- resolution attempts and point to non-existent files in storage.
DELETE FROM public.qbank_media m
WHERE EXISTS (
  SELECT 1 FROM public.qbank_media s
  WHERE s.qbank_id = m.qbank_id
    AND s.name <> m.name
    AND lower(s.name) ~ ('^(highresdefault_|hqdefault_|sddefault_|mqdefault_|default_)' || lower(m.name) || '$')
);
