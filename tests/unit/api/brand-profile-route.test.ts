import { createMockNextRequest } from '../../helpers/mock-request';

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromRequestOrCookies(...args),
}));

const mockGetEffectiveOrganizationId = jest.fn();
const mockHasOrganizationAccess = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
  hasOrganizationAccess: (...args: unknown[]) =>
    mockHasOrganizationAccess(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const { GET, PATCH } = require('@/app/api/brand-profile/route');

const orgRecord = {
  id: 'active-org',
  name: 'Active Business',
  slug: 'active-business',
  description: 'Active description',
  website: 'https://active.example.com',
  industry: 'Restoration',
  teamSize: '2-10',
  abn: '123',
  logo: null,
  favicon: null,
  primaryColor: '#f59e0b',
  socialHandles: { linkedin: 'active' },
  updatedAt: new Date('2026-05-27T00:00:00.000Z'),
};

describe('/api/brand-profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
    mockGetEffectiveOrganizationId.mockResolvedValue('active-org');
    mockHasOrganizationAccess.mockResolvedValue(true);
    mockPrisma.organization.findUnique.mockResolvedValue(orgRecord);
    mockPrisma.organization.update.mockResolvedValue(orgRecord);
  });

  it('GET reads the effective active organization context', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/brand-profile',
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith('user-123');
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'active-org' },
      select: expect.any(Object),
    });
    expect(body.data.id).toBe('active-org');
  });

  it('PATCH updates the effective active organization only', async () => {
    const req = createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost:3000/api/brand-profile',
      body: { name: 'Renamed Active Business', website: '' },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith('user-123');
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'active-org' },
      data: {
        name: 'Renamed Active Business',
        website: null,
      },
      select: expect.any(Object),
    });
  });

  it('GET honors requested organization context when the user has access', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/brand-profile?context=requested-org',
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith(
      'user-123',
      'requested-org'
    );
    expect(mockGetEffectiveOrganizationId).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'requested-org' },
      select: expect.any(Object),
    });
  });

  it('PATCH honors requested organization context when the user has access', async () => {
    const req = createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost:3000/api/brand-profile?context=requested-org',
      body: { name: 'Requested Business' },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith(
      'user-123',
      'requested-org'
    );
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'requested-org' },
      data: { name: 'Requested Business' },
      select: expect.any(Object),
    });
  });

  it('rejects requested organization context when the user lacks access', async () => {
    mockHasOrganizationAccess.mockResolvedValueOnce(false);

    const req = createMockNextRequest({
      method: 'PATCH',
      url: 'http://localhost:3000/api/brand-profile?context=other-org',
      body: { name: 'Blocked Business' },
    });

    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('You do not have access to this organisation.');
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('returns 404 when no active organization context exists', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValueOnce(null);

    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/brand-profile',
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe(
      'No active organisation context. Select a business first.'
    );
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValueOnce(null);

    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/brand-profile',
    });

    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockGetEffectiveOrganizationId).not.toHaveBeenCalled();
  });
});
