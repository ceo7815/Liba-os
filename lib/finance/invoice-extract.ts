/**
 * Extract supplier + amount from an invoice image/PDF via OpenAI.
 * Fast path: images → chat vision (low detail). PDFs → Files + Responses API.
 * Always times out so the UI never hangs.
 */

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const FILES_URL = "https://api.openai.com/v1/files";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const VISION_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
const EXTRACT_TIMEOUT_MS = 25_000;
const MAX_AI_BYTES = 6 * 1024 * 1024;

export type InvoiceExtractResult = {
  vendor: string | null;
  amount: number | null;
  title: string | null;
  paidAt: string | null;
  vatIncluded: boolean | null;
  source: "ai" | "filename";
};

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function suggestVendorFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(
      /חשבונית|קבלה|אישור|תשלום|מס\.?\s*עסקאות|מעמ|invoice|receipt|tax|vat|pdf|jpg|jpeg|png|webp/gi,
      " ",
    )
    .replace(/\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}/g, " ")
    .replace(/\d{4}[-_]\d{2}([-_]\d{2})?/g, " ")
    .replace(/[_\-.()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80);
}

function suggestAmountFromFileName(fileName: string): number | null {
  const matches = Array.from(
    fileName.matchAll(
      /(?:₪|ש[״"]?ח|nis|ils)?\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:₪|ש[״"]?ח)?/gi,
    ),
  );
  const amounts: number[] = [];
  for (const m of matches) {
    const raw = m[1]?.replace(/[,\s]/g, "");
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n < 10_000_000) amounts.push(n);
  }
  if (!amounts.length) return null;
  return amounts.sort((a, b) => b - a)[0] ?? null;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,\-]/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function fromFilename(fileName: string): InvoiceExtractResult {
  const vendor = suggestVendorFromFileName(fileName) || null;
  return {
    vendor,
    amount: suggestAmountFromFileName(fileName),
    title: vendor,
    paidAt: null,
    vatIncluded: true,
    source: "filename",
  };
}

function mapParsed(parsed: Record<string, unknown>): InvoiceExtractResult {
  const vendor =
    typeof parsed.vendor === "string" && parsed.vendor.trim()
      ? parsed.vendor.trim().slice(0, 120)
      : null;
  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : vendor;
  return {
    vendor,
    amount: normalizeAmount(parsed.amount),
    title,
    paidAt: normalizeDate(parsed.paidAt),
    vatIncluded:
      typeof parsed.vatIncluded === "boolean" ? parsed.vatIncluded : true,
    source: "ai",
  };
}

const EXTRACT_PROMPT = [
  "זהה מתוך החשבונית/הקבלה בעברית או אנגלית את הפרטים הבאים.",
  "החזר JSON בלבד במבנה:",
  '{"vendor":"שם הספק","amount":1234.56,"title":"תיאור קצר","paidAt":"YYYY-MM-DD","vatIncluded":true}',
  "amount = סכום לתשלום כולל מע״מ אם מופיע, אחרת הסכום הסופי הגדול ביותר.",
  "vendor = שם העסק/הספק שמוציא את החשבונית (לא הלקוח).",
  "אם שדה לא ברור — null.",
].join("\n");

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timeout after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extractFromImage(input: {
  key: string;
  fileName: string;
  mime: string;
  bytes: Buffer;
  signal: AbortSignal;
}): Promise<InvoiceExtractResult | null> {
  const dataUrl = `data:${input.mime || "image/jpeg"};base64,${input.bytes.toString("base64")}`;
  const res = await fetch(CHAT_URL, {
    method: "POST",
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${input.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 220,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Extract invoice fields. JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACT_PROMPT },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const parsed = parseJsonObject(json.choices?.[0]?.message?.content ?? "");
  return parsed ? mapParsed(parsed) : null;
}

async function extractFromPdf(input: {
  key: string;
  fileName: string;
  bytes: Buffer;
  signal: AbortSignal;
}): Promise<InvoiceExtractResult | null> {
  const form = new FormData();
  form.set("purpose", "user_data");
  form.set(
    "file",
    new Blob([new Uint8Array(input.bytes)], { type: "application/pdf" }),
    input.fileName || "invoice.pdf",
  );

  const uploadRes = await fetch(FILES_URL, {
    method: "POST",
    signal: input.signal,
    headers: { Authorization: `Bearer ${input.key}` },
    body: form,
  });
  if (!uploadRes.ok) return null;
  const uploaded = (await uploadRes.json()) as { id?: string };
  const fileId = uploaded.id;
  if (!fileId) return null;

  try {
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      signal: input.signal,
      headers: {
        Authorization: `Bearer ${input.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        max_output_tokens: 220,
        text: { format: { type: "json_object" } },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: EXTRACT_PROMPT },
              { type: "input_file", file_id: fileId },
            ],
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    let text = json.output_text ?? "";
    if (!text && Array.isArray(json.output)) {
      for (const item of json.output) {
        for (const part of item.content ?? []) {
          if (part.type === "output_text" && part.text) {
            text += part.text;
          }
        }
      }
    }
    const parsed = parseJsonObject(text);
    return parsed ? mapParsed(parsed) : null;
  } finally {
    void fetch(`${FILES_URL}/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${input.key}` },
    }).catch(() => undefined);
  }
}

async function extractWithOpenAi(input: {
  fileName: string;
  mime: string;
  bytes: Buffer;
}): Promise<InvoiceExtractResult | null> {
  const key = getApiKey();
  if (!key) return null;
  if (input.bytes.length > MAX_AI_BYTES) return null;

  const isImage = input.mime.startsWith("image/");
  const isPdf =
    input.mime === "application/pdf" ||
    input.fileName.toLowerCase().endsWith(".pdf");
  if (!isImage && !isPdf) return null;

  const controller = new AbortController();
  const work = isPdf
    ? extractFromPdf({
        key,
        fileName: input.fileName,
        bytes: input.bytes,
        signal: controller.signal,
      })
    : extractFromImage({
        key,
        fileName: input.fileName,
        mime: input.mime,
        bytes: input.bytes,
        signal: controller.signal,
      });

  try {
    return await withTimeout(work, EXTRACT_TIMEOUT_MS, "invoice-extract");
  } catch {
    controller.abort();
    return null;
  }
}

export async function extractInvoiceFields(input: {
  fileName: string;
  mime: string;
  bytes: Buffer;
}): Promise<InvoiceExtractResult> {
  const fallback = fromFilename(input.fileName);
  try {
    const ai = await extractWithOpenAi(input);
    if (ai && (ai.vendor || ai.amount != null)) {
      return {
        vendor: ai.vendor || fallback.vendor,
        amount: ai.amount ?? fallback.amount,
        title: ai.title || ai.vendor || fallback.title,
        paidAt: ai.paidAt,
        vatIncluded: ai.vatIncluded ?? true,
        source: "ai",
      };
    }
  } catch {
    /* fall through */
  }
  return fallback;
}
