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
  operatingMandate:
    'Source first, publish owned media first, gate external social.',
  sources: [
    {
      id: 'plaud-systemic-overhaul-mandate',
      label: 'Plaud founder mandate',
      sourceType: 'founder_recording_transcript',
      path: 'Plaud file test-fixture',
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

    for (const draft of pack.drafts) {
      expect(draft.mediaPlan.assetSourcePolicy).toBe(
        'owned_licensed_original_only'
      );
      expect(draft.mediaPlan.reviewChecks.length).toBeGreaterThanOrEqual(3);
      expect(draft.peerBenchmark.testMethod).toBeTruthy();
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
      ])
    );
    expect(pack.externalPublishBlocks.reddit).toContain(
      'subreddit_rules_and_affiliation_disclosure_required'
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
      ])
    );
    expect(pack.evidenceManifest.approval.humanApproved).toBe(true);
  });

  it('passes the campaign quality gate with verifiable media and peer-test plans', () => {
    const pack = generateFullAuthorityCampaign({
      ...baseInput,
      horizonDays: 7,
    });

    expect(pack.qualityGate.allowed).toBe(true);
    expect(pack.qualityGate.overallScore).toBeGreaterThanOrEqual(75);
    expect(pack.qualityGate.blockers).toHaveLength(0);
    expect(pack.qualityGate.sourceSummary).toEqual(
      expect.objectContaining({
        totalSources: 6,
        checkedSources: 6,
        officialPlatformSources: 4,
        internalPolicySources: 1,
      })
    );
    expect(pack.qualityGate.draftResults).toHaveLength(7);
    expect(pack.qualityGate.draftResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'youtube_shorts',
          mediaType: 'short_video',
          peerDataStatus: 'data_required_until_credentials',
          status: 'pass',
        }),
        expect.objectContaining({
          channel: 'instagram',
          mediaType: 'carousel',
          status: 'pass',
        }),
      ])
    );
  });

  it('supports client-specific evidence refs and pillar copy', () => {
    const pack = generateFullAuthorityCampaign({
      ...baseInput,
      horizonDays: 2,
      coreEvidenceRefs: [
        'client-official-source',
        'internal-consent-evidence-policy',
      ],
      sources: [
        ...baseInput.sources,
        {
          id: 'client-official-source',
          label: 'Client official source',
          sourceType: 'official_business_site',
          url: 'https://example.com/client',
          checkedAt: '2026-06-11T10:15:00+10:00',
        },
      ],
      manifestTopic: 'Client authority campaign',
      pillarCopy: {
        how_to: {
          title: 'How to choose client training without guessing',
          angle:
            'Use client source material before writing any campaign claim.',
          body: 'Client-specific copy starts with the official source, keeps the claim narrow, and leaves unsupported claims out of the draft.',
        },
        did_you_know: {
          title: 'Did you know: client claims need evidence',
          angle: 'Teach why official source material must control the draft.',
        },
      },
      channelCtas: {
        blog: 'Check the client source register.',
      },
    });

    expect(pack.evidenceManifest.topic).toBe('Client authority campaign');
    expect(pack.calendar[0]).toEqual(
      expect.objectContaining({
        title: 'How to choose client training without guessing',
        evidenceRefs: expect.arrayContaining([
          'client-official-source',
          'internal-consent-evidence-policy',
        ]),
      })
    );
    expect(pack.drafts[0]).toEqual(
      expect.objectContaining({
        body: expect.stringContaining('Client-specific copy starts'),
        cta: 'Check the client source register.',
      })
    );
    expect(pack.evidenceManifest.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'claim-source-first',
          evidenceRefs: expect.arrayContaining(['client-official-source']),
        }),
      ])
    );
    expect(pack.qualityGate.allowed).toBe(true);
  });
});
