/**
 * MCP bearer-key auth. Phase 1: static keys in env, each mapped to an org.
 * SYNTHEX_MCP_KEYS = {"<key>": {"organizationId": "...", "userId": "...", "label": "..."}}
 */
export interface McpCaller {
  organizationId: string;
  userId: string;
  label: string;
}

export function resolveOrgFromBearer(
  authHeader: string | null
): McpCaller | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const key = authHeader.slice('Bearer '.length);
  try {
    const keys = JSON.parse(process.env.SYNTHEX_MCP_KEYS ?? '{}') as Record<
      string,
      McpCaller
    >;
    return keys[key] ?? null;
  } catch {
    return null;
  }
}
