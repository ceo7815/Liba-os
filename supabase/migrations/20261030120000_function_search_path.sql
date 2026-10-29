-- Pin search_path on the nine public functions the 29.10 audit called mutable.
-- Live liba-os (2026-10-29) already has search_path = public, pg_temp on each
-- of them. This restates that setting so a rebuild from the older CREATE
-- FUNCTION statements (which omit it) cannot drift, and so re-running is a no-op.
-- keep_one_voicenter_push_run exists in production and not in this repo; skip
-- it when the function is absent. Does not edit rows. Not applied from this repo.

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.finance_entries_require_salary_assignment()',
    'public.finance_entries_set_updated_at()',
    'public.finance_fixed_costs_set_updated_at()',
    'public.keep_one_voicenter_push_run()',
    'public.social_posts_guard_approved()',
    'public.social_posts_set_updated_at()',
    'public.social_settings_set_updated_at()',
    'public.touch_calls_updated_at()',
    'public.vault_entries_set_search_text()'
  ]
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
    END IF;
  END LOOP;
END $$;
