/**
 * SYN-MCP-004-1 (SYN-1080) — app/api/mcp/auth.ts scoped key registry.
 *
 * Covers the acceptance criteria: hash verify (sha-256 DB lookup), expired /
 * revoked keys rejected, legacy env-map fallback flagged behind
 * SYNTHEX_MCP_LEGACY_KEYS (and the old SYNTHEX_MCP_KEYS var no longer read).
 */
import { createHash } from 'crypto';

// --- Mocks ---------------------------------------------------------------
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockOrgFindUnique = jest.fn();

const prismaMock = {
  mcpApiKey: {
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

import {
  resolveOrgFromBearer,
  hashMcpKey,
  LEGACY_SCOPES,
} from '@/app/api/mcp/auth';

const RAW_KEY = 'smk_test_raw_key_abc123';
const KEY_HASH = createHash('sha256').update(RAW_KEY, 'utf8').digest('hex');

const dbRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'key-1',
  organizationId: 'org-1',
  userId: 'user-1',
  label: 'test-key',
  scopes: ['generate_video', 'get_job'],
  expiresAt: null,
  revokedAt: null,
  ...overrides,
});

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SYNTHEX_MCP_KEYS;
  delete process.env.SYNTHEX_MCP_LEGACY_KEYS;
  mockFindUnique.mockResolvedValue(null);
  mockUpdate.mockResolvedValue({});
  // Org-status gate default (Track B S6'(b)): the caller org is alive.
  mockOrgFindUnique.mockResolvedValue({ status: 'active' });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('hashMcpKey', () => {
  it('is a sha-256 hex digest of the raw key', () => {
    expect(hashMcpKey(RAW_KEY)).toBe(KEY_HASH);
    expect(hashMcpKey(RAW_KEY)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('resolveOrgFromBearer — header parsing', () => {
  it('rejects a null header without touching the DB', async () => {
    expect(await resolveOrgFromBearer(null)).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer header', async () => {
    expect(await resolveOrgFromBearer(`Basic ${RAW_KEY}`)).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects an empty bearer value', async () => {
    expect(await resolveOrgFromBearer('Bearer   ')).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe('resolveOrgFromBearer — DB key registry', () => {
  it('resolves a valid key by sha-256 hash and returns caller + scopes', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());

    const caller = await resolveOrgFromBearer(`Bearer ${RAW_KEY}`);

    expect(caller).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      label: 'test-key',
      scopes: ['generate_video', 'get_job'],
    });
    // The lookup must be by hash — the raw key never reaches the DB layer.
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyHash: KEY_HASH } })
    );
  });

  it('stamps lastUsedAt on successful auth', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());

    await resolveOrgFromBearer(`Bearer ${RAW_KEY}`);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      })
    );
  });

  it('still authenticates when the lastUsedAt stamp fails (best-effort)', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockUpdate.mockRejectedValue(new Error('write failed'));

    const caller = await resolveOrgFromBearer(`Bearer ${RAW_KEY}`);
    expect(caller?.organizationId).toBe('org-1');
  });

  it('rejects an unknown key', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
  });

  it('rejects a revoked key', async () => {
    mockFindUnique.mockResolvedValue(
      dbRecord({ revokedAt: new Date('2026-01-01T00:00:00Z') })
    );
    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects an expired key', async () => {
    mockFindUnique.mockResolvedValue(
      dbRecord({ expiresAt: new Date(Date.now() - 60_000) })
    );
    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('accepts a key expiring in the future', async () => {
    mockFindUnique.mockResolvedValue(
      dbRecord({ expiresAt: new Date(Date.now() + 60_000) })
    );
    const caller = await resolveOrgFromBearer(`Bearer ${RAW_KEY}`);
    expect(caller?.organizationId).toBe('org-1');
  });

  it('a revoked DB key is NOT resurrected by the legacy env map', async () => {
    mockFindUnique.mockResolvedValue(
      dbRecord({ revokedAt: new Date('2026-01-01T00:00:00Z') })
    );
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      [RAW_KEY]: { organizationId: 'org-1', userId: 'user-1', label: 'x' },
    });
    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
  });
});

describe('resolveOrgFromBearer — legacy env-map fallback', () => {
  it('resolves a legacy key behind SYNTHEX_MCP_LEGACY_KEYS with wildcard scopes', async () => {
    mockFindUnique.mockResolvedValue(null);
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      'legacy-key': {
        organizationId: 'org-legacy',
        userId: 'user-legacy',
        label: 'claude-code',
      },
    });

    const caller = await resolveOrgFromBearer('Bearer legacy-key');

    expect(caller).toEqual({
      organizationId: 'org-legacy',
      userId: 'user-legacy',
      label: 'claude-code',
      scopes: [...LEGACY_SCOPES],
    });
    expect(caller?.scopes).toEqual(['*']);
  });

  it('rejects when the legacy flag env is unset', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
  });

  it('no longer reads the old SYNTHEX_MCP_KEYS var', async () => {
    mockFindUnique.mockResolvedValue(null);
    process.env.SYNTHEX_MCP_KEYS = JSON.stringify({
      'legacy-key': {
        organizationId: 'org-legacy',
        userId: 'user-legacy',
        label: 'claude-code',
      },
    });
    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
  });

  it('rejects a key missing from the legacy map', async () => {
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      'other-key': { organizationId: 'o', userId: 'u', label: 'l' },
    });
    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
  });

  it('rejects a malformed legacy map without throwing', async () => {
    process.env.SYNTHEX_MCP_LEGACY_KEYS = 'not-json{';
    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
  });

  it('rejects a legacy entry missing organizationId/userId', async () => {
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      'legacy-key': { label: 'broken' },
    });
    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
  });

  it('falls back to the legacy map when the DB is unavailable (cutover safety)', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      'legacy-key': {
        organizationId: 'org-legacy',
        userId: 'user-legacy',
        label: 'claude-code',
      },
    });
    const caller = await resolveOrgFromBearer('Bearer legacy-key');
    expect(caller?.organizationId).toBe('org-legacy');
  });
});

// -- Track B S6'(b) -- org-status gate (criterion 5) -------------------------

describe('resolveOrgFromBearer — suspended-org gate (Track B offboard)', () => {
  it('rejects a VALID key whose organization is suspended', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockOrgFindUnique.mockResolvedValue({ status: 'suspended' });

    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
  });

  it('rejects a VALID key whose organization is deleted', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockOrgFindUnique.mockResolvedValue({ status: 'deleted' });

    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
  });

  it('rejects a VALID key whose organization row is missing (fail closed)', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockOrgFindUnique.mockResolvedValue(null);

    expect(await resolveOrgFromBearer(`Bearer ${RAW_KEY}`)).toBeNull();
  });

  it('still authenticates when the organization is active', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockOrgFindUnique.mockResolvedValue({ status: 'active' });

    const caller = await resolveOrgFromBearer(`Bearer ${RAW_KEY}`);
    expect(caller?.organizationId).toBe('org-1');
  });

  it('gates the LEGACY env-map path on org status too', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockOrgFindUnique.mockResolvedValue({ status: 'suspended' });
    process.env.SYNTHEX_MCP_LEGACY_KEYS = JSON.stringify({
      'legacy-key': {
        organizationId: 'org-legacy',
        userId: 'user-legacy',
        label: 'claude-code',
      },
    });

    expect(await resolveOrgFromBearer('Bearer legacy-key')).toBeNull();
  });
});
