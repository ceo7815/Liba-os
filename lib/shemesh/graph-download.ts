import { publicErrorText } from "@/lib/sync-log";
import { isRetryableHttpStatus, RetryableError, withRetry } from "@/lib/sync-retry";
import { normalizeExcelEtag, type DownloadedExcel } from "@/lib/sales-dashboard/graph";

const GRAPH_TIMEOUT_MS = 25_000;
const GRAPH_ATTEMPTS = 3;

type GraphToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: GraphToken | null = null;

async function graphRequest(url: string, init: RequestInit): Promise<Response> {
  return withRetry(
    async () => {
      const signal =
        typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(GRAPH_TIMEOUT_MS)
          : undefined;
      let res: Response;
      try {
        res = await fetch(url, { ...init, cache: "no-store", signal });
      } catch (err) {
        if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
          throw new RetryableError("OneDrive request timed out");
        }
        const message = err instanceof Error ? err.message : "OneDrive request failed";
        throw new RetryableError(publicErrorText(message));
      }
      if (isRetryableHttpStatus(res.status)) {
        const text = await res.text().catch(() => "");
        throw new RetryableError(
          publicErrorText(`OneDrive request failed (${res.status}): ${text.slice(0, 180)}`),
        );
      }
      return res;
    },
    { attempts: GRAPH_ATTEMPTS },
  );
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
  const res = await graphRequest(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(publicErrorText(`Graph token failed (${res.status}): ${text.slice(0, 180)}`));
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Graph token response missing access_token");
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

/** Same Graph app as Liba's workbook, pointed at another drive item. Shemesh-only. */
export async function downloadGraphDriveItem(driveId: string, itemId: string): Promise<DownloadedExcel> {
  const token = await getGraphToken();
  const base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
  const headers = { Authorization: `Bearer ${token}` };
  const metaRes = await graphRequest(`${base}?$select=name,eTag,lastModifiedDateTime`, { headers });
  if (!metaRes.ok) {
    const text = await metaRes.text().catch(() => "");
    throw new Error(publicErrorText(`Graph item lookup failed (${metaRes.status}): ${text.slice(0, 180)}`));
  }
  const meta = (await metaRes.json()) as { name?: string; eTag?: string; lastModifiedDateTime?: string };
  const contentRes = await graphRequest(`${base}/content`, { headers });
  if (!contentRes.ok) {
    const text = await contentRes.text().catch(() => "");
    throw new Error(publicErrorText(`Graph download failed (${contentRes.status}): ${text.slice(0, 180)}`));
  }
  return {
    buffer: await contentRes.arrayBuffer(),
    fileName: meta.name ?? "shemesh-sales.xlsx",
    etag: normalizeExcelEtag(meta.eTag),
    lastModified: meta.lastModifiedDateTime ?? null,
  };
}

/** Download one drive item by id. Does not use the Liba sales-file env vars. */
export async function downloadDriveItem(
  driveId: string,
  itemId: string,
): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  const file = await downloadGraphDriveItem(driveId, itemId);
  return { buffer: file.buffer, fileName: file.fileName.trim() || "shemesh-sales.xlsx" };
}
