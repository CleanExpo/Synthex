/**
 * Machine principal — P4 (spec 2026-10-17 "P4, the machine principal").
 *
 * One path turns `Authorization: Bearer smk_…` into a principal for REST, and
 * the same key lookup serves MCP (app/api/mcp/auth.ts):
 *   - the bearer is sha-256 hashed and looked up in McpApiKey (raw keys are
 *     never stored); revoked and expired keys are rejected;
 *   - the organisation ALWAYS comes from the key row, never the request; the
 *     key's user must still belong to that organisation, so every route that
 *     derives the organisation from the user lands on the key's organisation;
 *   - the organisation status check fails CLOSED (a DB error denies);
 *   - REST: the key's scopes map to a static route allow-list (ROUTE_SCOPES).
 *     Deny by default: a route not named is refused, '*' grants nothing;
 *   - a per-key rate bucket (lib/auth/rate-limit.ts: Upstash when configured,
 *     in-memory otherwise).
 *
 * No table or column is added (D3). The legacy SYNTHEX_MCP_* env-map reader
 * is gone (R16): an env-held key is never consulted.
 */
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';

/** Raw key format minted by POST /api/admin/mcp-keys. */
export const MACHINE_KEY_PREFIX = 'smk_';

/**
 * Route ids are `<METHOD> /api/<pattern>`. The tables below are written
 * relative to the /api mount: they name routes, they do not call them, and a
 * `/api/…` literal in a module public code imports reads as a call (the
 * public-copy tripwire follows it, __tests__/landing/helpers/public-claims.ts).
 */
const API_MOUNT = '/api';
const mountApi = (ids: readonly string[]): string[] =>
  ids.map(id => id.replace(' ', ` ${API_MOUNT}/`));
const underApi = <S extends string>(
  table: Record<S, readonly string[]>
): Record<S, readonly string[]> => {
  const mounted = {} as Record<S, readonly string[]>;
  for (const s of Object.keys(table) as S[]) mounted[s] = mountApi(table[s]);
  return mounted;
};

/**
 * REST scope -> routes it grants, as `<METHOD> <pattern under /api>`. A route
 * listed nowhere is refused to every key. Scope names are independent of the MCP
 * tool scopes (lib/services/ai/studio-tools), which gate tools, not routes.
 */
export const ROUTE_SCOPES = underApi({
  organization: [
    'PATCH organizations/[orgId]',
    'PATCH organizations/[orgId]/brand-os',
    'PATCH organizations/[orgId]/client-profile',
  ],
  approvals: ['POST approvals', 'POST approvals/[id]/comments'],
  content: [
    'PATCH content/[id]',
    'DELETE content/[id]',
    'POST content-drafts',
    'PATCH content-drafts/[id]',
    'DELETE content-drafts/[id]',
    'POST content-library',
    'PATCH content-library/[id]',
    'DELETE content-library/[id]',
  ],
  integrations: [
    'POST integrations',
    'POST integrations/[integrationId]/sync',
    'PUT integrations/third-party/[provider]/config',
  ],
  team: [
    'POST team',
    'POST teams/invite',
    'POST teams/invitations',
    'PATCH teams/invitations/[id]',
    'DELETE teams/invitations/[id]',
    'POST teams/members',
    'PATCH teams/members/[memberId]',
    'DELETE teams/members/[memberId]',
    'PATCH teams/members/[memberId]/role',
    'PATCH teams/[id]/settings',
    'DELETE teams/[id]/settings',
  ],
  billing: [
    'POST invoices',
    'PATCH invoices/[id]',
    'DELETE invoices/[id]',
    'POST invoices/[id]/send',
  ],
});

export type RouteScope = keyof typeof ROUTE_SCOPES;

/**
 * High-risk routes no scope grants, kept here so the decision is explicit:
 * deleting or creating an organisation, deciding an approval (a human act),
 * minting more keys, spending (Stripe), offboarding a client, and publishing
 * (P7 delegated publish owns that).
 */
export const NON_MACHINE_ROUTES: readonly string[] = mountApi([
  'POST organizations',
  'DELETE organizations/[orgId]',
  'PATCH approvals/[id]',
  'DELETE approvals/[id]',
  'POST user/api-keys',
  'POST stripe/checkout',
  'POST stripe/change-plan',
  'POST command-centre/clients/[id]/offboard',
  'POST publish-queue/release',
  'POST social/post',
  // Static siblings a dynamic pattern above would otherwise capture; named so
  // routeIdFor resolves them to themselves (tests/unit/auth guards new ones).
  'PATCH content/calendar',
  'PATCH content/comments',
  'DELETE content/comments',
  'DELETE content/share',
]);

/** Per-key bucket: 120 calls a minute per key, 600 per source IP. */
const RATE_LIMITS = {
  org: { limit: 120, windowSeconds: 60 },
  ip: { limit: 600, windowSeconds: 60 },
};

export type AgentPrincipal =
  | { kind: 'none' }
  | { kind: 'denied'; status: 401 | 403 | 429; code: string }
  | {
      kind: 'granted';
      organizationId: string;
      userId: string;
      keyId: string;
      scopes: string[];
    };

export interface MachineKey {
  id: string;
  organizationId: string;
  userId: string;
  label: string;
  scopes: string[];
}

export type MachineKeyLookup =
  | { ok: true; key: MachineKey }
  | { ok: false; status: 401 | 403; code: string };

/** sha-256 hex digest of a raw bearer key — the only form ever persisted. */
export function hashMachineKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/** The raw bearer from an Authorization header, or null. */
export function bearerOf(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

/** The raw machine key on a request, or null when none is presented. */
export function machineKeyOf(
  request: Pick<NextRequest, 'headers'>
): string | null {
  const raw = bearerOf(request.headers.get('authorization'));
  return raw?.startsWith(MACHINE_KEY_PREFIX) ? raw : null;
}

const deny = (status: 401 | 403, code: string) =>
  ({ ok: false, status, code }) as const;

/**
 * Shared key lookup for REST and MCP: hash, find, reject revoked/expired,
 * refuse a suspended/deleted/missing organisation. Every DB error denies.
 * A successful hit stamps lastUsedAt best-effort.
 */
export async function lookupMachineKey(
  rawKey: string
): Promise<MachineKeyLookup> {
  let record: {
    id: string;
    organizationId: string;
    userId: string;
    label: string;
    scopes: string[] | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
  } | null;
  try {
    record = await prisma.mcpApiKey.findUnique({
      where: { keyHash: hashMachineKey(rawKey) },
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
  } catch {
    return deny(401, 'KEY_UNVERIFIABLE');
  }
  if (!record) return deny(401, 'KEY_UNKNOWN');
  const now = new Date();
  if (record.revokedAt) return deny(401, 'KEY_REVOKED');
  if (record.expiresAt && record.expiresAt.getTime() <= now.getTime())
    return deny(401, 'KEY_EXPIRED');

  try {
    const org = await prisma.organization.findUnique({
      where: { id: record.organizationId },
      select: { status: true },
    });
    if (!org) return deny(403, 'ORG_NOT_FOUND');
    if (org.status === 'suspended' || org.status === 'deleted')
      return deny(403, 'TENANT_SUSPENDED');
  } catch {
    return deny(403, 'ORG_UNVERIFIABLE');
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
    ok: true,
    key: {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      label: record.label,
      scopes: record.scopes ?? [],
    },
  };
}

/** True when one of the key's named scopes grants routeId. '*' grants nothing. */
export function scopesAllow(
  scopes: readonly string[],
  routeId: string
): boolean {
  return scopes.some(
    s =>
      Object.prototype.hasOwnProperty.call(ROUTE_SCOPES, s) &&
      (ROUTE_SCOPES[s as RouteScope] as readonly string[]).includes(routeId)
  );
}

const ALL_PATTERNS: readonly string[] = [
  ...new Set([...Object.values(ROUTE_SCOPES).flat(), ...NON_MACHINE_ROUTES]),
];

/**
 * Map a concrete request to its `<METHOD> <pattern>` route id, or null when no
 * known pattern matches. Static segments outrank dynamic ones, as in Next.
 */
export function routeIdFor(method: string, pathname: string): string | null {
  const segs = pathname.replace(/\/+$/, '').split('/');
  let best: { id: string; rank: string } | null = null;
  for (const id of ALL_PATTERNS) {
    const [m, pattern] = id.split(' ');
    if (m !== method.toUpperCase()) continue;
    const pat = pattern.split('/');
    if (pat.length !== segs.length) continue;
    let rank = '';
    const matches = pat.every((p, i) => {
      const dynamic = /^\[[^\]]+\]$/.test(p);
      rank += dynamic ? '1' : '0';
      return dynamic ? segs[i].length > 0 : p === segs[i];
    });
    if (matches && (!best || rank < best.rank)) best = { id, rank };
  }
  return best?.id ?? null;
}

/**
 * Resolve the machine principal for a REST call to routeId.
 *   none   — no `Bearer smk_…` key: the caller falls back to the user path;
 *   denied — 401 (bad key), 403 (scope, route, organisation), 429 (rate);
 *   granted — organisation, user and scopes from the key row.
 * `rateLimit: false` skips the bucket for a second resolution of a request
 * whose bucket was already counted (proxy.ts counts; route helpers do not).
 */
export async function resolveAgentPrincipal(
  request: Pick<NextRequest, 'headers'>,
  routeId: string,
  opts: { rateLimit?: boolean } = {}
): Promise<AgentPrincipal> {
  const raw = machineKeyOf(request);
  if (!raw) return { kind: 'none' };

  const found = await lookupMachineKey(raw);
  if (!found.ok)
    return { kind: 'denied', status: found.status, code: found.code };
  const { key } = found;

  if (!ALL_PATTERNS.includes(routeId) || NON_MACHINE_ROUTES.includes(routeId))
    return { kind: 'denied', status: 403, code: 'ROUTE_NOT_ALLOWED' };
  if (!scopesAllow(key.scopes, routeId))
    return { kind: 'denied', status: 403, code: 'SCOPE_DENIED' };

  // The key's user must still sit in the key's organisation (home and active),
  // so routes that derive the organisation from the user cannot drift from it.
  try {
    const user = await prisma.user.findUnique({
      where: { id: key.userId },
      select: {
        organizationId: true,
        activeOrganizationId: true,
        isMultiBusinessOwner: true,
      },
    });
    if (
      !user ||
      user.organizationId !== key.organizationId ||
      (user.isMultiBusinessOwner &&
        user.activeOrganizationId &&
        user.activeOrganizationId !== key.organizationId)
    )
      return { kind: 'denied', status: 403, code: 'KEY_ORG_MISMATCH' };
  } catch {
    return { kind: 'denied', status: 403, code: 'ORG_UNVERIFIABLE' };
  }

  if (opts.rateLimit !== false) {
    const rate = await checkRateLimit(null, {
      namespace: 'agent-key',
      orgKey: key.id,
      ipKey: extractClientIp(request as NextRequest),
      limits: RATE_LIMITS,
    });
    if (!rate.ok) return { kind: 'denied', status: 429, code: 'RATE_LIMITED' };
  }

  return {
    kind: 'granted',
    organizationId: key.organizationId,
    userId: key.userId,
    keyId: key.id,
    scopes: key.scopes,
  };
}

/** resolveAgentPrincipal for a request whose route id is read from its URL. */
export async function resolveAgentPrincipalForRequest(
  request: Pick<NextRequest, 'headers' | 'method' | 'url'>,
  opts: { rateLimit?: boolean } = {}
): Promise<AgentPrincipal> {
  const pathname = new URL(request.url).pathname;
  const routeId =
    routeIdFor(request.method, pathname) ?? `${request.method} ${pathname}`;
  return resolveAgentPrincipal(request, routeId, opts);
}
