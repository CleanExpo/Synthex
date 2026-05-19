import { restoreAssistLaunchStoryboards } from '@/lib/marketing-agency/remotion/scene-data';
import { buildRemotionStoryboardPlans } from '@/lib/marketing-agency/remotion/storyboard-plan';
import { restoreAssistFixture } from '@/lib/marketing-agency/fixtures/restoreassist';

describe('RestoreAssist Remotion scene data', () => {
  it('has timed scenes with voiceover and visual notes', () => {
    const storyboard = restoreAssistLaunchStoryboards[0];

    expect(storyboard.durationSec).toBeGreaterThan(0);
    expect(storyboard.scenes[0].startSec).toBe(0);
    expect(storyboard.targetPersona).toBeTruthy();
    expect(storyboard.audioDirection).toBeTruthy();
    expect(storyboard.rankingRationale.length).toBeGreaterThan(0);
    expect(storyboard.testHypothesis).toBeTruthy();
    expect(
      restoreAssistLaunchStoryboards.every(storyboard =>
        storyboard.scenes.every(scene => scene.voiceover && scene.visualNote)
      )
    ).toBe(true);
  });

  it('maps each storyboard to a supported Remotion composition plan', () => {
    const plans = buildRemotionStoryboardPlans(
      restoreAssistLaunchStoryboards,
      restoreAssistFixture.clientBrand
    );

    expect(plans).toHaveLength(restoreAssistLaunchStoryboards.length);
    expect(plans.map(plan => plan.compositionId)).toEqual(
      expect.arrayContaining(['ExplainerVideo', 'SocialReel', 'BrandSquare'])
    );
    expect(plans.find(plan => plan.storyboardId === 'linkedin-owner-thumbstop-15')).toEqual(
      expect.objectContaining({
        compositionId: 'SocialReel',
        width: 720,
        height: 1280,
        durationInFrames: 450,
      })
    );
    expect(plans.every(plan => plan.durationInFrames > 0)).toBe(true);
    expect(plans.every(plan => plan.voiceoverScript.length > 20)).toBe(true);
  });
});
