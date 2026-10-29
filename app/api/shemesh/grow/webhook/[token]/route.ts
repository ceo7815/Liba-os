import { NextResponse } from "next/server";
import { approveGrowFromWebhook } from "@/lib/shemesh/connector-store";

export const dynamic = "force-dynamic";

async function fieldsFrom(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string" || typeof value === "number") flat[key] = String(value);
      if (value && typeof value === "object") {
        for (const [inner, innerValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof innerValue === "string" || typeof innerValue === "number") flat[inner] = String(innerValue);
        }
      }
    }
    return flat;
  }
  const form = await request.formData().catch(() => null);
  const flat: Record<string, string> = {};
  form?.forEach((value, key) => {
    if (typeof value === "string") flat[key.replace(/^data\[|\]$/g, "")] = value;
  });
  return flat;
}

async function handle(token: string, request: Request) {
  const fields = await fieldsFrom(request);
  const result = await approveGrowFromWebhook(token, fields);
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}

export async function POST(request: Request, context: { params: { token: string } }) {
  return handle(context.params.token, request);
}

export async function GET(_request: Request, context: { params: { token: string } }) {
  const result = await approveGrowFromWebhook(context.params.token, {});
  return NextResponse.json({ ok: result.status !== 404 }, { status: result.status === 404 ? 404 : 200 });
}
