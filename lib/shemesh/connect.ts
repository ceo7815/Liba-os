import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_SHEMESH_AD_ACCOUNTS } from "@/lib/finance/brand-accounts";
import { facebookGraphVersion } from "@/lib/facebook-ads/config";
import { digitsOnly } from "@/lib/google-ads/config";
import { listAccessibleCustomerIds, refreshAccessToken, searchGoogleAds } from "@/lib/google-ads/client";
import { downloadGraphDriveItem } from "@/lib/shemesh/graph-download";
import { isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { shemeshExcelLocalPath } from "@/lib/shemesh/sales-excel-path";
import { ingestShemeshSalesBuffer } from "@/lib/shemesh/sales-workbook-store";
import { testGrow, testRivhit } from "@/lib/shemesh/connector-store";
import { decryptVaultSecret, encryptVaultSecret } from "@/lib/vault/crypto";

export const SHEMESH_GOOGLE_MCC = "2888742858";
export const SHEMESH_FACEBOOK_ACCOUNT = DEFAULT_SHEMESH_AD_ACCOUNTS[0];

export type ShemeshLink = {
  id: string;
  name: string;
  connected: boolean;
  syncedAt: string | null;
  checkedAt: string | null;
  note: string | null;
  detail: string | null;
  href: string;
};

export const SHEMESH_EXCEL_FILE = "דוח מכירות שמש פדיונות 2";
export const SHEMESH_EXCEL_FOLDER = "תפעול שמש";

/** A test may call the vendor only after a credential is already stored. */
export function shemeshOutboundAllowed(hasCredential: boolean): { call: boolean; message: string } {
  if (!hasCredential) return { call: false, message: "אין פרטי התחברות שמורים. לא יצאה קריאה." };
  return { call: true, message: "" };
}

function assertNoOutboundWithoutCredentials(): void {
  for (const id of ["facebook", "google", "excel", "rivhit", "grow"]) {
    const gate = shemeshOutboundAllowed(false);
    if (gate.call) throw new Error(`${id} test must not call out without credentials`);
  }
}

assertNoOutboundWithoutCredentials();

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function readRow(table: string) {
  const admin = shemeshAdmin();
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
    const [facebook, google, excel, surense, rivhit, grow, imports] = await Promise.all([
      readRow("shemesh_facebook_settings"),
      readRow("shemesh_google_settings"),
      readRow("shemesh_excel_settings"),
      readRow("shemesh_surense_settings"),
      readRow("shemesh_rivhit_settings"),
      readRow("shemesh_grow_settings"),
      shemeshAdmin().from("shemesh_insurer_imports").select("file_name, created_at, company").order("created_at", { ascending: false }).limit(1),
    ]);
    if (facebook.missing) return { missing: true, links: [], googleChoices: [] };
    const googleChoices = Array.isArray(google.row?.candidate_customers)
      ? (google.row?.candidate_customers as unknown[]).map((item) => String(item)).filter(Boolean)
      : [];
    const customerId = text(google.row?.customer_id);
    const latestImport = imports.error ? null : ((imports.data ?? []) as Record<string, unknown>[])[0] ?? null;
    const links: ShemeshLink[] = [
      {
        id: "shemesh-facebook",
        name: "שמש · פייסבוק",
        connected: Boolean(facebook.row?.access_token_encrypted),
        syncedAt: text(facebook.row?.last_synced_at),
        checkedAt: null,
        detail: `act_${SHEMESH_FACEBOOK_ACCOUNT}`,
        note: text(facebook.row?.last_error) || (facebook.row?.access_token_encrypted ? text(facebook.row?.connected_name) : null) || "לא מחובר",
        href,
      },
      {
        id: "shemesh-google-ads",
        name: "שמש · גוגל",
        connected: Boolean(google.row?.refresh_token_encrypted && customerId),
        syncedAt: text(google.row?.last_synced_at),
        checkedAt: null,
        detail: customerId ? `חשבון ${customerId}` : `MCC ${SHEMESH_GOOGLE_MCC} · החשבון נבחר מהרשימה`,
        note: text(google.row?.last_error) || (googleChoices.length ? `${googleChoices.length} חשבונות ברשימה` : "אין רשימה שמורה"),
        href,
      },
      {
        id: "shemesh-sales-excel",
        name: "שמש · דוח מכירות",
        connected: Boolean(excel.row?.last_synced_at),
        syncedAt: text(excel.row?.last_synced_at),
        checkedAt: null,
        detail: `${text(excel.row?.file_name) || SHEMESH_EXCEL_FILE} · ${SHEMESH_EXCEL_FOLDER}`,
        note: text(excel.row?.last_error) || "מזהה הפריט ב-OneDrive עדיין לא נשמר",
        href,
      },
      {
        id: "shemesh-surense",
        name: "שמש · שורנס",
        connected: Boolean(surense.row?.client_id_encrypted) || Boolean(process.env.SHEMESH_SURENSE_CLIENT_ID?.trim()),
        syncedAt: text(surense.row?.last_synced_at),
        checkedAt: null,
        detail: surense.row?.mode === "separate" ? "סוכנות נפרדת" : "אותה סוכנות, סינון שמש",
        note: text(surense.row?.last_error) || "אין משיכה נפרדת",
        href: "/shemesh/agency",
      },
      {
        id: "shemesh-rivhit",
        name: "שמש · ריווחית",
        connected: Boolean(text(rivhit.row?.company_id) && rivhit.row?.api_token_encrypted),
        syncedAt: null,
        checkedAt: text(rivhit.row?.last_checked_at),
        detail: text(rivhit.row?.company_id) || "חסר company_id",
        note: rivhit.missing ? "הטבלה עדיין לא הורצה" : text(rivhit.row?.last_error) || "לא מחובר",
        href,
      },
      {
        id: "shemesh-grow",
        name: "שמש · גרואו",
        connected: Boolean(text(grow.row?.user_id) && grow.row?.page_code_encrypted),
        syncedAt: null,
        checkedAt: text(grow.row?.last_checked_at),
        detail: grow.row?.environment === "production" ? "ייצור" : "סנדבוקס",
        note: grow.missing ? "הטבלה עדיין לא הורצה" : text(grow.row?.last_error) || "לא מחובר",
        href,
      },
      {
        id: "shemesh-insurance",
        name: "שמש · ביטוח",
        connected: false,
        syncedAt: null,
        checkedAt: text(latestImport?.created_at),
        detail: "ייבוא אקסל או מסלקה. העמלה שייכת לליבה",
        note: imports.error ? "הטבלה עדיין לא הורצה" : text(latestImport?.file_name) || "אין ייבוא",
        href: "/shemesh/insurance",
      },
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
  const admin = shemeshAdmin();
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
  const admin = shemeshAdmin();
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
  const admin = shemeshAdmin();
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
  const admin = shemeshAdmin();
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
      notes.push("שורנס שמש: אותה סוכנות, בלי משיכה נפרדת");
    } else if (!text(surense.row?.client_id_encrypted) && !process.env.SHEMESH_SURENSE_CLIENT_ID?.trim()) {
      notes.push("שורנס שמש: חסרות הרשאות נפרדות. לא יצאה קריאה");
    } else {
      notes.push("שורנס שמש: הרשאות נפרדות שמורות, בלי משיכה שנייה");
    }
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "שורנס שמש נכשל");
  }

  notes.push("ריווחית וגרואו נבדקים רק מכפתור הבדיקה, ואחרי שהפרטים נשמרו");
  return { ok: true, notes };
}

export async function testShemeshProvider(provider: "rivhit" | "grow" | "insurance") {
  void provider;
  return { error: "הבדיקה היא בכרטיס של ריווחית, גרואו או ייבוא הביטוח, ורק אחרי שהפרטים נשמרו." };
}

export async function testShemeshLink(link: string): Promise<{ error: string | null }> {
  if (link === "shemesh-facebook") return testFacebookLink();
  if (link === "shemesh-google-ads") return testGoogleLink();
  if (link === "shemesh-sales-excel") return testExcelLink();
  if (link === "shemesh-surense") return { error: "אין משיכה נפרדת לשורנס מהמסך הזה. לא יצאה קריאה." };
  if (link === "shemesh-rivhit") return testRivhit();
  if (link === "shemesh-grow") return testGrow();
  if (link === "shemesh-insurance") return { error: "אין API לחברות הביטוח. הבדיקה היא ייבוא קובץ, והעמלה נשארת של ליבה." };
  return { error: "חיבור לא מוכר" };
}

async function testFacebookLink() {
  const facebook = await readRow("shemesh_facebook_settings");
  const encrypted = text(facebook.row?.access_token_encrypted);
  const gate = shemeshOutboundAllowed(Boolean(encrypted));
  if (!gate.call || !encrypted) {
    const message = `אין אסימון שמור לחשבון act_${SHEMESH_FACEBOOK_ACCOUNT}. לא יצאה קריאה.`;
    await mark("shemesh_facebook_settings", { last_error: message }).catch(() => undefined);
    return { error: message };
  }
  try {
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
    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "פייסבוק שמש נכשל";
    await mark("shemesh_facebook_settings", { last_error: message.slice(0, 300) }).catch(() => undefined);
    return { error: message };
  }
}

async function testGoogleLink() {
  const google = await readRow("shemesh_google_settings");
  const encrypted = text(google.row?.refresh_token_encrypted);
  const customerId = digitsOnly(text(google.row?.customer_id));
  if (!encrypted) {
    const message = "אין אסימון שמור. החשבון נבחר מהרשימה רק אחרי ההתחברות. לא יצאה קריאה.";
    await mark("shemesh_google_settings", { last_error: message }).catch(() => undefined);
    return { error: message };
  }
  if (!customerId) {
    const message = "בחרו חשבון גוגל מהרשימה. לא יצאה קריאה.";
    await mark("shemesh_google_settings", { last_error: message }).catch(() => undefined);
    return { error: message };
  }
  try {
    const access = await refreshAccessToken(decryptVaultSecret(encrypted));
    await searchGoogleAds(access, customerId, "SELECT campaign.id FROM campaign LIMIT 1", SHEMESH_GOOGLE_MCC);
    await mark("shemesh_google_settings", {
      customer_id: customerId,
      login_customer_id: SHEMESH_GOOGLE_MCC,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "גוגל שמש נכשל";
    await mark("shemesh_google_settings", { last_error: message.slice(0, 300) }).catch(() => undefined);
    return { error: message };
  }
}

async function testExcelLink() {
  const excel = await readRow("shemesh_excel_settings");
  const driveId = text(excel.row?.drive_id) || process.env.SHEMESH_EXCEL_DRIVE_ID?.trim() || "";
  const itemId = text(excel.row?.item_id) || process.env.SHEMESH_EXCEL_ITEM_ID?.trim() || "";
  const gate = shemeshOutboundAllowed(Boolean(driveId && itemId));
  if (!gate.call) {
    const message = `הקובץ ${SHEMESH_EXCEL_FILE} בתיקייה ${SHEMESH_EXCEL_FOLDER}: מזהה הפריט עדיין לא נשמר. לא יצאה קריאה.`;
    await mark("shemesh_excel_settings", { file_name: text(excel.row?.file_name) || SHEMESH_EXCEL_FILE, last_error: message }).catch(() => undefined);
    return { error: message };
  }
  try {
    const file = await downloadGraphDriveItem(driveId, itemId);
    await ingestShemeshSalesBuffer(Buffer.from(file.buffer), file.fileName);
    await mark("shemesh_excel_settings", { drive_id: driveId, item_id: itemId, file_name: file.fileName, last_synced_at: new Date().toISOString(), last_error: null });
    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "אקסל שמש נכשל";
    await mark("shemesh_excel_settings", { last_error: message.slice(0, 300) }).catch(() => undefined);
    return { error: message };
  }
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
