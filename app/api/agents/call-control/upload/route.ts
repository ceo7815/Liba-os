import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Manual recording upload is closed. Ingest is Voicenter → MCP only. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "העלאת הקלטות נסגרה. בקרת השיחות מקבלת שיחות רק מ-Voicenter דרך /api/mcp.",
    },
    { status: 410 },
  );
}
