/**
 * P4 machine principal — lib/auth/agent-principal.ts.
 *
 * SEAM: resolveAgentPrincipal(request, routeId) and routeIdFor(method, path),
 * the one path REST and MCP share to turn `Authorization: Bearer smk_…` into
 * a principal. Catches: revoked/expired/unknown keys, scope escalation, the
 * '*' wildcard, a route outside the allow-list, an organisation taken from
 * the request, a fail-open organisation check, a missing rate bucket, and an
 * allow-listed pattern that would capture a different route file. Misses:
 * what a route does after the principal is resolved (JEV J1/J11 cover that).
 *
 * Boundary mocked: @/lib/prisma (an in-memory key/user/org table). Our own
 * modules are real.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createMockNextRequest } from '../../helpers/mock-request';
import { listRoutes } from '../../eval/jev/runner/route-harness';

type Row = Record<string, unknown>;
const db: {
  keys: Row[];
  users: Row[];
  orgs: Row[];
  down: Set<'key' | 'user' | 'org'>;
} = { keys: [], users: [], orgs: [], down: new Set() };

function boundary(table: 'key' | 'user' | 'org', rows: () => Row[]) {
  return {
    findUnique: async ({ where }: { where: Row }) => {
      if (db.down.has(table)) throw new Error('db down');
      const [k, v] = Object.entries(where)[0];
      return rows().find(r => r[k] === v) ?? null;
    },
    update: async () => ({}),
  };
}

jest.mock('@/lib/prisma', () => {
  const client = {
    mcpApiKey: boundary('key', () => db.keys),
    user: boundary('user', () => db.users),
    organization: boundary('org', () => db.orgs),
  };
  return { __esModule: true, prisma: client, default: client };
});

import {
  resolveAgentPrincipal,
  routeIdFor,
  ROUTE_SCOPES,
  NON_MACHINE_ROUTES,
} from '@/lib/auth/agent-principal';
import { resolveOrgFromBearer } from '@/app/api/mcp/auth';
import { __resetRateLimitBackendForTests } from '@/lib/auth/rate-limit';

const ROUTE = 'PATCH /api/content/[id]';
const RAW = 'smk_unit_org_a_content';
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function key(raw: string, overrides: Row = {}): void {
  db.keys.push({
    id: `key-${raw}`,
    keyHash: sha(raw),
    organizationId: 'org-A',
    userId: 'user-A',
    label: 'unit',
    scopes: ['content'],
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  });
}

function req(authorization?: string, extra: Record<string, string> = {}) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost:3000/api/content/aaaaaaaa-0001?organizationId=org-B',
    headers: { ...(authorization ? { authorization } : {}), ...extra },
  }) as never;
}

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.REDIS_URL;
  __resetRateLimitBackendForTests();
  db.keys = [];
  db.down = new Set();
  db.users = [
    { id: 'user-A', organizationId: 'org-A', role: 'user' },
    { id: 'user-B', organizationId: 'org-B', role: 'user' },
  ];
  db.orgs = [
    { id: 'org-A', status: 'active' },
    { id: 'org-B', status: 'active' },
  ];
  key(RAW);
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('resolveAgentPrincipal', () => {
  it('no Authorization header -> none (caller falls back to the user path)', async () => {
    expect(await resolveAgentPrincipal(req(), ROUTE)).toEqual({ kind: 'none' });
  });

  it('a user JWT bearer -> none', async () => {
    expect(
      await resolveAgentPrincipal(req('Bearer aaa.bbb.ccc'), ROUTE)
    ).toEqual({ kind: 'none' });
  });

  it('a scoped key of org A on an allowed route -> ok, organisation from the key row', async () => {
    const r = await resolveAgentPrincipal(
      req(`Bearer ${RAW}`, { 'x-organization-id': 'org-B' }),
      ROUTE
    );
    expect(r).toEqual({
      kind: 'granted',
      organizationId: 'org-A',
      userId: 'user-A',
      keyId: `key-${RAW}`,
      scopes: ['content'],
    });
  });

  it('unknown key -> 401', async () => {
    expect(
      await resolveAgentPrincipal(req('Bearer smk_not_registered'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 401 });
  });

  it('revoked key -> 401', async () => {
    key('smk_revoked', { revokedAt: new Date('2026-01-01T00:00:00Z') });
    expect(
      await resolveAgentPrincipal(req('Bearer smk_revoked'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 401, code: 'KEY_REVOKED' });
  });

  it('expired key -> 401', async () => {
    key('smk_expired', { expiresAt: new Date(Date.now() - 1000) });
    expect(
      await resolveAgentPrincipal(req('Bearer smk_expired'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 401, code: 'KEY_EXPIRED' });
  });

  it('key without the route scope -> 403', async () => {
    key('smk_team_only', { scopes: ['team'] });
    expect(
      await resolveAgentPrincipal(req('Bearer smk_team_only'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 403, code: 'SCOPE_DENIED' });
  });

  it("key minted with '*' -> 403 (the wildcard is never honoured)", async () => {
    key('smk_wildcard', { scopes: ['*'] });
    expect(
      await resolveAgentPrincipal(req('Bearer smk_wildcard'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 403 });
  });

  it('route outside the allow-list -> 403 even with every named scope', async () => {
    key('smk_all_named', { scopes: Object.keys(ROUTE_SCOPES) });
    expect(
      await resolveAgentPrincipal(
        req('Bearer smk_all_named'),
        'POST /api/stripe/change-plan'
      )
    ).toMatchObject({ kind: 'denied', status: 403, code: 'ROUTE_NOT_ALLOWED' });
  });

  it('cross-org: key row says org A but its user now belongs to org B -> 403', async () => {
    key('smk_moved_user', { userId: 'user-B' });
    expect(
      await resolveAgentPrincipal(req('Bearer smk_moved_user'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 403, code: 'KEY_ORG_MISMATCH' });
  });

  it('suspended organisation -> 403', async () => {
    db.orgs[0].status = 'suspended';
    expect(
      await resolveAgentPrincipal(req(`Bearer ${RAW}`), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 403 });
  });

  it('organisation check DB down -> deny (fail closed)', async () => {
    db.down.add('org');
    expect(
      await resolveAgentPrincipal(req(`Bearer ${RAW}`), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 403 });
  });

  it('key lookup DB down -> deny (fail closed)', async () => {
    db.down.add('key');
    expect(
      await resolveAgentPrincipal(req(`Bearer ${RAW}`), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 401 });
  });

  it('per-key rate bucket: the call past the limit -> 429', async () => {
    let last: unknown;
    for (let i = 0; i < 121; i++)
      last = await resolveAgentPrincipal(req(`Bearer ${RAW}`), ROUTE);
    expect(last).toMatchObject({ kind: 'denied', status: 429 });
  });

  it('a planted SYNTHEX_MCP_LEGACY_KEYS entry is ignored on REST and MCP', async () => {
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      smk_planted_legacy: { organizationId: 'org-A', userId: 'user-A' },
      'legacy-key': { organizationId: 'org-A', userId: 'user-A' },
    });
    expect(
      await resolveAgentPrincipal(req('Bearer smk_planted_legacy'), ROUTE)
    ).toMatchObject({ kind: 'denied', status: 401 });
    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
    expect(await resolveOrgFromBearer('Bearer smk_planted_legacy')).toBeNull();
  });

  it('MCP shares the lookup and fails closed when the org check errors', async () => {
    db.down.add('org');
    expect(await resolveOrgFromBearer(`Bearer ${RAW}`)).toBeNull();
  });
});

describe('routeIdFor', () => {
  it('maps a concrete path to its allow-listed pattern', () => {
    expect(routeIdFor('PATCH', '/api/content/aaaaaaaa-0001')).toBe(ROUTE);
    expect(routeIdFor('PATCH', '/api/teams/members/m1/role')).toBe(
      'PATCH /api/teams/members/[memberId]/role'
    );
  });

  it('returns null for a path no allow-listed pattern names', () => {
    expect(routeIdFor('GET', '/api/content/aaaaaaaa-0001')).toBeNull();
    expect(routeIdFor('PATCH', '/api/content/a/b')).toBeNull();
  });

  it('no allow-listed pattern captures a different route file', () => {
    // Next routes by path first; a captured static route that does not export
    // the method answers 405 itself, so only same-method captures matter.
    const allowed = new Set(Object.values(ROUTE_SCOPES).flat());
    const captured: string[] = [];
    for (const r of listRoutes()) {
      const concrete = r.route.replace(/\[[^\]]+\]/g, 'probe-id');
      for (const method of r.methods) {
        const id = routeIdFor(method, concrete);
        if (id && id !== `${method} ${r.route}`)
          captured.push(`${method} ${r.route} -> ${id}`);
      }
    }
    expect(captured).toEqual([]);
    const root = path.join(__dirname, '../../..');
    for (const id of allowed) {
      const p = id.split(' ')[1];
      expect(fs.existsSync(path.join(root, 'app', p, 'route.ts'))).toBe(true);
    }
  });

  it('a route is either scoped or explicitly non-machine, never both', () => {
    const allowed = new Set(Object.values(ROUTE_SCOPES).flat());
    expect(NON_MACHINE_ROUTES.filter(r => allowed.has(r))).toEqual([]);
  });
});
