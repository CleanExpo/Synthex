/**
 * SYN-MCP-004-1 (SYN-1080) — scoped MCP key registry, E2E against the
 * SYN-MCP-000 Docker sandbox (real Postgres :5499, real mcp_api_keys table
 * materialised by global-setup's `prisma db push`).
 *
 * Full DB-backed key lifecycle through the REAL production modules:
 *   mint (POST /api/admin/mcp-keys handler, admin-gated)
 *     -> authenticate (resolveOrgFromBearer: sha-256 lookup + lastUsedAt stamp)
 *     -> revoke (DELETE handler, soft delete)
 *     -> rejected (revoked / expired / unknown).
 *
 * The ONLY substitution is the Prisma client wiring: lib/prisma.ts is
 * Supabase-tuned (SCRAM patch + forced SSL) which the local sandbox Postgres
 * rejects, so '@/lib/prisma' is mapped to the sandbox client
 * (tests/integration/setup/seed.ts) — same Prisma API, real database. The
 * HTTP/JSON-RPC transport (mcp-handler) is not exercised here; it needs a
 * running Next server and is covered by the prod smoke in
 * docs/agent-contract-v1.md.
 */
import { createHash } from 'crypto';

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

import prisma from '@/lib/prisma';
import { resolveOrgFromBearer, hashMcpKey } from '@/app/api/mcp/auth';
import { POST, DELETE } from '@/app/api/admin/mcp-keys/route';
import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';

const ADMIN_KEY = 'itest-admin-api-key';

function adminRequest(opts: { url?: string; body?: unknown } = {}): any {
  return {
    url: opts.url ?? 'http://localhost/api/admin/mcp-keys',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'x-admin-api-key' ? ADMIN_KEY : null,
    },
    cookies: { get: () => undefined },
    json: async () => opts.body,
  };
}

describe('MCP key registry — sandbox E2E (SYN-MCP-004-1)', () => {
  // Belt-and-braces: global-setup already enforced this, but assert again in
  // the worker process so a mis-wired config can never touch a real DB.
  assertSandboxDatabaseUrl(process.env.DATABASE_URL);

  beforeAll(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.SYNTHEX_MCP_KEYS;
    delete process.env.SYNTHEX_MCP_LEGACY_KEYS;
  });

  afterAll(async () => {
    await prisma.mcpApiKey.deleteMany({
      where: { organizationId: 'itest-org' },
    });
    await prisma.$disconnect();
  });

  it('mint -> authenticate -> revoke -> rejected (full lifecycle)', async () => {
    // 1. Mint via the admin route (real handler, real DB write).
    const createRes = await POST(
      adminRequest({
        body: {
          organizationId: 'itest-org',
          userId: 'itest-user',
          label: 'itest-lifecycle',
          scopes: ['generate_video', 'get_job'],
        },
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.key).toMatch(/^smk_[0-9a-f]{64}$/);

    // 2. Only the sha-256 hash is at rest — never the raw key.
    const row = await prisma.mcpApiKey.findUnique({
      where: { id: created.record.id },
    });
    expect(row?.keyHash).toBe(
      createHash('sha256').update(created.key, 'utf8').digest('hex')
    );
    expect(row?.keyHash).toBe(hashMcpKey(created.key));

    // 3. Authenticate through the real auth module against the real table.
    const caller = await resolveOrgFromBearer(`Bearer ${created.key}`);
    expect(caller).toEqual({
      organizationId: 'itest-org',
      userId: 'itest-user',
      label: 'itest-lifecycle',
      scopes: ['generate_video', 'get_job'],
    });

    // 4. lastUsedAt was stamped by the successful auth.
    const stamped = await prisma.mcpApiKey.findUnique({
      where: { id: created.record.id },
      select: { lastUsedAt: true },
    });
    expect(stamped?.lastUsedAt).toBeInstanceOf(Date);

    // 5. Revoke via the admin route; auth must now fail.
    const revokeRes = await DELETE(
      adminRequest({
        url: `http://localhost/api/admin/mcp-keys?id=${created.record.id}`,
      })
    );
    expect(revokeRes.status).toBe(200);
    expect(await resolveOrgFromBearer(`Bearer ${created.key}`)).toBeNull();
  });

  it('rejects an expired DB key', async () => {
    const rawKey = 'smk_itest_expired_key';
    await prisma.mcpApiKey.create({
      data: {
        keyHash: hashMcpKey(rawKey),
        organizationId: 'itest-org',
        userId: 'itest-user',
        label: 'itest-expired',
        scopes: ['*'],
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    expect(await resolveOrgFromBearer(`Bearer ${rawKey}`)).toBeNull();
  });

  it('accepts a future-expiry DB key', async () => {
    const rawKey = 'smk_itest_future_key';
    await prisma.mcpApiKey.create({
      data: {
        keyHash: hashMcpKey(rawKey),
        organizationId: 'itest-org',
        userId: 'itest-user',
        label: 'itest-future',
        scopes: [],
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const caller = await resolveOrgFromBearer(`Bearer ${rawKey}`);
    expect(caller?.organizationId).toBe('itest-org');
    expect(caller?.scopes).toEqual([]);
  });

  it('rejects an unknown bearer with no legacy fallback configured', async () => {
    expect(
      await resolveOrgFromBearer('Bearer smk_itest_never_minted')
    ).toBeNull();
  });

  it('admin gate blocks unauthenticated key minting', async () => {
    delete process.env.ADMIN_API_KEY; // gate must not accept an empty compare
    try {
      const req = adminRequest({
        body: {
          organizationId: 'itest-org',
          userId: 'itest-user',
          label: 'itest-blocked',
        },
      });
      req.headers = { get: () => null };
      const res = await POST(req);
      expect(res.status).toBe(401);
    } finally {
      process.env.ADMIN_API_KEY = ADMIN_KEY;
    }
  });
});
