import fs from "node:fs/promises";
import path from "node:path";
import { FORMAT_DIMENSIONS } from "@/lib/social-media/constants";
import type { SocialFormat } from "@/lib/social-media/types";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
const DEFAULT_MODEL = "gpt-image-2";
const FALLBACK_MODEL = "gpt-image-1";
const PER_IMAGE_TIMEOUT_MS = 90_000;

export type GeneratedImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("חסר OPENAI_API_KEY — הוסיפו למשתני הסביבה לג׳נרוט תמונה");
  }
  return key;
}

function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
}

async function readOfficialLogoBuffer(): Promise<Buffer> {
  // Official mark only — never fall back to other public logos.
  const logoPath = path.join(process.cwd(), "public", "brand", "liba-logo.png");
  try {
    return await fs.readFile(logoPath);
  } catch {
    throw new Error("חסר לוגו רשמי: public/brand/liba-logo.png");
  }
}

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  error?: { message?: string; code?: string };
};

function abortSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function bufferFromResponse(json: OpenAiImageResponse): Promise<Buffer> {
  const item = json.data?.[0];
  if (item?.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item?.url) {
    const imgRes = await fetch(item.url, { signal: abortSignal(30_000) });
    if (!imgRes.ok) {
      throw new Error(`הורדת התמונה מ-OpenAI נכשלה (${imgRes.status})`);
    }
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error("OpenAI לא החזיר תמונה");
}

async function requestGeneration(
  prompt: string,
  size: "1024x1024" | "1024x1536",
  model: string,
): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality: "medium",
        n: 1,
      }),
      signal: abortSignal(PER_IMAGE_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new Error("OpenAI לא ענה תוך 90 שניות — נסו שוב");
    }
    throw new Error(
      err instanceof Error ? `חיבור ל-OpenAI נכשל: ${err.message}` : "חיבור ל-OpenAI נכשל",
    );
  }

  const raw = await res.text();
  let json: OpenAiImageResponse;
  try {
    json = JSON.parse(raw) as OpenAiImageResponse;
  } catch {
    throw new Error(`OpenAI החזיר תשובה לא תקינה (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(json.error?.message ?? `OpenAI image error (${res.status})`);
  }

  return bufferFromResponse(json);
}

async function requestEdit(
  prompt: string,
  size: "1024x1024" | "1024x1536",
  model: string,
  image: Buffer,
): Promise<Buffer> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", "medium");
  form.append("n", "1");
  form.append(
    "image",
    new Blob([new Uint8Array(image)], { type: "image/png" }),
    "liba-logo.png",
  );

  let res: Response;
  try {
    res = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${getApiKey()}` },
      body: form,
      signal: abortSignal(PER_IMAGE_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new Error("OpenAI לא ענה תוך 90 שניות — נסו שוב");
    }
    throw new Error(
      err instanceof Error ? `חיבור ל-OpenAI נכשל: ${err.message}` : "חיבור ל-OpenAI נכשל",
    );
  }

  const raw = await res.text();
  let json: OpenAiImageResponse;
  try {
    json = JSON.parse(raw) as OpenAiImageResponse;
  } catch {
    throw new Error(`OpenAI החזיר תשובה לא תקינה (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(json.error?.message ?? `OpenAI image error (${res.status})`);
  }
  return bufferFromResponse(json);
}

async function requestWithFallback(
  prompt: string,
  size: "1024x1024" | "1024x1536",
  logo: Buffer,
): Promise<Buffer> {
  const primary = imageModel();
  try {
    return await requestEdit(prompt, size, primary, logo);
  } catch {
    /* generate still gets the written logo+language rules */
  }
  try {
    return await requestGeneration(prompt, size, primary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const modelMissing =
      /model/i.test(message) &&
      (/not found|invalid|does not exist|unsupported/i.test(message) ||
        primary !== FALLBACK_MODEL);
    if (!modelMissing || primary === FALLBACK_MODEL) throw err;
    return requestGeneration(prompt, size, FALLBACK_MODEL);
  }
}

/** Estimated cost per medium image (USD). */
export const OPENAI_IMAGE_ESTIMATED_COST_USD = 0.04;

export async function generateSocialImages(input: {
  prompt: string;
  referenceBuffer?: Buffer | null;
  formats?: SocialFormat[];
}): Promise<Partial<Record<"feed" | "story", GeneratedImage>>> {
  const logo = await readOfficialLogoBuffer();
  const wanted = (input.formats ?? ["feed"]).filter(
    (f): f is "feed" | "story" => f === "feed" || f === "story",
  );
  const formats = wanted.length ? wanted : (["feed"] as const);

  const styleHint = input.referenceBuffer
    ? "\n\nA user reference photo was provided for mood/composition only — keep Liba design language (daylight, cream, human, navy+coral accent). Do not copy foreign logos. Official Liba mark remains the attached PNG only, small in a corner."
    : "";
  const enrichedPrompt = `${input.prompt}${styleHint}`;

  const out: Partial<Record<"feed" | "story", GeneratedImage>> = {};

  // Sequential — two parallel gpt-image calls routinely abort Next server actions.
  if (formats.includes("feed")) {
    const feedBuf = await requestWithFallback(enrichedPrompt, "1024x1024", logo);
    out.feed = {
      buffer: feedBuf,
      mimeType: "image/png",
      width: FORMAT_DIMENSIONS.feed.width,
      height: FORMAT_DIMENSIONS.feed.height,
    };
  }

  if (formats.includes("story")) {
    const storyBuf = await requestWithFallback(
      `${enrichedPrompt}\n\nVertical story format, mobile-first composition, same design language. Logo stays a small flat 2D corner mark.`,
      "1024x1536",
      logo,
    );
    out.story = {
      buffer: storyBuf,
      mimeType: "image/png",
      width: FORMAT_DIMENSIONS.story.width,
      height: FORMAT_DIMENSIONS.story.height,
    };
  }

  return out;
}
