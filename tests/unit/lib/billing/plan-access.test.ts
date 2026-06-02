import {
  hasBusinessAccess,
  hasPlanAccess,
  hasProfessionalAccess,
} from '@/lib/billing/plan-access';

describe('plan access ranking', () => {
  it('treats scale and custom as top-tier access', () => {
    expect(hasProfessionalAccess('scale')).toBe(true);
    expect(hasBusinessAccess('scale')).toBe(true);
    expect(hasPlanAccess('custom', 'scale')).toBe(true);
    expect(hasPlanAccess('scale', 'business')).toBe(true);
  });

  it('keeps lower tiers below higher-tier gates', () => {
    expect(hasProfessionalAccess('free')).toBe(false);
    expect(hasBusinessAccess('professional')).toBe(false);
    expect(hasPlanAccess('growth', 'scale')).toBe(false);
  });
});
