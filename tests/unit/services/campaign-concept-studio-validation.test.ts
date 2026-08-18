import { campaignConceptStudioRequestSchema } from '@/lib/services/campaign-concept-studio';

const BASE_INPUT = {
  campaignBrief: 'Launch a campaign for our new cloud dashboard rollout.',
  targetAudience: 'Mid-size teams in the services sector.',
  productDetails:
    'A lightweight platform for creating campaign plans, copy variants, and creative briefs.',
  tone: 'confident',
  channels: ['Instagram'],
};

describe('campaignConceptStudioRequestSchema hardening', () => {
  it('rejects overly long campaign briefs', () => {
    const payload = {
      ...BASE_INPUT,
      campaignBrief: 'x'.repeat(1_800),
    };

    const result = campaignConceptStudioRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toHaveProperty('campaignBrief');
  });

  it('rejects overly long audience copy', () => {
    const payload = {
      ...BASE_INPUT,
      targetAudience: 'x'.repeat(600),
    };

    const result = campaignConceptStudioRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toHaveProperty(
      'targetAudience'
    );
  });

  it('rejects overly long product details', () => {
    const payload = {
      ...BASE_INPUT,
      productDetails: 'x'.repeat(2_400),
    };

    const result = campaignConceptStudioRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toHaveProperty(
      'productDetails'
    );
  });

  it('rejects channel over-allocation', () => {
    const payload = {
      ...BASE_INPUT,
      channels: Array.from({ length: 9 }, () => 'Instagram'),
    };

    const result = campaignConceptStudioRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toHaveProperty('channels');
  });
});
