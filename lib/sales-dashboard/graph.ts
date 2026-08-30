type GraphToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: GraphToken | null = null;

export function isGraphConfigured(): boolean {
  const azure = Boolean(
    process.env.AZURE_TENANT_ID?.trim() &&
      process.env.AZURE_CLIENT_ID?.trim() &&
      process.env.AZURE_CLIENT_SECRET?.trim(),
  );
  if (!azure) return false;

  const driveId = process.env.SALES_EXCEL_DRIVE_ID?.trim();
  const itemId = process.env.SALES_EXCEL_ITEM_ID?.trim();
  const filePath = process.env.SALES_EXCEL_FILE_PATH?.trim();
  const user = process.env.SALES_EXCEL_USER?.trim();

  if (driveId && (itemId || filePath)) return true;
  if (user && filePath) return true;
  return false;
}

async function getGraphToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const tenant = process.env.AZURE_TENANT_ID?.trim();
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  if (!tenant || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph is not configured");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph token failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("Graph token response missing access_token");
  }

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

function encodedFilePath(filePath: string) {
  return filePath
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function itemUrl(): string {
  const filePath = process.env.SALES_EXCEL_FILE_PATH?.trim();
  const user = process.env.SALES_EXCEL_USER?.trim();
  const driveId = process.env.SALES_EXCEL_DRIVE_ID?.trim();
  const itemId = process.env.SALES_EXCEL_ITEM_ID?.trim();

  if (driveId && itemId) {
    return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
  }

  if (!filePath) {
    throw new Error("Missing SALES_EXCEL_FILE_PATH or SALES_EXCEL_ITEM_ID");
  }
  const pathPart = encodedFilePath(filePath);

  if (driveId) {
    return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${pathPart}`;
  }

  if (user) {
    return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user)}/drive/root:/${pathPart}`;
  }

  throw new Error("Missing SALES_EXCEL_DRIVE_ID or SALES_EXCEL_USER");
}

export type ExcelMeta = {
  fileName: string;
  etag: string | null;
  lastModified: string | null;
};

export type DownloadedExcel = ExcelMeta & {
  buffer: ArrayBuffer;
};

export function normalizeExcelEtag(etag: string | null | undefined): string | null {
  const value = etag?.replace(/W\//, "").replace(/"/g, "").trim();
  return value || null;
}

export async function getSalesExcelMeta(): Promise<ExcelMeta> {
  const token = await getGraphToken();
  const base = itemUrl();
  const url = `${base}?$select=name,eTag,lastModifiedDateTime`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph item lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const meta = (await res.json()) as {
    name?: string;
    eTag?: string;
    lastModifiedDateTime?: string;
  };
  return {
    fileName: meta.name ?? "sales.xlsx",
    etag: normalizeExcelEtag(meta.eTag),
    lastModified: meta.lastModifiedDateTime ?? null,
  };
}

export async function downloadSalesExcel(meta?: ExcelMeta): Promise<DownloadedExcel> {
  const token = await getGraphToken();
  const base = itemUrl();
  const headers = { Authorization: `Bearer ${token}` };
  const info = meta ?? (await getSalesExcelMeta());

  const contentUrl = base.includes("/root:/") ? `${base}:/content` : `${base}/content`;
  const contentRes = await fetch(contentUrl, { headers, cache: "no-store" });
  if (!contentRes.ok) {
    const text = await contentRes.text().catch(() => "");
    throw new Error(`Graph download failed (${contentRes.status}): ${text.slice(0, 200)}`);
  }

  return {
    buffer: await contentRes.arrayBuffer(),
    fileName: info.fileName,
    etag: info.etag,
    lastModified: info.lastModified,
  };
}
