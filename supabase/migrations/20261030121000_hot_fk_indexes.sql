-- The only public foreign key with no non-partial leading index on live
-- liba-os (checked 2026-10-29) is social_publish_queue.post_id.
-- A partial unique index covers pending/claimed rows only, so a post delete
-- still looks through completed queue rows.
--
-- These hot keys already have a leading index and are not added again:
-- agent_runs.agent_id, agent_logs.run_id, calls.rep_id,
-- finance_entries.employee_id / supplier_id,
-- facebook_ads_daily_stats.facebook_campaign_id (primary key),
-- google_ads_daily_stats.google_campaign_id (primary key),
-- social_posts.created_by / updated_by / approved_by.
-- Does not edit rows. Not applied from this repo.

CREATE INDEX IF NOT EXISTS social_publish_queue_post_id_idx
  ON public.social_publish_queue (post_id);
