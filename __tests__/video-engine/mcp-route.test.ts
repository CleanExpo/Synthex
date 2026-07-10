/**
 * MCP bearer auth — updated for SYN-MCP-004-1 (SYN-1080).
 *
 * resolveOrgFromBearer is now async: primary path is the hashed DB key
 * registry (McpApiKey — covered in tests/unit/mcp/auth.test.ts); the phase-1
 * env map survives only as a cutover fallback behind SYNTHEX_MCP_LEGACY_KEYS
 * (the old SYNTHEX_MCP_KEYS var is no longer read). Legacy callers get the
 * wildcard scope ['*'] so the existing 7 studio tools keep working.
 */
const mockFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    mcpApiKey: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: jest.fn(),
    },
  },
  default: {
    mcpApiKey: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: jest.fn(),
    },
  },
}));

import { resolveOrgFromBearer } from '@/app/api/mcp/auth';

describe('MCP bearer auth (legacy cutover fallback)', () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null); // no DB-registered key
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      'key-abc': {
        organizationId: 'org1',
        userId: 'u-mcp',
        label: 'claude-code',
      },
    });
  });

  afterEach(() => {
    delete process.env.SYNTHEX_MCP_LEGACY_KEYS;
    delete process.env.SYNTHEX_MCP_KEYS;
  });

  it('maps a known legacy bearer key to its org context with wildcard scopes', async () => {
    await expect(resolveOrgFromBearer('Bearer key-abc')).resolves.toEqual({
      organizationId: 'org1',
      userId: 'u-mcp',
      label: 'claude-code',
      scopes: ['*'],
    });
  });

  it('returns null for unknown or missing keys', async () => {
    await expect(resolveOrgFromBearer('Bearer nope')).resolves.toBeNull();
    await expect(resolveOrgFromBearer(null)).resolves.toBeNull();
    // must be Bearer scheme
    await expect(resolveOrgFromBearer('key-abc')).resolves.toBeNull();
  });

  it('returns null on malformed SYNTHEX_MCP_LEGACY_KEYS JSON', async () => {
    process.env.SYNTHEX_MCP_LEGACY_KEYS = '{not json';
    await expect(resolveOrgFromBearer('Bearer key-abc')).resolves.toBeNull();
  });

  it('no longer reads the retired SYNTHEX_MCP_KEYS var', async () => {
    delete process.env.SYNTHEX_MCP_LEGACY_KEYS;
    process.env.SYNTHEX_MCP_KEYS = JSON.stringify({
      'key-abc': { organizationId: 'org1', userId: 'u-mcp', label: 'x' },
    });
    await expect(resolveOrgFromBearer('Bearer key-abc')).resolves.toBeNull();
  });
});
