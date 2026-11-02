/**
 * Workspace membership is the single boundary every portfolio path uses.
 */
const mockFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
}));

import {
  inWorkspace,
  isActiveWorkspaceRoot,
  loadWorkspaceOrgs,
} from '@/lib/marketing-calendar/workspace';

const root = {
  id: 'org-ug',
  slug: 'unite-group',
  status: 'active',
  parentOrgId: null,
};
const child = (slug: string, extra: object = {}) => ({
  id: `org-${slug}`,
  slug,
  status: 'active',
  parentOrgId: 'org-ug',
  ...extra,
});

describe('workspace membership', () => {
  it('accepts the active root and its active children', () => {
    expect(isActiveWorkspaceRoot(root)).toBe(true);
    expect(inWorkspace(root, root)).toBe(true);
    expect(inWorkspace(child('carsi'), root)).toBe(true);
  });

  it('refuses a nested or inactive root, and everything under it', () => {
    const nested = { ...root, parentOrgId: 'outside-root' };
    expect(isActiveWorkspaceRoot(nested)).toBe(false);
    expect(inWorkspace(nested, nested)).toBe(false);
    expect(inWorkspace(child('carsi'), nested)).toBe(false);
    const suspended = { ...root, status: 'suspended' };
    expect(inWorkspace(child('carsi'), suspended)).toBe(false);
  });

  it('refuses a deleted child and a child of another parent', () => {
    expect(inWorkspace(child('carsi', { status: 'deleted' }), root)).toBe(
      false
    );
    expect(
      inWorkspace(child('carsi', { parentOrgId: 'outside-parent' }), root)
    ).toBe(false);
  });

  it('loads only members, by slug', async () => {
    mockFindMany.mockResolvedValue([
      root,
      child('carsi'),
      child('nrpg', { parentOrgId: 'outside-parent' }),
    ]);
    expect([...(await loadWorkspaceOrgs()).keys()]).toEqual([
      'unite-group',
      'carsi',
    ]);
  });

  it('loads nothing when the root is missing or nested', async () => {
    mockFindMany.mockResolvedValue([child('carsi')]);
    expect((await loadWorkspaceOrgs()).size).toBe(0);
    mockFindMany.mockResolvedValue([
      { ...root, parentOrgId: 'outside-root' },
      child('carsi'),
    ]);
    expect((await loadWorkspaceOrgs()).size).toBe(0);
  });
});
