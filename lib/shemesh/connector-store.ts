import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/shemesh/db";
import { decryptVaultSecret, encryptVaultSecret } from "@/lib/vault/crypto";
import { growApproveTransaction, growBase, growReady } from "@/lib/shemesh/grow";
import {
  applyMapping,
  insurerExternalKey,
  parseInsurerFile,
  type ColumnMapping,
  type InsurerId,
} from "@/lib/shemesh/insurer-import";
import { rivhitCacheKey, rivhitMonth, rivhitPost, rivhitShouldCall, RIVHIT_READS, RIVHIT_TEST, type RivhitCache } from "@/lib/shemesh/rivhit";

function missing(error: { message: string } | null): string | null {
  if (!error) return null;
  return isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message;
}

export async function saveRivhit(companyId: string, apiToken: string) {
  if (!companyId.trim() || !apiToken.trim()) return { error: "חובה מזהה חברה ומפתח" };
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_rivhit_settings").upsert({
    id: 1,
    company_id: companyId.trim(),
    api_token_encrypted: encryptVaultSecret(apiToken.trim()),
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  return { error: missing(error) };
}

export async function testRivhit() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("shemesh_rivhit_settings").select("*").eq("id", 1).maybeSingle();
  if (error) return { error: missing(error) };
  const companyId = typeof data?.company_id === "string" ? data.company_id : "";
  const token = typeof data?.api_token_encrypted === "string" ? decryptVaultSecret(data.api_token_encrypted) : "";
  if (!companyId || !token) return { error: "אין קריאה לריווחית לפני שמירת המפתח ומזהה החברה" };
  const cache = (data?.cache && typeof data.cache === "object" ? data.cache : {}) as RivhitCache;
  const key = rivhitCacheKey(RIVHIT_TEST, companyId, {});
  const decision = rivhitShouldCall({
    cachedAt: cache[key]?.at ?? null,
    opsCount: Number(data?.ops_count ?? 0),
    opsMonth: typeof data?.ops_month === "string" ? data.ops_month : null,
    quota: data?.monthly_quota == null ? null : Number(data.monthly_quota),
  });
  if (!decision.call) {
    await admin.from("shemesh_rivhit_settings").update({
      last_checked_at: new Date().toISOString(),
      last_error: decision.reason === "מהמטמון" ? null : decision.reason,
    }).eq("id", 1);
    return { error: decision.reason === "מהמטמון" ? null : decision.reason };
  }
  const result = await rivhitPost(RIVHIT_TEST, { api_token: token, company_id: companyId });
  const month = rivhitMonth();
  const count = data?.ops_month === month ? Number(data?.ops_count ?? 0) + 1 : 1;
  cache[key] = { at: new Date().toISOString(), body: result.ok ? { ok: true } : { status: result.status } };
  const message = result.ok ? null : `ריווחית החזירה ${result.status}`;
  await admin.from("shemesh_rivhit_settings").update({
    ops_month: month,
    ops_count: count,
    cache,
    last_checked_at: new Date().toISOString(),
    last_error: message,
  }).eq("id", 1);
  return { error: message, ops: count };
}

export async function readRivhit(method: (typeof RIVHIT_READS)[number], extra: Record<string, unknown> = {}) {
  if (!RIVHIT_READS.includes(method)) return { error: "פעולה לא מוכרת", rows: null };
  const tested = await testRivhit();
  if (tested.error && tested.error !== "מהמטמון") return { error: tested.error, rows: null };
  const admin = createAdminClient();
  const { data } = await admin.from("shemesh_rivhit_settings").select("company_id, api_token_encrypted, cache, ops_count, ops_month, monthly_quota").eq("id", 1).maybeSingle();
  const companyId = typeof data?.company_id === "string" ? data.company_id : "";
  const token = typeof data?.api_token_encrypted === "string" ? decryptVaultSecret(data.api_token_encrypted) : "";
  if (!companyId || !token) return { error: "אין קריאה לפני שמירה", rows: null };
  const cache = (data?.cache && typeof data.cache === "object" ? data.cache : {}) as RivhitCache;
  const key = rivhitCacheKey(method, companyId, extra);
  const decision = rivhitShouldCall({
    cachedAt: cache[key]?.at ?? null,
    opsCount: Number(data?.ops_count ?? 0),
    opsMonth: typeof data?.ops_month === "string" ? data.ops_month : null,
    quota: data?.monthly_quota == null ? null : Number(data.monthly_quota),
  });
  if (!decision.call) return { error: decision.reason === "מהמטמון" ? null : decision.reason, rows: cache[key]?.body ?? null };
  const result = await rivhitPost(method, { api_token: token, company_id: companyId, ...extra });
  const month = rivhitMonth();
  cache[key] = { at: new Date().toISOString(), body: result.body };
  await admin.from("shemesh_rivhit_settings").update({
    ops_month: month,
    ops_count: (data?.ops_month === month ? Number(data?.ops_count ?? 0) : 0) + 1,
    cache,
    last_error: result.ok ? null : `ריווחית החזירה ${result.status}`,
  }).eq("id", 1);
  return { error: result.ok ? null : `ריווחית החזירה ${result.status}`, rows: result.body };
}

export async function saveGrow(input: { userId: string; pageCode: string; apiKey: string; environment: string }) {
  if (!input.userId.trim() || !input.pageCode.trim()) return { error: "חובה userId ו־pageCode", webhookToken: "" };
  if (input.environment !== "sandbox" && input.environment !== "production") return { error: "סביבה לא מוכרת", webhookToken: "" };
  const admin = createAdminClient();
  const existing = await admin.from("shemesh_grow_settings").select("webhook_token").eq("id", 1).maybeSingle();
  const token = typeof existing.data?.webhook_token === "string" && existing.data.webhook_token
    ? existing.data.webhook_token
    : randomBytes(24).toString("hex");
  const { error } = await admin.from("shemesh_grow_settings").upsert({
    id: 1,
    user_id: input.userId.trim(),
    page_code_encrypted: encryptVaultSecret(input.pageCode.trim()),
    api_key_encrypted: input.apiKey.trim() ? encryptVaultSecret(input.apiKey.trim()) : null,
    environment: input.environment,
    webhook_token: token,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  return { error: missing(error), webhookToken: token };
}

export async function growPublicStatus() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("shemesh_grow_settings").select("user_id, environment, webhook_token, last_checked_at, last_error, page_code_encrypted").eq("id", 1).maybeSingle();
  if (error) return { missing: isMissingRelation(error.message), connected: false, environment: "sandbox", webhookToken: null as string | null, lastCheckedAt: null as string | null, lastError: null as string | null };
  return {
    missing: false,
    connected: growReady({ userId: data?.user_id, pageCode: data?.page_code_encrypted ? "saved" : "" }),
    environment: data?.environment === "production" ? "production" : "sandbox",
    webhookToken: typeof data?.webhook_token === "string" ? data.webhook_token : null,
    lastCheckedAt: typeof data?.last_checked_at === "string" ? data.last_checked_at : null,
    lastError: typeof data?.last_error === "string" ? data.last_error : null,
  };
}

export async function loadGrowForWebhook(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("shemesh_grow_settings").select("*").eq("webhook_token", token).maybeSingle();
  if (!data?.user_id || !data.page_code_encrypted) return null;
  return {
    userId: String(data.user_id),
    pageCode: decryptVaultSecret(String(data.page_code_encrypted)),
    apiKey: data.api_key_encrypted ? decryptVaultSecret(String(data.api_key_encrypted)) : null,
    environment: String(data.environment ?? "sandbox"),
  };
}

export async function noteGrow(patch: { lastError?: string | null; transactionId?: string | null }) {
  const admin = createAdminClient();
  await admin.from("shemesh_grow_settings").update({
    last_checked_at: new Date().toISOString(),
    last_error: patch.lastError ?? null,
    last_transaction_id: patch.transactionId ?? undefined,
  }).eq("id", 1);
}

export async function approveGrowFromWebhook(token: string, fields: Record<string, string>) {
  const creds = await loadGrowForWebhook(token);
  if (!creds) return { ok: false, status: 404 };
  const transactionId = fields.transactionId || fields.transaction_id || fields.processId || "";
  if (!transactionId) {
    await noteGrow({ lastError: "וובהוק בלי מזהה עסקה" });
    return { ok: true, status: 200 };
  }
  const approved = await growApproveTransaction({
    environment: creds.environment,
    userId: creds.userId,
    pageCode: creds.pageCode,
    apiKey: creds.apiKey,
    transactionId,
    transactionToken: fields.transactionToken || fields.transaction_token || null,
  });
  await noteGrow({
    transactionId,
    lastError: approved.ok ? null : `אישור עסקה החזיר ${approved.status}`,
  });
  return { ok: approved.ok, status: approved.ok ? 200 : 500 };
}

export function growEndpointLabel(environment: string): string {
  return growBase(environment);
}

export async function saveInsurerMapping(company: InsurerId, mapping: ColumnMapping) {
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_insurer_mappings").upsert({
    company,
    mapping,
    updated_at: new Date().toISOString(),
  });
  return { error: missing(error) };
}

export async function importInsurerRows(input: {
  company: InsurerId;
  fileName: string;
  bytes: Uint8Array;
  mapping: ColumnMapping;
}) {
  const parsed = parseInsurerFile(input.fileName, input.bytes);
  const applied = applyMapping(parsed, input.mapping);
  if (!input.mapping.policy) return { error: "חסרה עמודת פוליסה", preview: applied, headers: parsed.headers, kind: parsed.kind };
  const admin = createAdminClient();
  const history = await admin.from("shemesh_insurer_imports").insert({
    company: input.company,
    kind: parsed.kind,
    file_name: input.fileName,
    row_count: applied.rows.length,
  }).select("id").single();
  if (history.error || !history.data) return { error: missing(history.error), preview: applied, headers: parsed.headers, kind: parsed.kind };
  let inserted = 0;
  let skipped = 0;
  for (const row of applied.rows) {
    if (!row.policy) {
      skipped += 1;
      continue;
    }
    const key = insurerExternalKey(input.company, row);
    const premium = row.premium ? Number(row.premium.replace(/,/g, "")) : null;
    const commission = row.commission ? Number(row.commission.replace(/,/g, "")) : null;
    const { error } = await admin.from("shemesh_insurer_rows").insert({
      company: input.company,
      external_key: key,
      policy_ref: row.policy,
      client_name: row.client || null,
      premium: Number.isFinite(premium) ? premium : null,
      commission: Number.isFinite(commission) ? commission : null,
      produced_on: /^\d{4}-\d{2}-\d{2}/.test(row.date) ? row.date.slice(0, 10) : null,
      import_id: history.data.id,
    });
    if (error) skipped += 1;
    else inserted += 1;
  }
  await admin.from("shemesh_insurer_imports").update({ inserted, skipped }).eq("id", history.data.id);
  await saveInsurerMapping(input.company, input.mapping);
  return { error: null, inserted, skipped, preview: applied, headers: parsed.headers, kind: parsed.kind };
}

export async function loadInsurerSettlement() {
  try {
    const admin = createAdminClient();
    const [rows, history] = await Promise.all([
      admin.from("shemesh_insurer_rows").select("company, policy_ref, client_name, commission, premium, produced_on").order("created_at", { ascending: false }).limit(80),
      admin.from("shemesh_insurer_imports").select("id, company, kind, file_name, inserted, skipped, created_at").order("created_at", { ascending: false }).limit(12),
    ]);
    if (rows.error && isMissingRelation(rows.error.message)) return { missing: true, rows: [], history: [], commission: 0 };
    const list = (rows.data ?? []).map((row) => ({
      company: String(row.company),
      policy: String(row.policy_ref ?? ""),
      client: String(row.client_name ?? ""),
      commission: row.commission == null ? null : Number(row.commission),
      premium: row.premium == null ? null : Number(row.premium),
      day: String(row.produced_on ?? ""),
    }));
    return {
      missing: false,
      rows: list,
      history: (history.data ?? []).map((row) => ({
        id: String(row.id),
        company: String(row.company),
        kind: String(row.kind),
        fileName: String(row.file_name ?? ""),
        inserted: Number(row.inserted ?? 0),
        skipped: Number(row.skipped ?? 0),
        createdAt: String(row.created_at ?? ""),
      })),
      commission: list.reduce((sum, row) => sum + (row.commission ?? 0), 0),
    };
  } catch {
    return { missing: true, rows: [], history: [], commission: 0 };
  }
}
