/**
 * MCP bearer-key auth — SYN-MCP-004-1 (scoped key registry, SYN-1080).
 *
 * The presented bearer is sha-256 hashed and looked up in the mcp_api_keys
 * table (McpApiKey model — raw keys are never stored) through the lookup MCP
 * and REST share (lib/auth/agent-principal.ts lookupMachineKey). Revoked and
 * expired keys are rejected; a suspended, deleted or missing organisation is
 * rejected, and so is any DB error (fail closed, P4/K10). A successful hit
 * stamps lastUsedAt best-effort.
 *
 * No environment-held key is read (P4/R16): the cutover env map and its
 * wildcard scope are gone.
 */
import {
  hashMachineKey,
  bearerOf,
  lookupMachineKey,
} from '@/lib/auth/agent-principal';

export interface McpCaller {
  organizationId: string;
  userId: string;
  label: string;
}

/** Auth result: caller identity + the key's tool scopes. */
export interface McpAuthResult extends McpCaller {
  scopes: string[];
}

/** sha-256 hex digest of a raw bearer key — the only form ever persisted. */
export const hashMcpKey = hashMachineKey;

/**
 * Resolve an Authorization header to an MCP caller (or null = 401).
 * Name kept from phase 1 — it is the recognised auth marker for the MCP
 * route in tests/auth/route-coverage.test.ts.
 */
export async function resolveOrgFromBearer(
  authHeader: string | null
): Promise<McpAuthResult | null> {
  const key = bearerOf(authHeader);
  if (!key) return null;
  const found = await lookupMachineKey(key);
  if (!found.ok) return null;
  const { organizationId, userId, label, scopes } = found.key;
  return { organizationId, userId, label, scopes };
}
