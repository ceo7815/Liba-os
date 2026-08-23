import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { generateSocialPostImage } from "@/app/actions/social-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return json({ ok: false, error: "נדרשת התחברות" }, 401);
  }

  let postId = "";
  try {
    const body = (await request.json()) as { postId?: unknown };
    postId = typeof body.postId === "string" ? body.postId.trim() : "";
  } catch {
    return json({ ok: false, error: "בקשה לא תקינה" }, 400);
  }

  if (!postId) {
    return json({ ok: false, error: "חסר מזהה פוסט" }, 400);
  }

  try {
    const result = await generateSocialPostImage(postId);
    if (!result.ok) {
      return json(result, 400);
    }
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ג׳נרוט תמונה נכשל";
    return json({ ok: false, error: message }, 500);
  }
}
