-- The 16 public tables that have RLS and no policy (live liba-os, 2026-10-29).
-- With RLS on and no policy, anon and authenticated already see nothing, and
-- they have no table grants. These policies make that deny explicit.
-- USING (false) is permissive, so a later allow policy is not blocked.
-- The service role bypasses RLS. The app reads these tables that way.
-- Does not edit rows. Not applied from this repo.

DO $$
DECLARE
  t text;
  policy_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academy_answers',
    'academy_assignments',
    'academy_attempts',
    'academy_blocks',
    'academy_courses',
    'academy_enrollments',
    'academy_exam_questions',
    'academy_exams',
    'academy_lesson_progress',
    'academy_lessons',
    'academy_question_options',
    'academy_questions',
    'academy_tracks',
    'agent_api_keys',
    'voicenter_cdr_receipts',
    'voicenter_cdr_webhook'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    policy_name := t || '_deny_client';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      policy_name,
      t
    );
    EXECUTE format(
      'COMMENT ON POLICY %I ON public.%I IS %L',
      policy_name,
      t,
      'No client access. Service role bypasses RLS. Matches the previous no-policy deny.'
    );
  END LOOP;
END $$;
