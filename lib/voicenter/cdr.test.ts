import assert from "node:assert/strict";
import test from "node:test";
import { callStage, parseCdr, SOFIA_EXTENSION, SOFIA_USER_ID } from "./cdr";
import {
  buildReceiptMeta,
  latestReceiptByOutcome,
  postOutcome,
  tokenHashPrefix,
  voicenterAckBody,
  type CdrPostOutcome,
} from "./receipt";
import { handleVoicenterPost, type CdrReceiptInsert, type CdrReceiptPatch } from "./webhook";

const TOKEN = "super-secret-webhook-token";

test("Voicenter field aliases identify Sofia", () => {
  const parsed = parseCdr({
    CallID: "vc-1",
    Targetextension: SOFIA_EXTENSION,
    RepresentativeName: "סופיה לוי",
    RepresentativeCode: SOFIA_USER_ID,
  });
  assert.ok(parsed);
  assert.equal(parsed.sofia, true);
  assert.equal(parsed.representativeName, "סופיה לוי");
  assert.equal(parsed.callId, "vc-1");

  const byCode = parseCdr({
    ivruniqueid: "vc-2",
    Targetextension: "other-desk",
    RepresentativeCode: SOFIA_USER_ID,
  });
  assert.equal(byCode?.sofia, true);

  const other = parseCdr({
    CallID: "vc-3",
    Targetextension: "not-sofia",
    RepresentativeName: "דנה",
    RepresentativeCode: "999",
  });
  assert.equal(other?.sofia, false);
  assert.equal(other?.representativeName, "דנה");
});

test("receipt meta stores a hash prefix, content-type, and size — not the token", () => {
  const meta = buildReceiptMeta({
    token: TOKEN,
    contentType: "application/json; charset=utf-8",
    bodyText: "{\"CallID\":\"1\"}",
  });
  const encoded = JSON.stringify(meta);
  assert.equal(encoded.includes(TOKEN), false);
  assert.equal(meta.token_hash_prefix, tokenHashPrefix(TOKEN));
  assert.match(meta.token_hash_prefix, /^[a-f0-9]{8}$/);
  assert.notEqual(meta.token_hash_prefix, TOKEN.slice(0, 8));
  assert.equal(meta.content_type, "application/json");
  assert.equal(meta.body_bytes, Buffer.byteLength("{\"CallID\":\"1\"}", "utf8"));
});

test("post outcome and Voicenter success body", () => {
  assert.equal(postOutcome({ stored: 0, recognized: 0 }), "bad_json");
  assert.equal(postOutcome({ stored: 0, recognized: 2 }), "other_extension");
  assert.equal(postOutcome({ stored: 1, recognized: 2 }), "stored");
  assert.deepEqual(voicenterAckBody(), { Err: 0, Errdesc: "OK", status: "OK" });
});

test("latest receipt by outcome keeps the newest row of each kind", () => {
  const latest = latestReceiptByOutcome([
    { outcome: "stored", received_at: "2026-10-01T00:00:00.000Z" },
    { outcome: "stored", received_at: "2026-10-28T00:00:00.000Z" },
    { outcome: "unauthorized", received_at: "2026-10-27T00:00:00.000Z" },
    { outcome: "ignored", received_at: "2026-10-29T00:00:00.000Z" },
  ]);
  assert.equal(latest.stored, "2026-10-28T00:00:00.000Z");
  assert.equal(latest.unauthorized, "2026-10-27T00:00:00.000Z");
  assert.equal(latest.bad_json, null);
  assert.equal(latest.other_extension, null);
});

function harness(bodyText: string, authorize: () => Promise<boolean>) {
  const order: string[] = [];
  let inserted: CdrReceiptInsert | null = null;
  let patched: CdrReceiptPatch | null = null;
  const run = (ingestStored: boolean) =>
    handleVoicenterPost({
      token: TOKEN,
      contentType: "application/json",
      bodyText,
      authorize: async (token) => {
        order.push("auth");
        assert.equal(token, TOKEN);
        return authorize();
      },
      insertReceipt: async (row) => {
        order.push("insert");
        inserted = row;
        assert.equal(JSON.stringify(row).includes(TOKEN), false);
        return "receipt-1";
      },
      updateReceipt: async (_id, patch) => {
        order.push("update");
        patched = patch;
      },
      ingest: async (cdr) => {
        order.push("ingest");
        const parsed = parseCdr(cdr);
        return {
          callId: parsed?.callId ?? "missing",
          stored: ingestStored && Boolean(parsed?.sofia),
          transcript: false,
        };
      },
    });
  return {
    order,
    run,
    inserted: () => inserted,
    patched: () => patched,
  };
}

test("unauthorized POST is recorded before auth", async () => {
  const h = harness("{}", async () => false);
  const result = await h.run(false);
  assert.deepEqual(h.order, ["insert", "auth"]);
  assert.equal(result.status, 401);
  assert.equal(h.inserted()?.outcome, "unauthorized");
  assert.equal(h.inserted()?.token_hash_prefix, tokenHashPrefix(TOKEN));
  assert.equal(h.patched(), null);
});

test("bad JSON is recorded after the early receipt", async () => {
  const h = harness("not-json", async () => true);
  const result = await h.run(false);
  assert.equal(h.order[0], "insert");
  assert.ok(h.order.indexOf("insert") < h.order.indexOf("auth"));
  assert.equal(result.status, 400);
  assert.equal(h.patched()?.outcome, "bad_json");
});

test("other extension is acknowledged and not stored", async () => {
  const h = harness(
    JSON.stringify({
      CallID: "vc-9",
      Targetextension: "other-desk",
      RepresentativeName: "דנה",
      RepresentativeCode: "999",
    }),
    async () => true,
  );
  const result = await h.run(true);
  assert.equal(result.status, 200);
  assert.equal(result.body.Err, 0);
  assert.equal(result.body.Errdesc, "OK");
  assert.equal(result.body.status, "OK");
  assert.equal(h.patched()?.outcome, "other_extension");
  assert.equal(h.patched()?.stored, false);
});

test("stored Sofia CDR returns Voicenter's OK body", async () => {
  const h = harness(
    JSON.stringify({
      CallID: "vc-8",
      Targetextension: SOFIA_EXTENSION,
      RepresentativeName: "סופיה",
      RepresentativeCode: SOFIA_USER_ID,
    }),
    async () => true,
  );
  const result = await h.run(true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { Err: 0, Errdesc: "OK", status: "OK" });
  assert.equal(h.patched()?.outcome, "stored" satisfies CdrPostOutcome);
  assert.equal(h.patched()?.callId, "vc-8");
  assert.equal(h.order[0], "insert");
});

test("stage names from Voicenter realtime reason/callstatus and CDR status", () => {
  assert.equal(
    callStage({ reason: "NEWCALL", callstatus: "Ringing", ivruniqueid: "a" }),
    "ring",
  );
  assert.equal(callStage({ CallStatus: "Dialing", ivruniqueid: "a" }), "ring");
  assert.equal(callStage({ DialStatus: "RING", ivruniqueid: "a" }), "ring");
  assert.equal(
    callStage({ reason: "ANSWER", callstatus: "Talking", status: "ANSWER", ivruniqueid: "a" }),
    "answer",
  );
  assert.equal(callStage({ reason: "HANGUP", ivruniqueid: "a" }), "hangup");
  assert.equal(callStage({ status: "NOANSWER", ivruniqueid: "a" }), "hangup");
  assert.equal(
    callStage({
      status: "ANSWER",
      DialStatus: "ANSWER",
      record: "https://rec.example/a.mp3",
      aiData: { transcript: "שלום" },
      ivruniqueid: "a",
    }),
    "hangup",
  );

  const nested = parseCdr({
    data: {
      reason: "NEWCALL",
      extenUser: SOFIA_EXTENSION,
      currentCall: { callstatus: "Ringing", ivrid: "nested-1", callerphone: "0501234567" },
    },
  });
  assert.equal(nested?.stage, "ring");
  assert.equal(nested?.callId, "nested-1");
  assert.equal(nested?.sofia, true);
});

test("ring, answer, and hangup each return 200 and upsert the same ivruniqueid", async () => {
  const callId = "2020072818dcDHFJcc804";
  const stages = ["ring", "answer", "hangup"] as const;
  const bodies = [
    {
      ivruniqueid: callId,
      Targetextension: SOFIA_EXTENSION,
      reason: "NEWCALL",
      callstatus: "Ringing",
    },
    {
      ivruniqueid: callId,
      Targetextension: SOFIA_EXTENSION,
      reason: "ANSWER",
      callstatus: "Talking",
      status: "ANSWER",
    },
    {
      ivruniqueid: callId,
      Targetextension: SOFIA_EXTENSION,
      RepresentativeName: "סופיה",
      status: "ANSWER",
      DialStatus: "ANSWER",
      actualCallDuration: 12,
      record: "https://rec.example/a.mp3",
      aiData: { transcript: "נציג: שלום" },
    },
  ];
  const seen: string[] = [];
  for (let index = 0; index < bodies.length; index += 1) {
    let logged: string | null = null;
    const result = await handleVoicenterPost({
      token: TOKEN,
      contentType: "application/json",
      bodyText: JSON.stringify(bodies[index]),
      authorize: async () => true,
      insertReceipt: async (row) => {
        assert.equal(JSON.stringify(row).includes(TOKEN), false);
        return "receipt";
      },
      updateReceipt: async (_id, patch) => {
        logged = patch.stage;
        assert.equal(patch.outcome, "stored");
      },
      ingest: async (cdr) => {
        const parsed = parseCdr(cdr);
        assert.ok(parsed);
        seen.push(parsed.callId);
        assert.equal(parsed.stage, stages[index]);
        if (stages[index] === "hangup") {
          assert.equal(parsed.recordUrl, "https://rec.example/a.mp3");
          assert.match(parsed.fullText ?? "", /שלום/);
        } else {
          assert.equal(parsed.recordUrl, null);
          assert.equal(parsed.fullText, null);
        }
        return {
          callId: parsed.callId,
          stored: true,
          transcript: Boolean(parsed.fullText),
          queued: stages[index] === "hangup",
        };
      },
    });
    assert.equal(result.status, 200);
    assert.ok(result.status < 400 === false || result.status === 200);
    assert.deepEqual(result.body, { Err: 0, Errdesc: "OK", status: "OK" });
    assert.equal(logged, stages[index]);
  }
  assert.deepEqual(seen, [callId, callId, callId]);
});
