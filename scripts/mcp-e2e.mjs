/**
 * One-shot: create (or reuse) call-control agent API key and run MCP E2E.
 * Usage: node scripts/mcp-e2e.mjs
 *
 * Prints the plaintext API key once so you can share it with Hermes.
 */
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    const full = resolve(process.cwd(), file);
    if (!existsSync(full)) continue;
    for (const raw of readFileSync(full, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[line.slice(0, eq).trim()] = value;
    }
  }
  return env;
}

function hashKey(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

async function mcp(baseUrl, apiKey, tool, params) {
  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, params }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = env.MCP_BASE_URL || env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!url) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard → Project Settings → API → service_role)",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id, slug")
    .eq("slug", "call-control")
    .maybeSingle();

  if (agentErr || !agent) {
    console.error("call-control agent missing:", agentErr?.message);
    process.exit(1);
  }

  const rawKey = `liba_${randomBytes(32).toString("base64url")}`;
  const { error: keyErr } = await admin.from("agent_api_keys").insert({
    agent_id: agent.id,
    key_hash: hashKey(rawKey),
    label: "e2e-test",
  });

  if (keyErr) {
    console.error("Failed to insert API key:", keyErr.message);
    process.exit(1);
  }

  console.log("=== Liba OS MCP E2E ===");
  console.log("Base URL:", baseUrl);
  console.log("Agent slug: call-control");
  console.log("API key (save once):", rawKey);
  console.log("");

  const start = await mcp(baseUrl, rawKey, "os.start_run", {
    agent_slug: "call-control",
    trigger: "e2e-manual",
  });
  console.log("start_run", start.status, JSON.stringify(start.json));
  if (!start.json?.ok) process.exit(1);
  const runId = start.json.data.run_id;

  const cost = await mcp(baseUrl, rawKey, "os.report_cost", {
    run_id: runId,
    service: "llm",
    units: 1200,
    unit_type: "tokens",
    cost_usd: 0.012345,
  });
  console.log("report_cost", cost.status, JSON.stringify(cost.json));
  if (!cost.json?.ok) process.exit(1);

  const log = await mcp(baseUrl, rawKey, "os.log", {
    run_id: runId,
    level: "info",
    message: "e2e smoke test",
  });
  console.log("log", log.status, JSON.stringify(log.json));

  const finish = await mcp(baseUrl, rawKey, "os.finish_run", {
    run_id: runId,
    status: "success",
    items_processed: 3,
    items_failed: 0,
    input_tokens: 800,
    output_tokens: 400,
  });
  console.log("finish_run", finish.status, JSON.stringify(finish.json));
  if (!finish.json?.ok) process.exit(1);

  console.log("\nOK — check /agents/call-control dashboard (runs + costs tabs).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
