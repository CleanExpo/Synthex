import { restoreAssistFixture } from '@/lib/marketing-agency/fixtures/restoreassist';

describe('marketing agency fixtures', () => {
  it('contains the minimum source data required for a draft campaign', () => {
    expect(restoreAssistFixture.clientBrand.displayName).toBe('RestoreAssist');
    expect(restoreAssistFixture.productProfile.primaryOffer).toContain('3');
    expect(restoreAssistFixture.personas.length).toBeGreaterThanOrEqual(3);
    expect(restoreAssistFixture.sourceRefs.length).toBeGreaterThan(0);
  });
});
