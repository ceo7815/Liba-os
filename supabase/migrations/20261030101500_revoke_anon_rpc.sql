-- Close anon (and authenticated, where the app does not call them) on
-- SECURITY DEFINER RPCs. Supabase default privileges GRANT EXECUTE to anon
-- and authenticated on CREATE. REVOKE FROM PUBLIC does not remove those
-- explicit grants, so /rest/v1/rpc stayed open.
--
-- The Next.js app calls the claim functions only with the service-role client.
-- admin_list_profiles_with_permissions is also called with that client and
-- already falls back to a table read if the RPC refuses.
-- Idempotent. Does not edit rows. Not applied from this repo.

REVOKE ALL ON FUNCTION public.claim_pending_calls(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_calls(integer) TO service_role;

REVOKE ALL ON FUNCTION public.claim_queued_agent_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_agent_run(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_social_publish_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_publish_queue() TO service_role;

REVOKE ALL ON FUNCTION public.admin_list_profiles_with_permissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles_with_permissions() TO service_role;
