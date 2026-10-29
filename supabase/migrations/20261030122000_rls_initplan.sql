-- Stop auth.uid() from being re-evaluated per row. Same predicate, once per
-- query. Live liba-os (2026-10-29) still has the bare call on these two
-- policies only; the other policies already use (SELECT auth.uid()).
-- website_leads was created outside this repo, so skip it if the table is
-- missing. Does not edit rows. Not applied from this repo.

DROP POLICY IF EXISTS "Users read own permissions" ON public.profile_permissions;
CREATE POLICY "Users read own permissions"
  ON public.profile_permissions
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DO $$
BEGIN
  IF to_regclass('public.website_leads') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS website_leads_staff_select ON public.website_leads';
  EXECUTE $policy$
    CREATE POLICY website_leads_staff_select
      ON public.website_leads
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.is_active = true
        )
      )
  $policy$;
END $$;
