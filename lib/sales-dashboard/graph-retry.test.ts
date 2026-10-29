import assert from "node:assert/strict";
import test from "node:test";
import { downloadSalesExcel, resetGraphAuthCache } from "./graph";

const ENV_KEYS = [
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "SALES_EXCEL_DRIVE_ID",
  "SALES_EXCEL_ITEM_ID",
] as const;

function useGraphEnv() {
  const previous = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) previous.set(key, process.env[key]);
  process.env.AZURE_TENANT_ID = "tenant";
  process.env.AZURE_CLIENT_ID = "client";
  process.env.AZURE_CLIENT_SECRET = "super-secret-value";
  process.env.SALES_EXCEL_DRIVE_ID = "drive";
  process.env.SALES_EXCEL_ITEM_ID = "item";
  return () => {
    for (const [key, value] of previous) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function tokenOk() {
  return Response.json({ access_token: "token-1", expires_in: 3600 });
}

test("OneDrive download retries a timeout and a 503, and does not retry a 400", async () => {
  const restoreEnv = useGraphEnv();
  const originalFetch = globalThis.fetch;
  try {
    resetGraphAuthCache();
    const calls: string[] = [];
    let contentAttempts = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("oauth2")) return tokenOk();
      contentAttempts += 1;
      if (contentAttempts === 1) {
        const timeout = new Error("The operation was aborted due to timeout");
        timeout.name = "TimeoutError";
        throw timeout;
      }
      if (contentAttempts === 2) return new Response("unavailable", { status: 503 });
      return new Response(new Uint8Array([9, 8, 7]), { status: 200 });
    };

    const file = await downloadSalesExcel({
      fileName: "sales.xlsx",
      etag: null,
      lastModified: null,
    });
    assert.equal(file.buffer.byteLength, 3);
    assert.equal(contentAttempts, 3);
    assert.equal(calls.filter((url) => url.includes("oauth2")).length, 1);

    resetGraphAuthCache();
    contentAttempts = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2")) return tokenOk();
      return new Response("client_secret=super-secret-value", { status: 400 });
    };
    await assert.rejects(
      () =>
        downloadSalesExcel({
          fileName: "sales.xlsx",
          etag: null,
          lastModified: null,
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /400/);
        assert.equal(err.message.includes("super-secret-value"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    resetGraphAuthCache();
    restoreEnv();
  }
});
