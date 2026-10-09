import { anthropicOmitsSampling } from '@/lib/ai/providers/anthropic-provider';

describe('anthropicOmitsSampling', () => {
  it('omits temperature on Claude Sonnet 5 and later aliases', () => {
    expect(anthropicOmitsSampling('claude-sonnet-5')).toBe(true);
    expect(anthropicOmitsSampling('claude-opus-4-8')).toBe(true);
  });

  it('still allows temperature on dated 4.5 snapshots', () => {
    expect(anthropicOmitsSampling('claude-haiku-4-5-20251001')).toBe(false);
    expect(anthropicOmitsSampling('claude-sonnet-4-5-20250929')).toBe(false);
  });
});
