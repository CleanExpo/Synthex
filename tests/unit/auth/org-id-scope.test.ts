import { orgIdScope } from '@/lib/auth/org-id-scope';

describe('orgIdScope', () => {
  it('matches the effective organisation and the legacy user-as-org rows', () => {
    expect(orgIdScope('org_abc', 'user_xyz')).toEqual({
      OR: [{ orgId: 'org_abc' }, { orgId: 'user_xyz' }],
    });
  });

  it('does not collapse to a single field when the ids happen to match', () => {
    // Solo users historically wrote userId into orgId. After the fix, creates
    // write the real organisation id; the dual match must still work if those
    // happen to be equal for a given caller.
    const scope = orgIdScope('same', 'same');
    expect(scope.OR).toHaveLength(2);
  });
});
