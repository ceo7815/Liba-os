import assert from "node:assert/strict";
import test from "node:test";
import {
  isRetryableError,
  isRetryableHttpStatus,
  RetryableError,
  retryDelayMs,
  withRetry,
} from "./sync-retry";

test("retry delay backs off", () => {
  assert.equal(retryDelayMs(0, 300), 300);
  assert.equal(retryDelayMs(1, 300), 600);
  assert.equal(retryDelayMs(2, 300), 1200);
});

test("only timeout and server errors are retried", () => {
  assert.equal(isRetryableHttpStatus(429), true);
  assert.equal(isRetryableHttpStatus(503), true);
  assert.equal(isRetryableHttpStatus(400), false);
  assert.equal(isRetryableHttpStatus(401), false);
  assert.equal(isRetryableError(new RetryableError("Surense 503")), true);
  assert.equal(isRetryableError(new Error("fetch failed")), true);
  assert.equal(isRetryableError(new Error("Surense 404: missing")), false);
});

test("withRetry stops after a non-retryable error and repeats retryable ones", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(async () => {
        calls += 1;
        throw new Error("bad request");
      }, { sleep: async () => undefined }),
    /bad request/,
  );
  assert.equal(calls, 1);

  let attempts = 0;
  const value = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new RetryableError("timeout");
      return "ok";
    },
    { sleep: async () => undefined },
  );
  assert.equal(value, "ok");
  assert.equal(attempts, 3);
});
