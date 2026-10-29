import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20261030101500_revoke_anon_rpc.sql",
  "utf8",
);

const SERVICE_ONLY = [
  "public.claim_pending_calls(integer)",
  "public.claim_queued_agent_run(uuid)",
  "public.claim_social_publish_queue()",
  "public.admin_list_profiles_with_permissions()",
] as const;

test("anon and authenticated cannot execute the security-definer RPCs", () => {
  for (const fn of SERVICE_ONLY) {
    const escaped = fn.replace(/[()]/g, "\\$&");
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION ${escaped} FROM PUBLIC, anon, authenticated;`,
      ),
      fn,
    );
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO service_role;`));
  }
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION [\s\S]* TO (anon|authenticated|PUBLIC)/i);
  assert.doesNotMatch(sql, /INSERT INTO|UPDATE |DELETE FROM/i);
});
