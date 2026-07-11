/**
 * SYN-MCP-004-1 (SYN-1080) — POST/GET/DELETE /api/admin/mcp-keys.
 *
 * Admin-gated key mint (raw key shown once, only the sha-256 hash persisted),
 * metadata-only listing (hash never exposed) and soft revocation.
 */
import { createHash } from 'crypto';

// --- Mocks ---------------------------------------------------------------
const mockVerifyAdmin = jest.fn();
const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockOrgFindUnique = jest.fn();

jest.mock('@/lib/admin/verify-admin', () => ({
  verifyAdmin: (...a: unknown[]) => mockVerifyAdmin(...a),
}));

const prismaMock = {
  mcpApiKey: {
    create: (...a: unknown[]) => mockCreate(...a),
    findMany: (...a: unknown[]) => mockFindMany(...a),
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
  },
  organization: {
    findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST, GET, DELETE } from '@/app/api/admin/mcp-keys/route';

function makeRequest(opts: { url?: string; body?: unknown } = {}): any {
  return {
    url: opts.url ?? 'http://localhost/api/admin/mcp-keys',
    headers: { get: () => null },
    cookies: { get: () => undefined },
    json: async () => opts.body,
  };
}

const validBody = {
  organizationId: 'org-1',
  userId: 'user-1',
  label: 'unite-hub',
  scopes: ['generate_video'],
};

beforeEach(() => {
  mockVerifyAdmin.mockResolvedValue({ isAdmin: true, userId: 'admin-1' });
  mockCreate.mockImplementation(async ({ data }: any) => ({
    id: 'key-1',
    organizationId: data.organizationId,
    userId: data.userId,
    label: data.label,
    scopes: data.scopes,
    expiresAt: data.expiresAt,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date('2026-07-10T00:00:00Z'),
  }));
  mockFindMany.mockResolvedValue([]);
  mockFindUnique.mockResolvedValue(null);
  mockUpdate.mockResolvedValue({ id: 'key-1', revokedAt: new Date() });
  // Scope-tier default (Track B S3'): org-1 is a ROOT (brand) org.
  mockOrgFindUnique.mockResolvedValue({ parentOrgId: null });
});

describe('admin gate (all verbs)', () => {
  it.each([
    ['POST', () => POST(makeRequest({ body: validBody }))],
    ['GET', () => GET(makeRequest())],
    [
      'DELETE',
      () =>
        DELETE(
          makeRequest({ url: 'http://localhost/api/admin/mcp-keys?id=k' })
        ),
    ],
  ])('%s returns 401 when unauthenticated', async (_verb, call) => {
    mockVerifyAdmin.mockResolvedValue({
      isAdmin: false,
      error: 'Authentication required',
    });
    const res = await call();
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin user', async () => {
    mockVerifyAdmin.mockResolvedValue({
      isAdmin: false,
      error: 'Admin access required',
    });
    const res = await POST(makeRequest({ body: validBody }));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/mcp-keys — mint', () => {
  it('creates a key, persists only the sha-256 hash, returns the raw key once', async () => {
    const res = await POST(makeRequest({ body: validBody }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.key).toMatch(/^smk_[0-9a-f]{64}$/);
    expect(json.note).toContain('shown once');
    expect(json.record.id).toBe('key-1');
    // The raw key must never be persisted — only its hash.
    const created = mockCreate.mock.calls[0][0].data;
    expect(created.keyHash).toBe(
      createHash('sha256').update(json.key, 'utf8').digest('hex')
    );
    expect(JSON.stringify(created)).not.toContain(json.key);
    // The response record must not leak the hash.
    expect(json.record.keyHash).toBeUndefined();
  });

  it('passes scopes and expiresAt through to the record', async () => {
    const expiresAt = '2027-01-01T00:00:00Z';
    const res = await POST(makeRequest({ body: { ...validBody, expiresAt } }));
    expect(res.status).toBe(201);
    const created = mockCreate.mock.calls[0][0].data;
    expect(created.scopes).toEqual(['generate_video']);
    expect(created.expiresAt).toEqual(new Date(expiresAt));
  });

  it('defaults scopes to [] when omitted', async () => {
    const { scopes: _omit, ...noScopes } = validBody;
    const res = await POST(makeRequest({ body: noScopes }));
    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data.scopes).toEqual([]);
  });

  it('rejects an invalid body with 400 (zod)', async () => {
    const res = await POST(makeRequest({ body: { label: 'no-org' } }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON body with 400', async () => {
    const req = makeRequest();
    req.json = async () => {
      throw new Error('bad json');
    };
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('mints unique keys per call', async () => {
    const first = await (await POST(makeRequest({ body: validBody }))).json();
    const second = await (await POST(makeRequest({ body: validBody }))).json();
    expect(first.key).not.toBe(second.key);
  });
});

describe('GET /api/admin/mcp-keys — list', () => {
  it('lists key metadata without hashes', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'key-1',
        organizationId: 'org-1',
        userId: 'user-1',
        label: 'unite-hub',
        scopes: ['*'],
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date('2026-07-10T00:00:00Z'),
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keys).toHaveLength(1);
    expect(json.keys[0].keyHash).toBeUndefined();
    // Select must exclude keyHash at the query layer too.
    const select = mockFindMany.mock.calls[0][0].select;
    expect(select.keyHash).toBeUndefined();
  });

  it('filters by organizationId query param', async () => {
    await GET(
      makeRequest({
        url: 'http://localhost/api/admin/mcp-keys?organizationId=org-9',
      })
    );
    expect(mockFindMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-9',
    });
  });
});

describe('DELETE /api/admin/mcp-keys — revoke', () => {
  it('400s without an id', async () => {
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(400);
  });

  it('404s for an unknown id', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await DELETE(
      makeRequest({ url: 'http://localhost/api/admin/mcp-keys?id=nope' })
    );
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('soft-revokes by setting revokedAt', async () => {
    mockFindUnique.mockResolvedValue({ id: 'key-1', revokedAt: null });
    const res = await DELETE(
      makeRequest({ url: 'http://localhost/api/admin/mcp-keys?id=key-1' })
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: { revokedAt: expect.any(Date) },
      })
    );
  });

  it('is idempotent for an already-revoked key', async () => {
    const revokedAt = new Date('2026-07-01T00:00:00Z');
    mockFindUnique.mockResolvedValue({ id: 'key-1', revokedAt });
    const res = await DELETE(
      makeRequest({ url: 'http://localhost/api/admin/mcp-keys?id=key-1' })
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// -- Track B S3' -- mint-time scope-tier allow-list (criterion 14) -----------

describe('POST /api/admin/mcp-keys — scope-tier allow-list (Track B)', () => {
  it("rejects minting the wildcard '*' scope for ANY org (v1 global ban)", async () => {
    const res = await POST(
      makeRequest({ body: { ...validBody, scopes: ['*'] } })
    );
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects minting the 'provisioning' scope for ANY org (v1 global ban)", async () => {
    const res = await POST(
      makeRequest({
        body: { ...validBody, scopes: ['creative', 'provisioning'] },
      })
    );
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('CHILD orgs can only be granted read/draft-tier scopes — tasks rejected', async () => {
    mockOrgFindUnique.mockResolvedValue({ parentOrgId: 'org-brand-1' });
    const res = await POST(
      makeRequest({ body: { ...validBody, scopes: ['creative', 'tasks'] } })
    );
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('CHILD orgs can be granted read/draft-tier scopes', async () => {
    mockOrgFindUnique.mockResolvedValue({ parentOrgId: 'org-brand-1' });
    const res = await POST(
      makeRequest({
        body: { ...validBody, scopes: ['creative', 'context', 'performance'] },
      })
    );
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });

  it('ROOT (brand) orgs keep full named-scope minting — first-party products stay accessible', async () => {
    // e.g. CARSI / Unite-Hub pulling Synthex to design & create: root orgs can
    // hold every named namespace (creative, context, tasks, ...) — only the
    // wildcard and provisioning scopes are unmintable in v1.
    const res = await POST(
      makeRequest({
        body: {
          ...validBody,
          scopes: [
            'creative',
            'context',
            'approvals',
            'performance',
            'research',
            'tasks',
          ],
        },
      })
    );
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });

  it('rejects minting for an unknown organization (fail closed)', async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ body: { ...validBody, scopes: ['creative'] } })
    );
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/mcp-keys — suspended-org mint refusal (spec §12)', () => {
  it('rejects minting a key for a SUSPENDED org', async () => {
    mockOrgFindUnique.mockResolvedValue({
      parentOrgId: 'org-brand-1',
      status: 'suspended',
    });
    const res = await POST(
      makeRequest({ body: { ...validBody, scopes: ['creative'] } })
    );
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects minting a key for a DELETED org', async () => {
    mockOrgFindUnique.mockResolvedValue({
      parentOrgId: null,
      status: 'deleted',
    });
    const res = await POST(makeRequest({ body: validBody }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
