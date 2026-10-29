import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_SHEMESH_AD_ACCOUNTS } from "@/lib/finance/brand-accounts";
import { facebookGraphVersion } from "@/lib/facebook-ads/config";
import { digitsOnly } from "@/lib/google-ads/config";
import { listAccessibleCustomerIds, refreshAccessToken, searchGoogleAds } from "@/lib/google-ads/client";
import { downloadGraphDriveItem } from "@/lib/sales-dashboard/graph";
import { isMissingRelation } from "@/lib/shemesh/db";
import { shemeshExcelLocalPath } from "@/lib/shemesh/sales-excel-path";
import { ingestShemeshSalesBuffer } from "@/lib/shemesh/sales-workbook-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptVaultSecret, encryptVaultSecret } from "@/lib/vault/crypto";

export const SHEMESH_GOOGLE_MCC = "2888742858";
export const SHEMESH_FACEBOOK_ACCOUNT = DEFAULT_SHEMESH_AD_ACCOUNTS[0];

export type ShemeshLink = {
  id: string;
  name: string;
  connected: boolean;
  syncedAt: string | null;
  note: string | null;
  href: string;
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function readRow(table: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from(table).select("*").eq("id", 1).maybeSingle();
  if (error) {
    if (isMissingRelation(error.message)) return { missing: true, row: null as Record<string, unknown> | null };
    return { missing: false, row: null, error: error.message };
  }
  return { missing: false, row: (data ?? null) as Record<string, unknown> | null };
}

export async function loadShemeshLinks(): Promise<{ missing: boolean; links: ShemeshLink[]; googleChoices: string[] }> {
  const href = "/shemesh/sources";
  try {
    const [facebook, google, excel, surense, providers] = await Promise.all([
      readRow("shemesh_facebook_settings"),
      readRow("shemesh_google_settings"),
      readRow("shemesh_excel_settings"),
      readRow("shemesh_surense_settings"),
      createAdminClient().from("shemesh_provider_secrets").select("provider, api_url, secret_encrypted, last_checked_at, last_error"),
    ]);
    if (facebook.missing) return { missing: true, links: [], googleChoices: [] };
    const googleChoices = Array.isArray(google.row?.candidate_customers)
      ? (google.row?.candidate_customers as unknown[]).map((item) => String(item)).filter(Boolean)
      : [];
    const providerRows = providers.error ? [] : providers.data ?? [];
    const provider = (id: string) => providerRows.find((row) => row.provider === id);
    const links: ShemeshLink[] = [
      {
        id: "shemesh-facebook",
        name: "שמש · פייסבוק",
        connected: Boolean(facebook.row?.access_token_encrypted),
        syncedAt: text(facebook.row?.last_synced_at),
        note: text(facebook.row?.last_error) || text(facebook.row?.connected_name) || `act_${SHEMESH_FACEBOOK_ACCOUNT}`,
        href,
      },
      {
        id: "shemesh-google-ads",
        name: "שמש · גוגל",
        connected: Boolean(google.row?.refresh_token_encrypted && google.row?.customer_id),
        syncedAt: text(google.row?.last_synced_at),
        note: text(google.row?.customer_id) || (googleChoices.length ? "בחרו חשבון" : text(google.row?.last_error)),
        href,
      },
      {
        id: "shemesh-sales-excel",
        name: "שמש · דוח מכירות",
        connected: Boolean(excel.row?.last_synced_at || process.env.SHEMESH_EXCEL_DRIVE_ID),
        syncedAt: text(excel.row?.last_synced_at),
        note: text(excel.row?.file_name) || text(excel.row?.last_error),
        href: "/shemesh/gviya",
      },
      {
        id: "shemesh-surense",
        name: "שמש · שורנס",
        connected: Boolean(surense.row?.client_id_encrypted) || surense.row?.mode === "same" || Boolean(process.env.SHEMESH_SURENSE_CLIENT_ID),
        syncedAt: text(surense.row?.last_synced_at),
        note: surense.row?.mode === "separate" ? "סוכנות נפרדת" : "אותה סוכנות, סינון שמש",
        href: "/shemesh/agency",
      },
      ...(["rivhit", "grow", "insurance"] as const).map((id) => {
        const row = provider(id);
        return {
          id: `shemesh-${id}`,
          name: `שמש · ${id === "rivhit" ? "ריווחית" : id === "grow" ? "גרואו" : "ביטוח"}`,
          connected: Boolean(row?.api_url && row?.secret_encrypted),
          syncedAt: text(row?.last_checked_at),
          note: text(row?.last_error) || (row?.secret_encrypted ? "מפתח שמור" : "לא מחובר"),
          href,
        };
      }),
    ];
    return { missing: false, links, googleChoices };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) {
      return { missing: true, links: [], googleChoices: [] };
    }
    return { missing: false, links: [], googleChoices: [] };
  }
}

export async function saveShemeshProvider(provider: "rivhit" | "grow" | "insurance", apiUrl: string, secret: string) {
  if (!apiUrl.trim() || !secret.trim()) return { error: "חובה כתובת ומפתח" };
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_provider_secrets").upsert({
    provider,
    api_url: apiUrl.trim(),
    secret_encrypted: encryptVaultSecret(secret.trim()),
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  return { error: null };
}

export async function saveShemeshSurense(mode: "same" | "separate", clientId: string, clientSecret: string) {
  const admin = createAdminClient();
  const row: Record<string, unknown> = { id: 1, mode, updated_at: new Date().toISOString(), last_error: null };
  if (clientId.trim()) row.client_id_encrypted = encryptVaultSecret(clientId.trim());
  if (clientSecret.trim()) row.client_secret_encrypted = encryptVaultSecret(clientSecret.trim());
  const { error } = await admin.from("shemesh_surense_settings").upsert(row);
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  return { error: null };
}

export async function pickShemeshGoogleCustomer(customerId: string) {
  const id = digitsOnly(customerId);
  if (!id) return { error: "חסר מספר חשבון" };
  const admin = createAdminClient();
  const { error } = await admin.from("shemesh_google_settings").upsert({
    id: 1,
    customer_id: id,
    login_customer_id: SHEMESH_GOOGLE_MCC,
    updated_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) return { error: isMissingRelation(error.message) ? "הטבלה עדיין לא הורצה" : error.message };
  return { error: null };
}

async function mark(table: string, patch: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from(table).upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
}

export async function syncShemeshSources(): Promise<{ ok: boolean; notes: string[] }> {
  const notes: string[] = [];
  try {
    const driveId = process.env.SHEMESH_EXCEL_DRIVE_ID?.trim();
    const itemId = process.env.SHEMESH_EXCEL_ITEM_ID?.trim();
    if (driveId && itemId) {
      const file = await downloadGraphDriveItem(driveId, itemId);
      await ingestShemeshSalesBuffer(Buffer.from(file.buffer), file.fileName);
      await mark("shemesh_excel_settings", { drive_id: driveId, item_id: itemId, file_name: file.fileName, last_synced_at: new Date().toISOString(), last_error: null });
      notes.push("אקסל שמש עודכן מ־OneDrive");
    } else {
      const path = shemeshExcelLocalPath();
      if (path && existsSync(path)) {
        const fileName = path.split(/[/\\]/).pop() || "shemesh-sales.xlsx";
        await ingestShemeshSalesBuffer(readFileSync(path), fileName);
        await mark("shemesh_excel_settings", { file_name: fileName, last_synced_at: new Date().toISOString(), last_error: null });
        notes.push("אקסל שמש עודכן מהעותק המקומי");
      } else notes.push("אקסל שמש: אין מזהה קובץ");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "אקסל שמש נכשל";
    notes.push(message);
    await mark("shemesh_excel_settings", { last_error: message.slice(0, 300) }).catch(() => undefined);
  }

  try {
    const facebook = await readRow("shemesh_facebook_settings");
    const encrypted = text(facebook.row?.access_token_encrypted);
    if (!encrypted) notes.push("פייסבוק שמש: לא מחובר");
    else {
      const token = decryptVaultSecret(encrypted);
      const version = facebookGraphVersion();
      const account = `act_${SHEMESH_FACEBOOK_ACCOUNT}`;
      const res = await fetch(`https://graph.facebook.com/${version}/${account}?fields=name`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "פייסבוק שמש לא אומת");
      await mark("shemesh_facebook_settings", {
        ad_account_id: SHEMESH_FACEBOOK_ACCOUNT,
        connected_name: json.name ?? null,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      });
      notes.push("פייסבוק שמש אומת");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "פייסבוק שמש נכשל";
    notes.push(message);
    await mark("shemesh_facebook_settings", { last_error: message.slice(0, 300) }).catch(() => undefined);
  }

  try {
    const google = await readRow("shemesh_google_settings");
    const encrypted = text(google.row?.refresh_token_encrypted);
    const customerId = digitsOnly(text(google.row?.customer_id));
    if (!encrypted || !customerId) notes.push("גוגל שמש: אין חשבון נבחר");
    else {
      const access = await refreshAccessToken(decryptVaultSecret(encrypted));
      await searchGoogleAds(access, customerId, "SELECT campaign.id FROM campaign LIMIT 1", SHEMESH_GOOGLE_MCC);
      await mark("shemesh_google_settings", {
        customer_id: customerId,
        login_customer_id: SHEMESH_GOOGLE_MCC,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      });
      notes.push("גוגל שמש אומת");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "גוגל שמש נכשל";
    notes.push(message);
    await mark("shemesh_google_settings", { last_error: message.slice(0, 300) }).catch(() => undefined);
  }

  try {
    const surense = await readRow("shemesh_surense_settings");
    const separate = surense.row?.mode === "separate" || Boolean(process.env.SHEMESH_SURENSE_CLIENT_ID?.trim());
    if (!separate) {
      await mark("shemesh_surense_settings", { mode: "same", last_synced_at: new Date().toISOString(), last_error: null });
      notes.push("שורנס שמש: אותה סוכנות, סינון בלבד");
    } else if (!text(surense.row?.client_id_encrypted) && !process.env.SHEMESH_SURENSE_CLIENT_ID?.trim()) {
      notes.push("שורנס שמש: חסרות הרשאות נפרדות");
    } else {
      await mark("shemesh_surense_settings", { mode: "separate", last_synced_at: new Date().toISOString(), last_error: null });
      notes.push("שורנס שמש: הרשאות נפרדות שמורות");
    }
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "שורנס שמש נכשל");
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("shemesh_provider_secrets").select("provider, api_url, secret_encrypted");
    if (!error) {
      for (const row of data ?? []) {
        if (!row.api_url || !row.secret_encrypted) continue;
        const secret = decryptVaultSecret(String(row.secret_encrypted));
        let message: string | null = null;
        try {
          const res = await fetch(String(row.api_url), {
            headers: { Authorization: `Bearer ${secret}` },
            cache: "no-store",
          });
          if (!res.ok) message = `בדיקה החזירה ${res.status}`;
        } catch (err: unknown) {
          message = err instanceof Error ? err.message : "הבדיקה נכשלה";
        }
        await admin.from("shemesh_provider_secrets").update({
          last_checked_at: new Date().toISOString(),
          last_error: message,
        }).eq("provider", row.provider);
        notes.push(`${row.provider}: ${message ?? "נענה"}`);
      }
    }
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "בדיקת ספק נכשלה");
  }

  return { ok: true, notes };
}

export async function storeShemeshFacebookToken(accessToken: string, expiresAt: string | null, name: string | null) {
  await mark("shemesh_facebook_settings", {
    ad_account_id: SHEMESH_FACEBOOK_ACCOUNT,
    access_token_encrypted: encryptVaultSecret(accessToken),
    token_expires_at: expiresAt,
    connected_name: name,
    last_error: null,
  });
}

export async function storeShemeshGoogleToken(refreshToken: string, email: string | null, customers: string[]) {
  await mark("shemesh_google_settings", {
    refresh_token_encrypted: encryptVaultSecret(refreshToken),
    connected_email: email,
    login_customer_id: SHEMESH_GOOGLE_MCC,
    candidate_customers: customers,
    last_error: null,
  });
}

export async function listShemeshGoogleCustomers(accessToken: string): Promise<string[]> {
  try {
    const rows = await searchGoogleAds(
      accessToken,
      SHEMESH_GOOGLE_MCC,
      "SELECT customer_client.client_customer, customer_client.descriptive_name FROM customer_client WHERE customer_client.level <= 1",
      SHEMESH_GOOGLE_MCC,
    );
    const ids = rows
      .map((row) => {
        const client = row.customerClient as { clientCustomer?: string } | undefined;
        return digitsOnly(client?.clientCustomer?.split("/").pop());
      })
      .filter(Boolean);
    if (ids.length) return Array.from(new Set(ids));
  } catch {
    // Fall through to the accounts this login can open.
  }
  return listAccessibleCustomerIds(accessToken);
}
