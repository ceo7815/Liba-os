-- Resume cursor for Surense lead-control paging. One sync may stop on a time budget;
-- the next system sync continues from paging.cursors instead of the first page.

ALTER TABLE public.lead_control_snapshots
  ADD COLUMN IF NOT EXISTS paging jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.lead_control_snapshots.paging IS
  'In-progress Surense search cursors (start row per query) so a cut sync can continue.';
