import assert from "node:assert/strict";
import test from "node:test";
import { facebookSettingsSyncStamp } from "./sync-stamp";

test("a partial Facebook sync records last_error and does not move last_synced_at", () => {
  const partial = facebookSettingsSyncStamp("2026-10-29T10:00:00.000Z", "חשבון א: timeout");
  assert.deepEqual(partial, { last_error: "חשבון א: timeout" });
  assert.equal("last_synced_at" in partial, false);

  const ok = facebookSettingsSyncStamp("2026-10-29T10:00:00.000Z", "  ");
  assert.deepEqual(ok, {
    last_synced_at: "2026-10-29T10:00:00.000Z",
    last_error: null,
  });
});
