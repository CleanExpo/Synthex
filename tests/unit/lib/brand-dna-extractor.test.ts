import { mapPipelineResultToBrandDNA } from '@/lib/brand-dna/extractor';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';

const mockPipeline: PipelineResult = {
  businessName: "Jake's Café",
  industry: 'Food & Beverage',
  description: 'A cosy café in Melbourne',
  teamSize: '1-5',
  logoUrl: 'https://jakes.com/logo.png',
  faviconUrl: null,
  brandColours: { primary: '#3b2f1e', secondary: '#d4a96a' },
  seoSignals: null,
  seoScore: 72,
  pageSpeed: { mobile: null, desktop: null },
  overallHealth: 'good',
  healthSummary: 'Good',
  quickWins: [],
  contentGaps: [],
  keywordOpportunities: [],
  socialProfiles: [
    {
      platform: 'instagram',
      url: 'https://instagram.com/jakescafe',
      verified: true,
    },
  ],
  socialHandles: { instagram: '@jakescafe' },
  keyTopics: ['coffee', 'brunch', 'local'],
  targetAudience: 'Coffee lovers aged 25-45',
  suggestedTone: 'warm and friendly',
  suggestedPersonaName: 'The Regular',
  confidence: 0.9,
  structuredData: {},
  url: 'https://jakes-cafe.com.au',
};

describe('mapPipelineResultToBrandDNA', () => {
  it('maps pipeline result to BrandDNA shape correctly', () => {
    const result = mapPipelineResultToBrandDNA(mockPipeline, 'org_123');
    expect(result.organizationId).toBe('org_123');
    expect(result.businessName).toBe("Jake's Café");
    expect(result.primaryColour).toBe('#3b2f1e');
    expect(result.secondaryColour).toBe('#d4a96a');
    expect(result.seoScore).toBe(72);
    expect(result.socialProfiles).toHaveLength(1);
    expect(result.offerings).toEqual(['coffee', 'brunch', 'local']);
    expect(result.brandVoice.tone).toBe('warm and friendly');
    expect(result.persona.description).toBe('Coffee lovers aged 25-45');
    expect(result.vertical).toBe('café');
    expect(result.sourceUrl).toBe('https://jakes-cafe.com.au');
  });

  it('infers vertical from industry string', () => {
    const result = mapPipelineResultToBrandDNA(
      { ...mockPipeline, industry: 'Hair Salon' },
      'org_x'
    );
    expect(result.vertical).toBe('salon');
  });
});
