import type { SupabaseClient } from "@supabase/supabase-js";

async function countRows(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * A pending call can be worked only when it already has audio or a transcript.
 * Empty pending rows (CDR registered, nothing to analyze) must not open a run.
 */
export async function hasProcessablePendingCalls(
  admin: SupabaseClient,
): Promise<boolean> {
  const withAudio = await countRows(
    admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .not("audio_path", "is", null)
      .neq("audio_path", ""),
  );
  if (withAudio > 0) return true;

  const withTranscript = await countRows(
    admin
      .from("call_transcripts")
      .select("id, calls!inner(status)", { count: "exact", head: true })
      .eq("calls.status", "pending")
      .not("full_text", "is", null)
      .neq("full_text", ""),
  );
  return withTranscript > 0;
}
