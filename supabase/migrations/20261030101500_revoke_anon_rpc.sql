-- Defense in depth for four SECURITY DEFINER RPCs.
-- Checked in production on 2026-10-29: anon and authenticated already have
-- has_function_privilege = false on all four, so the hole is not open there.
-- Supabase default privileges can GRANT EXECUTE again on a later CREATE, and
-- REVOKE FROM PUBLIC does not remove an explicit anon grant. Re-applying this
-- file keeps the grants closed.
--
-- The Next.js app calls these with the service-role client.
-- admin_list_profiles_with_permissions already falls back to a table read if
-- the RPC refuses. Idempotent. Does not edit rows. Not applied from this repo.

REVOKE ALL ON FUNCTION public.claim_pending_calls(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_calls(integer) TO service_role;

REVOKE ALL ON FUNCTION public.claim_queued_agent_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_agent_run(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_social_publish_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_publish_queue() TO service_role;

REVOKE ALL ON FUNCTION public.admin_list_profiles_with_permissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles_with_permissions() TO service_role;
