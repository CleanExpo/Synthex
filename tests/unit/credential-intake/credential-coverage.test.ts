/**
 * Unit tests for the credential-coverage classifier (SYN-1023).
 *
 * Proves the secret-free report distinguishes connected OAuth, reference-only,
 * and missing accounts — and that the CCW inventory blocker surfaces as
 * `missing` with an action rather than silently disappearing.
 */
import {
  computeCredentialCoverage,
  type CoverageInput,
} from '@/lib/credential-intake/credential-coverage';
import type {
  CredentialMapping,
  CredentialSearchBlocker,
} from '@/lib/credential-intake/account-reference-mappings';

const MAPPINGS: CredentialMapping[] = [
  {
    orgSlug: 'carsi',
    provider: 'facebook',
    slug: 'onepassword-carsi-facebook-developer',
    name: 'CARSI Facebook',
    vault: 'Carsi',
    itemId: 'item-fb',
    platforms: ['facebook', 'instagram'],
  },
  {
    orgSlug: 'carsi',
    provider: 'linkedin',
    slug: 'onepassword-carsi-linkedin',
    name: 'CARSI LinkedIn',
    vault: 'Carsi',
    itemId: 'item-li',
    platforms: ['linkedin'],
  },
];

const BLOCKERS: CredentialSearchBlocker[] = [
  {
    orgSlug: 'ccw',
    checkedQueries: ['ccw'],
    status: 'not_found_in_1password_inventory',
    checkedAt: '2026-06-16',
    actionRequired: 'Add CCW items to 1Password.',
  },
];

function run(partial: Partial<CoverageInput>) {
  return computeCredentialCoverage({
    mappings: MAPPINGS,
    blockers: BLOCKERS,
    connectedByOrg: {},
    vaultSlugsByOrg: {},
    ...partial,
  });
}

describe('computeCredentialCoverage', () => {
  it('classifies an active OAuth connection as connected_oauth (via platform alias)', () => {
    // CARSI facebook maps platforms [facebook, instagram]; an instagram
    // connection should still count the facebook mapping as connected.
    const report = run({ connectedByOrg: { carsi: ['instagram'] } });
    const fb = report.rows.find((r) => r.slug === 'onepassword-carsi-facebook-developer');
    expect(fb?.status).toBe('connected_oauth');
  });

  it('classifies a stored reference with no connection as reference_only', () => {
    const report = run({
      vaultSlugsByOrg: { carsi: ['onepassword-carsi-linkedin'] },
    });
    const li = report.rows.find((r) => r.slug === 'onepassword-carsi-linkedin');
    expect(li?.status).toBe('reference_only');
  });

  it('classifies an account with neither reference nor connection as missing', () => {
    const report = run({});
    const fb = report.rows.find((r) => r.slug === 'onepassword-carsi-facebook-developer');
    expect(fb?.status).toBe('missing');
    expect(fb?.reason).toMatch(/no active OAuth/i);
  });

  it('surfaces inventory blockers (CCW) as missing with the action required', () => {
    const report = run({});
    const ccw = report.rows.find((r) => r.orgSlug === 'ccw');
    expect(ccw?.status).toBe('missing');
    expect(ccw?.slug).toBeNull();
    expect(ccw?.reason).toBe('Add CCW items to 1Password.');
  });

  it('prefers connected_oauth over a stored reference for the same account', () => {
    const report = run({
      connectedByOrg: { carsi: ['linkedin'] },
      vaultSlugsByOrg: { carsi: ['onepassword-carsi-linkedin'] },
    });
    const li = report.rows.find((r) => r.slug === 'onepassword-carsi-linkedin');
    expect(li?.status).toBe('connected_oauth');
  });

  it('tallies totals across all rows including blockers', () => {
    const report = run({
      connectedByOrg: { carsi: ['facebook'] },
      vaultSlugsByOrg: { carsi: ['onepassword-carsi-linkedin'] },
    });
    // facebook → connected, linkedin → reference_only, ccw blocker → missing
    expect(report.totals).toEqual({
      connected_oauth: 1,
      reference_only: 1,
      missing: 1,
    });
  });
});
