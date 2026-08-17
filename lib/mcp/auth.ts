import { createAdminClient } from "@/lib/supabase/admin";
import { hashAgentApiKey } from "@/lib/agents/api-key";

export type AuthenticatedAgent = {
  agentId: string;
  agentSlug: string;
  agentName: string;
  agentStatus: string;
  keyId: string;
};

export async function authenticateAgentBearer(
  authorizationHeader: string | null,
): Promise<AuthenticatedAgent | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = authorizationHeader.slice("Bearer ".length).trim();
  if (!rawKey) return null;

  const keyHash = hashAgentApiKey(rawKey);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("agent_api_keys")
    .select(
      "id, revoked_at, agent:agents!inner(id, slug, name, status)",
    )
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const agent = Array.isArray(data.agent) ? data.agent[0] : data.agent;
  if (!agent || agent.status === "archived") return null;

  return {
    agentId: agent.id,
    agentSlug: agent.slug,
    agentName: agent.name,
    agentStatus: agent.status,
    keyId: data.id,
  };
}
