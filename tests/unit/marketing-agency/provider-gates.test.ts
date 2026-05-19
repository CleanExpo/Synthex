import { ArtlistConfigurationError, createArtlistClient } from '@/lib/marketing-agency/artlist/client';
import { recommendArtlistAudio } from '@/lib/marketing-agency/artlist/recommend';
import { HeyGenConfigurationError, HeyGenConsentError, createHeyGenClient } from '@/lib/marketing-agency/heygen/client';
import { buildMetaCreativeExport } from '@/lib/marketing-agency/meta/export';

describe('marketing agency provider gates', () => {
  it('keeps Artlist mock recommendations available without credentials', async () => {
    const recommendation = await recommendArtlistAudio({
      providerMode: 'mock',
      mood: 'measured',
      durationSec: 30,
    });

    expect(recommendation.provider).toBe('artlist');
    expect(recommendation.licenceStatus).toBe('pending');
  });

  it('blocks live Artlist calls when credentials are missing', async () => {
    const client = createArtlistClient({ apiKey: undefined });

    await expect(client.recommendAudio({ mood: 'measured', durationSec: 30 })).rejects.toBeInstanceOf(
      ArtlistConfigurationError
    );
  });

  it('requires consent before HeyGen real-person likeness generation', async () => {
    const client = createHeyGenClient({ apiKey: 'test-key' });

    await expect(
      client.createAvatarVideo({
        avatarId: 'avatar-1',
        script: 'RestoreAssist launch script',
        consent: null,
      })
    ).rejects.toBeInstanceOf(HeyGenConsentError);
  });

  it('blocks live HeyGen calls when credentials are missing', async () => {
    const client = createHeyGenClient({ apiKey: undefined });

    await expect(
      client.createAvatarVideo({
        avatarId: 'avatar-1',
        script: 'RestoreAssist launch script',
        consent: {
          subjectName: 'Approved Presenter',
          sourceRef: 'consent-video-001',
          confirmedAt: '2026-05-16T00:00:00.000Z',
        },
      })
    ).rejects.toBeInstanceOf(HeyGenConfigurationError);
  });

  it('exports Meta creative specs without exposing a publish path', () => {
    const metaExport = buildMetaCreativeExport({
      campaignId: 'restoreassist-launch-2026-05',
      creativeId: 'linkedin-authority',
      formats: ['9:16', '1:1'],
    });

    expect(metaExport.publishAllowed).toBe(false);
    expect(Object.keys(metaExport)).not.toContain('publish');
    expect(metaExport.creatives).toHaveLength(2);
  });
});
