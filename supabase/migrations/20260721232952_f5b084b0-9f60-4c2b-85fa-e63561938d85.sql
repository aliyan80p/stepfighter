INSERT INTO public.tests (user_id, mode, question_ids, current_index, right_count, wrong_count, done, name, qbank_id, subject_label, system_label)
SELECT id, 'tutor', ARRAY[1170]::bigint[], 0, 0, 0, false, 'Screenshot Test', 2, 'All Subjects', 'All Systems'
FROM auth.users WHERE email='agent1784676527@stepfighter.test'
RETURNING id;