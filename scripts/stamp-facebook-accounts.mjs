/**
 * Stamp facebook_ads_campaign_map.ad_account_id / ad_account_name
 * from the connected Meta token. Does not change source_name.
 */
import { createHash, createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const full = resolve(process.cwd(), fileName);
  if (!existsSync(full)) return;
  for (const rawLine of readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function vaultKey() {
  const raw = process.env.VAULT_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Missing VAULT_ENCRYPTION_KEY");
  const fromB64 = Buffer.from(raw, "base64");
  if (fromB64.length === 32) return fromB64;
  return createHash("sha256").update(raw, "utf8").digest();
}

function decrypt(payload) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

const version = `v${(process.env.FACEBOOK_GRAPH_VERSION || "21.0").replace(/^v/i, "")}`;

async function graph(path, token, search = {}) {
  const url = new URL(`https://graph.facebook.com/${version}${path}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(search)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Facebook ${res.status}`);
  }
  return json;
}

async function pages(path, token, search) {
  const rows = [];
  let next = { path, search };
  while (next) {
    const json = await graph(next.path, token, next.search);
    for (const row of json.data ?? []) rows.push(row);
    const nextUrl = json.paging?.next;
    if (!nextUrl) break;
    const parsed = new URL(nextUrl);
    const nextSearch = {};
    parsed.searchParams.forEach((value, key) => {
      if (key !== "access_token") nextSearch[key] = value;
    });
    next = {
      path: parsed.pathname.replace(new RegExp(`^/${version}`), "") || parsed.pathname,
      search: nextSearch,
    };
  }
  return rows;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: settings, error: settingsError } = await admin
  .from("facebook_ads_settings")
  .select("access_token_encrypted")
  .eq("id", 1)
  .maybeSingle();
if (settingsError) throw new Error(settingsError.message);
const token =
  process.env.FACEBOOK_ACCESS_TOKEN?.trim() ||
  (settings?.access_token_encrypted ? decrypt(settings.access_token_encrypted) : "");
if (!token) throw new Error("No Facebook token");

const accounts = (await pages("/me/adaccounts", token, {
  fields: "id,name,account_id",
  limit: "100",
}))
  .map((row) => ({
    id: String(row.account_id || String(row.id || "").replace(/^act_/i, "")),
    name: String(row.name || ""),
  }))
  .filter((row) => row.id);

const byCampaign = new Map();
for (const account of accounts) {
  const listed = await pages(`/act_${account.id}/campaigns`, token, {
    fields: "id,name",
    limit: "200",
  });
  for (const row of listed) {
    if (!row.id) continue;
    byCampaign.set(String(row.id), { id: account.id, name: account.name });
  }
  console.log(`${account.name} (${account.id}): ${listed.length} campaigns`);
}

const byAccount = new Map();
for (const [campaignId, account] of byCampaign) {
  const key = `${account.id}\t${account.name}`;
  const list = byAccount.get(key) ?? [];
  list.push(campaignId);
  byAccount.set(key, list);
}

let updated = 0;
for (const [key, campaignIds] of byAccount) {
  const [adAccountId, adAccountName] = key.split("\t");
  for (let i = 0; i < campaignIds.length; i += 150) {
    const slice = campaignIds.slice(i, i + 150);
    const { data, error } = await admin
      .from("facebook_ads_campaign_map")
      .update({
        ad_account_id: adAccountId,
        ad_account_name: adAccountName,
        updated_at: new Date().toISOString(),
      })
      .in("facebook_campaign_id", slice)
      .select("facebook_campaign_id");
    if (error) throw new Error(error.message);
    updated += data?.length ?? 0;
  }
  console.log(`stamped ${adAccountName}: ${campaignIds.length} listed`);
}

console.log(`updated ${updated} rows already in the map`);
