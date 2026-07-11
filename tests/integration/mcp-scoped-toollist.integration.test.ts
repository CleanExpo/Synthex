/**
 * SYN-MCP-007 (SYN-1084) — per-key scoped tools/list contract, E2E against
 * the SYN-MCP-000 Docker sandbox (real Postgres :5499, real mcp_api_keys).
 *
 * Proves scopes round-trip through the REAL production chain:
 *   mint (POST /api/admin/mcp-keys handler, scopes persisted)
 *     -> authenticate (resolveOrgFromBearer: sha-256 lookup, real DB)
 *     -> toolsForScopes (the exact function the MCP route registers from)
 *
 *   wildcard key  -> ALL tools (creative 8 + new namespaces)
 *   scoped key    -> exactly its namespaces, nothing else
 *   zero-scope    -> EMPTY tools/list (DB default scopes [])
 *   revoked key   -> auth null (transport layer returns 401)
 *
 * As with mcp-key-registry.integration.test.ts, the only substitution is the
 * Prisma client wiring ('@/lib/prisma' -> sandbox client); the HTTP/JSON-RPC
 * transport (createMcpHandler) needs a running Next server and is covered by
 * the prod smoke recipe in docs/agent-contract-v2.md §8.
 */
jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { resolveOrgFromBearer, hashMcpKey } from '@/app/api/mcp/auth';
import { POST, DELETE } from '@/app/api/admin/mcp-keys/route';
import { toolsForScopes, ALL_MCP_TOOLS } from '@/lib/services/ai/studio-tools';
import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';

const ADMIN_KEY = 'itest-admin-api-key';
const ORG = 'itest-org-007';

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

async function mintKey(
  scopes?: string[]
): Promise<{ key: string; id: string }> {
  const res = await POST(
    adminRequest({
      body: {
        organizationId: ORG,
        userId: 'itest-user',
        label: `itest-007-${scopes?.join('+') ?? 'default'}`,
        ...(scopes ? { scopes } : {}),
      },
    })
  );
  expect(res.status).toBe(201);
  const body = await res.json();
  return { key: body.key, id: body.record.id };
}

/**
 * Wildcard fixture. The mint route bans '*' in v1 (Track B S3' scope
 * tiering), but wildcard semantics remain fully supported for EXISTING and
 * legacy keys — so wildcard fixtures are written straight to the table,
 * exactly like the pre-registry era keys they represent.
 */
async function createWildcardKey(): Promise<{ key: string; id: string }> {
  const key = `smk_itest_wild_${randomBytes(8).toString('hex')}`;
  const row = await prisma.mcpApiKey.create({
    data: {
      keyHash: hashMcpKey(key),
      organizationId: ORG,
      userId: 'itest-user',
      label: 'itest-007-wildcard-fixture',
      scopes: ['*'],
    },
    select: { id: true },
  });
  return { key, id: row.id };
}

const LEGACY_CREATIVE_NAMES = [
  'derive_cuts',
  'draft_caption',
  'generate_image',
  'generate_video',
  'get_job',
  'list_cards',
  'list_jobs',
  'search_media_library',
];

describe('SYN-MCP-007 — per-key scoped tools/list (sandbox E2E)', () => {
  assertSandboxDatabaseUrl(process.env.DATABASE_URL);

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.SYNTHEX_MCP_KEYS;
    delete process.env.SYNTHEX_MCP_LEGACY_KEYS;
    // The mint route fails closed on unknown orgs (Track B) — the key's
    // tenant must exist.
    await prisma.organization.upsert({
      where: { id: ORG },
      update: { status: 'active' },
      create: {
        id: ORG,
        name: 'Integration Test Org 007',
        slug: ORG,
        plan: 'free',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await prisma.mcpApiKey.deleteMany({ where: { organizationId: ORG } });
    await prisma.organization.deleteMany({ where: { id: ORG } });
    await prisma.$disconnect();
  });

  it('wildcard key sees ALL tools', async () => {
    const { key } = await createWildcardKey();
    const caller = await resolveOrgFromBearer(`Bearer ${key}`);
    expect(caller).not.toBeNull();
    const names = toolsForScopes(caller!.scopes).map(t => t.name);
    expect(names).toHaveLength(ALL_MCP_TOOLS.length);
    for (const legacy of LEGACY_CREATIVE_NAMES) expect(names).toContain(legacy);
    expect(names).toContain('approvals_list_pending');
    expect(names).toContain('performance_cost_report');
  });

  it('scoped key sees exactly its namespaces (subset, no creative)', async () => {
    const { key } = await mintKey(['approvals', 'context']);
    const caller = await resolveOrgFromBearer(`Bearer ${key}`);
    const names = toolsForScopes(caller!.scopes)
      .map(t => t.name)
      .sort();
    expect(names).toEqual([
      'approvals_get',
      'approvals_list_pending',
      'context_get_brand',
      'context_get_client_profile',
      'context_preview_layered_prompt',
    ]);
    for (const legacy of LEGACY_CREATIVE_NAMES)
      expect(names).not.toContain(legacy);
  });

  it('freshly minted key with DEFAULT scopes ([]) sees an EMPTY tools/list', async () => {
    const { key } = await mintKey(); // no scopes field -> registry default []
    const caller = await resolveOrgFromBearer(`Bearer ${key}`);
    expect(caller).not.toBeNull();
    expect(caller!.scopes).toEqual([]);
    expect(toolsForScopes(caller!.scopes)).toEqual([]);
  });

  it('revoked key fails auth entirely (transport would 401 before any registration)', async () => {
    const { key, id } = await createWildcardKey();
    const res = await DELETE(
      adminRequest({ url: `http://localhost/api/admin/mcp-keys?id=${id}` })
    );
    expect(res.status).toBe(200);
    await expect(resolveOrgFromBearer(`Bearer ${key}`)).resolves.toBeNull();
  });
});
