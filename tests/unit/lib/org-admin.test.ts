const mockUserFindFirst = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockResolveIssuerRole = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/auth/rbac/issuer-rank', () => ({
  ROLE_RANK: { owner: 3, admin: 2, editor: 1, viewer: 0 },
  resolveIssuerRole: (...args: unknown[]) => mockResolveIssuerRole(...args),
}));

import { isOrganizationAdmin } from '@/lib/auth/org-admin';

describe('isOrganizationAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses non-members', async () => {
    mockUserFindFirst.mockResolvedValue(null);
    await expect(isOrganizationAdmin('u1', 'org1')).resolves.toBe(false);
    expect(mockResolveIssuerRole).not.toHaveBeenCalled();
  });

  it('allows settings.admins without an RBAC rank', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'u1' });
    mockOrgFindUnique.mockResolvedValue({ settings: { admins: ['u1'] } });
    await expect(isOrganizationAdmin('u1', 'org1')).resolves.toBe(true);
    expect(mockResolveIssuerRole).not.toHaveBeenCalled();
  });

  it('allows an RBAC owner who is not in settings.admins', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'u1' });
    mockOrgFindUnique.mockResolvedValue({ settings: {} });
    mockResolveIssuerRole.mockResolvedValue('owner');
    await expect(isOrganizationAdmin('u1', 'org1')).resolves.toBe(true);
  });

  it('allows an RBAC admin who is not in settings.admins', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'u1' });
    mockOrgFindUnique.mockResolvedValue({ settings: {} });
    mockResolveIssuerRole.mockResolvedValue('admin');
    await expect(isOrganizationAdmin('u1', 'org1')).resolves.toBe(true);
  });

  it('refuses an editor who is not in settings.admins', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'u1' });
    mockOrgFindUnique.mockResolvedValue({ settings: {} });
    mockResolveIssuerRole.mockResolvedValue('editor');
    await expect(isOrganizationAdmin('u1', 'org1')).resolves.toBe(false);
  });
});
