import { generateFullAuthorityCampaign } from '@/lib/marketing-agency/full-campaign-generator';

const baseInput = {
  campaignId: 'test-authority-campaign',
  generatedAt: '2026-06-11T10:15:00+10:00',
  business: {
    slug: 'test-business',
    name: 'Test Business',
    websiteUrl: 'https://example.com',
    positioning: 'Evidence-backed service marketing',
    audience: ['business owners', 'operators'],
    offers: ['business profile intake', 'verified campaign generation'],
    voiceRules: ['direct', 'practical'],
    forbiddenClaims: ['No unsupported results claims'],
  },
  objective: 'Generate an evidence-backed authority campaign',
  operatingMandate: 'Source first, publish owned media first, gate external social.',
  sources: [
    {
      id: 'plaud-systemic-overhaul-mandate',
      label: 'Plaud founder mandate',
      sourceType: 'founder_recording_transcript',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-linkedin-posts-api',
      label: 'LinkedIn Posts API',
      sourceType: 'official_platform_documentation',
      url: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-meta-pages-api',
      label: 'Facebook Pages API',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.facebook.com/docs/pages-api/posts/',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-youtube-videos-insert',
      label: 'YouTube videos.insert',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.google.com/youtube/v3/docs/videos/insert',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-reddit-data-api',
      label: 'Reddit Data API',
      sourceType: 'official_platform_documentation',
      url: 'https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'internal-consent-evidence-policy',
      label: 'Consent and evidence policy',
      sourceType: 'internal_policy',
      path: 'docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
  ],
} as const;

describe('generateFullAuthorityCampaign', () => {
  it('generates sourced calendar slots and platform drafts', () => {
    const pack = generateFullAuthorityCampaign({
      ...baseInput,
      horizonDays: 14,
    });

    expect(pack.calendar).toHaveLength(14);
    expect(pack.drafts).toHaveLength(14);

    for (const slot of pack.calendar) {
      expect(slot.evidenceRefs).toContain('plaud-systemic-overhaul-mandate');
      expect(slot.title).toBeTruthy();
      expect(slot.format).toBeTruthy();
    }
  });

  it('allows owned media while keeping external channels blocked by credentials and approval', () => {
    const pack = generateFullAuthorityCampaign({
      ...baseInput,
      horizonDays: 7,
    });

    expect(pack.ownedMediaGate.allowed).toBe(true);
    expect(pack.externalPublishBlocks.linkedin).toEqual(
      expect.arrayContaining([
        'platform_credentials_required',
        'human_or_client_approval_required',
        'final_asset_rights_check_required',
      ]),
    );
    expect(pack.externalPublishBlocks.reddit).toContain(
      'subreddit_rules_and_affiliation_disclosure_required',
    );
  });

  it('emits an authority manifest with verified claims and platform source refs', () => {
    const pack = generateFullAuthorityCampaign({
      ...baseInput,
      horizonDays: 7,
    });

    expect(pack.evidenceManifest.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'claim-platforms-require-auth',
          status: 'verified',
          evidenceRefs: expect.arrayContaining([
            'platform-linkedin-posts-api',
            'platform-meta-pages-api',
            'platform-youtube-videos-insert',
            'platform-reddit-data-api',
          ]),
        }),
      ]),
    );
    expect(pack.evidenceManifest.approval.humanApproved).toBe(true);
  });
});
