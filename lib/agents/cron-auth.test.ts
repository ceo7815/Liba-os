import assert from "node:assert/strict";
import test from "node:test";
import { authorizeCronSecret, cronSecretFromRequest } from "./cron-auth";

test("reaper cron stays closed until a secret is configured", () => {
  assert.deepEqual(authorizeCronSecret("anything", ""), {
    ok: false,
    status: 503,
    error: "cron secret is not configured",
  });
  assert.deepEqual(authorizeCronSecret("anything", "   "), {
    ok: false,
    status: 503,
    error: "cron secret is not configured",
  });
});

test("reaper cron accepts only the configured secret", () => {
  assert.deepEqual(authorizeCronSecret(null, "clock-secret"), {
    ok: false,
    status: 401,
    error: "unauthorized",
  });
  assert.deepEqual(authorizeCronSecret("clock-secret-x", "clock-secret"), {
    ok: false,
    status: 401,
    error: "unauthorized",
  });
  assert.deepEqual(authorizeCronSecret("clock-secret", "clock-secret"), { ok: true });
  assert.deepEqual(authorizeCronSecret("  clock-secret  ", "clock-secret"), { ok: true });
});

test("cron secret is read from bearer or x-cron-secret", () => {
  assert.equal(
    cronSecretFromRequest(new Headers({ authorization: "Bearer clock-secret" })),
    "clock-secret",
  );
  assert.equal(
    cronSecretFromRequest(new Headers({ "x-cron-secret": "from-header" })),
    "from-header",
  );
  assert.equal(cronSecretFromRequest(new Headers()), null);
});
