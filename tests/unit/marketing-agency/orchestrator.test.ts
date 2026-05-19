import { generateMockCampaignPackage } from '@/lib/marketing-agency/orchestrator';

describe('generateMockCampaignPackage', () => {
  it('generates a RestoreAssist launch package with blocked publish gate', () => {
    const result = generateMockCampaignPackage({ providerMode: 'mock' });

    expect(result.providerMode).toBe('mock');
    expect(result.boardMemo.campaignObjective).toContain('RestoreAssist');
    expect(result.personas.length).toBeGreaterThanOrEqual(3);
    expect(result.storyboards).toHaveLength(5);
    expect(result.storyboards.map(storyboard => storyboard.channel)).toEqual(
      expect.arrayContaining(['linkedin', 'facebook'])
    );
    expect(result.storyboards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'linkedin-owner-thumbstop-15',
          durationSec: 15,
          primaryFormat: '9:16',
        }),
      ])
    );
    expect(
      result.storyboards.every(
        storyboard =>
          storyboard.targetPersona &&
          storyboard.strategy &&
          storyboard.audioDirection &&
          storyboard.callToAction &&
          storyboard.rankingRationale.length > 0 &&
          storyboard.testHypothesis
      )
    ).toBe(true);
    expect(result.qa.publishGate.status).toBe('blocked');
    expect(result.exportManifest.formats).toEqual(expect.arrayContaining(['16:9', '9:16', '4:5', '1:1']));
  });
});
