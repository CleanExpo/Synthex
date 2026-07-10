/**
 * Unit tests — /api/brand-presets CRUD (SYN-40).
 *
 * Repo idiom (see agents-route.test.ts): mock @/lib/prisma + jwt-utils, drive
 * the real route handlers. Proves:
 *   - tenant filtering on every query (organizationId = clientId),
 *   - CROSS-ORG READ = 404 (another org's preset id is indistinguishable from
 *     a missing one),
 *   - first-GET seeding from BrandDNA (and fallbacks when no DNA exists),
 *   - domain validation (hex / font manifest / CTA cap / logo allowlist)
 *     rejected with 400 before any write.
 */

const findManyPreset = jest.fn();
const createPreset = jest.fn();
const findFirstPreset = jest.fn();
const updatePreset = jest.fn();
const deletePreset = jest.fn();
const findUniqueBrandDna = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    brandPreset: {
      findMany: (...a: unknown[]) => findManyPreset(...a),
      create: (...a: unknown[]) => createPreset(...a),
      findFirst: (...a: unknown[]) => findFirstPreset(...a),
      update: (...a: unknown[]) => updatePreset(...a),
      delete: (...a: unknown[]) => deletePreset(...a),
    },
    brandDNA: { findUnique: (...a: unknown[]) => findUniqueBrandDna(...a) },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import {
  GET as listPresets,
  POST as createRoute,
} from '@/app/api/brand-presets/route';
import {
  DELETE as deleteRoute,
  GET as getOne,
  PATCH as patchRoute,
} from '@/app/api/brand-presets/[id]/route';

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({
    organizationId: 'org-1',
    teamMemberships: [],
  });
});

function makeRequest(pathname: string, body?: unknown) {
  return {
    nextUrl: { pathname, searchParams: new URLSearchParams() },
    url: `http://localhost${pathname}`,
    json: async () => body,
  } as unknown as Parameters<typeof listPresets>[0];
}

const ownPreset = {
  id: 'preset-1',
  organizationId: 'org-1',
  name: 'Own preset',
  primaryColor: '#112233',
  secondaryColor: null,
  accentColor: null,
  font: 'inter',
  logoUrl: null,
  ctaText: null,
  isDefault: false,
};

/** Simulated table: preset-1 belongs to org-1, preset-2 to org-2. The mock
 *  honours the tenant filter exactly like the real query would. */
function wireTenantAwareFindFirst() {
  const rows = [
    ownPreset,
    { ...ownPreset, id: 'preset-2', organizationId: 'org-2' },
  ];
  findFirstPreset.mockImplementation(
    (args: { where: { id: string; organizationId: string } }) =>
      Promise.resolve(
        rows.find(
          r =>
            r.id === args.where.id &&
            r.organizationId === args.where.organizationId
        ) ?? null
      )
  );
}

describe('GET /api/brand-presets (list + first-read seeding)', () => {
  test('returns existing presets tenant-filtered, no seeding', async () => {
    findManyPreset.mockResolvedValue([ownPreset]);
    const res = await listPresets(makeRequest('/api/brand-presets'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.seeded).toBe(false);
    expect(json.presets).toHaveLength(1);
    expect(findManyPreset.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
    });
    expect(findUniqueBrandDna).not.toHaveBeenCalled();
    expect(createPreset).not.toHaveBeenCalled();
  });

  test('first read seeds the default preset from BrandDNA', async () => {
    findManyPreset.mockResolvedValue([]);
    findUniqueBrandDna.mockResolvedValue({
      businessName: 'Aurora Coffee',
      primaryColour: '#aa1122',
      secondaryColour: '#334455',
      neutralColour: null,
      logoUrl: 'https://client-site.example.org/logo.svg', // not allowlisted → dropped
    });
    createPreset.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'preset-new', ...args.data })
    );

    const res = await listPresets(makeRequest('/api/brand-presets'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.seeded).toBe(true);
    expect(json.presets).toHaveLength(1);

    expect(findUniqueBrandDna.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
    });
    const data = createPreset.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      name: 'Aurora Coffee default',
      primaryColor: '#aa1122',
      secondaryColor: '#334455',
      font: 'inter',
      logoUrl: null, // extracted logo failed the origin allowlist
      isDefault: true,
    });
  });

  test('first read with NO BrandDNA seeds deterministic fallbacks', async () => {
    findManyPreset.mockResolvedValue([]);
    findUniqueBrandDna.mockResolvedValue(null);
    createPreset.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'preset-new', ...args.data })
    );

    const res = await listPresets(makeRequest('/api/brand-presets'));
    expect(res.status).toBe(200);
    const data = createPreset.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      name: 'Brand default',
      primaryColor: '#0f172a',
      font: 'inter',
      isDefault: true,
    });
  });

  test('no session → 401, no queries', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await listPresets(makeRequest('/api/brand-presets'));
    expect(res.status).toBe(401);
    expect(findManyPreset).not.toHaveBeenCalled();
  });
});

describe('POST /api/brand-presets (create + validation)', () => {
  const validBody = {
    name: 'Campaign preset',
    primaryColor: '#123456',
    font: 'poppins',
    ctaText: 'Shop now',
  };

  test('valid body → 201, tenant-stamped create', async () => {
    createPreset.mockResolvedValue({ id: 'preset-9', ...validBody });
    const res = await createRoute(makeRequest('/api/brand-presets', validBody));
    expect(res.status).toBe(201);
    const data = createPreset.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      name: 'Campaign preset',
      primaryColor: '#123456',
      font: 'poppins',
      ctaText: 'Shop now',
    });
  });

  test.each([
    ['bad hex', { ...validBody, primaryColor: 'red' }],
    ['font outside manifest', { ...validBody, font: 'comic-sans' }],
    ['CTA over cap', { ...validBody, ctaText: 'x'.repeat(41) }],
    ['http logo', { ...validBody, logoUrl: 'http://a.supabase.co/l.png' }],
    [
      'non-allowlisted logo origin',
      { ...validBody, logoUrl: 'https://evil.example.net/l.png' },
    ],
  ])('domain-invalid body (%s) → 400, no write', async (_label, body) => {
    const res = await createRoute(makeRequest('/api/brand-presets', body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid brand style');
    expect(json.issues.length).toBeGreaterThan(0);
    expect(createPreset).not.toHaveBeenCalled();
  });

  test('shape-invalid body (missing name) → 400 zod issues, no write', async () => {
    const res = await createRoute(
      makeRequest('/api/brand-presets', {
        primaryColor: '#123456',
        font: 'inter',
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid body');
    expect(createPreset).not.toHaveBeenCalled();
  });
});

describe('GET/PATCH/DELETE /api/brand-presets/[id] — tenant isolation', () => {
  beforeEach(wireTenantAwareFindFirst);

  test('GET own preset → 200', async () => {
    const res = await getOne(makeRequest('/api/brand-presets/preset-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preset.id).toBe('preset-1');
    expect(findFirstPreset.mock.calls[0][0].where).toEqual({
      id: 'preset-1',
      organizationId: 'org-1',
    });
  });

  test("CROSS-ORG READ: another org's preset id → 404 (no existence oracle)", async () => {
    const res = await getOne(makeRequest('/api/brand-presets/preset-2'));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Preset not found');
  });

  test('GET unknown id → 404 (same body as cross-org)', async () => {
    const res = await getOne(makeRequest('/api/brand-presets/preset-nope'));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Preset not found');
  });

  test('PATCH own preset with valid partial → 200, merged row written', async () => {
    updatePreset.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...ownPreset, ...args.data })
    );
    const res = await patchRoute(
      makeRequest('/api/brand-presets/preset-1', { primaryColor: '#654321' })
    );
    expect(res.status).toBe(200);
    expect(updatePreset.mock.calls[0][0]).toMatchObject({
      where: { id: 'preset-1' },
      data: { primaryColor: '#654321', font: 'inter', name: 'Own preset' },
    });
  });

  test('PATCH font to a non-manifest value → 400, no write', async () => {
    const res = await patchRoute(
      makeRequest('/api/brand-presets/preset-1', { font: 'comic-sans' })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid brand style');
    expect(updatePreset).not.toHaveBeenCalled();
  });

  test("PATCH another org's preset → 404, no write", async () => {
    const res = await patchRoute(
      makeRequest('/api/brand-presets/preset-2', { primaryColor: '#654321' })
    );
    expect(res.status).toBe(404);
    expect(updatePreset).not.toHaveBeenCalled();
  });

  test('DELETE own preset → 204', async () => {
    deletePreset.mockResolvedValue(ownPreset);
    const res = await deleteRoute(makeRequest('/api/brand-presets/preset-1'));
    expect(res.status).toBe(204);
    expect(deletePreset.mock.calls[0][0]).toEqual({
      where: { id: 'preset-1' },
    });
  });

  test("DELETE another org's preset → 404, row untouched", async () => {
    const res = await deleteRoute(makeRequest('/api/brand-presets/preset-2'));
    expect(res.status).toBe(404);
    expect(deletePreset).not.toHaveBeenCalled();
  });
});
