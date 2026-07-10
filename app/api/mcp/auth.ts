/**
 * MCP bearer-key auth — SYN-MCP-004-1 (scoped key registry, SYN-1080).
 *
 * Primary path: the presented bearer is sha-256 hashed and looked up in the
 * mcp_api_keys table (McpApiKey model — raw keys are never stored). Revoked
 * (revokedAt set) and expired (expiresAt <= now) keys are rejected outright
 * and never fall through to the legacy map. A successful hit stamps
 * lastUsedAt best-effort (a failed stamp never blocks auth).
 *
 * Legacy fallback (cutover only): when the DB has no row for the hash AND
 * SYNTHEX_MCP_LEGACY_KEYS is set, it is parsed as the phase-1 JSON map
 * { "<raw key>": { organizationId, userId, label } }. Legacy callers get the
 * wildcard scope ['*'] so the existing 7 studio tools keep working
 * (scope-filtered registration lands in SYN-MCP-007 and must treat '*' as
 * all tools). The old SYNTHEX_MCP_KEYS var is intentionally NO LONGER read:
 * keeping plaintext env keys alive is an explicit opt-in via the renamed var.
 */
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';

export interface McpCaller {
  organizationId: string;
  userId: string;
  label: string;
}

/** Auth result: caller identity + the key's tool scopes ('*' = all tools). */
export interface McpAuthResult extends McpCaller {
  scopes: string[];
}

/** Scopes granted to legacy env-map callers — wildcard keeps all 7 tools working. */
export const LEGACY_SCOPES: readonly string[] = ['*'];

/** sha-256 hex digest of a raw bearer key — the only form ever persisted. */
export function hashMcpKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

function resolveLegacyKey(key: string): McpAuthResult | null {
  const raw = process.env.SYNTHEX_MCP_LEGACY_KEYS;
  if (!raw) return null;
  try {
    const keys = JSON.parse(raw) as Record<string, McpCaller>;
    const caller = keys[key];
    if (!caller?.organizationId || !caller?.userId) return null;
    return {
      organizationId: caller.organizationId,
      userId: caller.userId,
      label: caller.label ?? 'legacy',
      scopes: [...LEGACY_SCOPES],
    };
  } catch {
    return null;
  }
}

/**
 * Resolve an Authorization header to an MCP caller (or null = 401).
 * Name kept from phase 1 — it is the recognised auth marker for the MCP
 * route in tests/auth/route-coverage.test.ts.
 */
export async function resolveOrgFromBearer(
  authHeader: string | null
): Promise<McpAuthResult | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const key = authHeader.slice('Bearer '.length).trim();
  if (!key) return null;

  try {
    const record = await prisma.mcpApiKey.findUnique({
      where: { keyHash: hashMcpKey(key) },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        label: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (record) {
      const now = new Date();
      // Revoked/expired DB keys are terminal — no legacy resurrection.
      if (record.revokedAt) return null;
      if (record.expiresAt && record.expiresAt.getTime() <= now.getTime()) {
        return null;
      }
      try {
        await prisma.mcpApiKey.update({
          where: { id: record.id },
          data: { lastUsedAt: now },
        });
      } catch {
        // Best-effort usage stamp — never blocks auth.
      }
      return {
        organizationId: record.organizationId,
        userId: record.userId,
        label: record.label,
        scopes: record.scopes ?? [],
      };
    }
  } catch {
    // DB unavailable — fall through to the legacy env map (cutover safety).
  }

  return resolveLegacyKey(key);
}
