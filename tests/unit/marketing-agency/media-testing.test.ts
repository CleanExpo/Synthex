import { restoreAssistFixture } from '@/lib/marketing-agency/fixtures/restoreassist';
import { buildMediaGuideItems } from '@/lib/marketing-agency/media-guide';
import { buildMediaTestingPlan } from '@/lib/marketing-agency/media-testing';
import { buildRemotionStoryboardPlans } from '@/lib/marketing-agency/remotion/storyboard-plan';
import { restoreAssistLaunchStoryboards } from '@/lib/marketing-agency/storyboards';

describe('marketing agency media testing plan', () => {
  it('builds human-in-the-loop visual and audio checks for each storyboard', () => {
    const plans = buildRemotionStoryboardPlans(
      restoreAssistLaunchStoryboards,
      restoreAssistFixture.clientBrand
    );
    const mediaGuideItems = buildMediaGuideItems(
      restoreAssistLaunchStoryboards,
      plans
    );
    const testingPlan = buildMediaTestingPlan(
      restoreAssistLaunchStoryboards,
      mediaGuideItems
    );

    expect(testingPlan).toHaveLength(restoreAssistLaunchStoryboards.length);
    expect(
      testingPlan.every(item => item.visualChecks.length >= 3)
    ).toBe(true);
    expect(testingPlan.every(item => item.audioChecks.length >= 3)).toBe(true);
    expect(
      testingPlan.every(item => item.humanReviewQuestions.length >= 5)
    ).toBe(true);
    expect(
      testingPlan.find(item => item.storyboardId === 'facebook-retargeting-15')
    ).toEqual(
      expect.objectContaining({
        format: '9:16',
        pixelSize: '720 x 1280px',
        durationSec: 15,
      })
    );
  });

  it('warns when an opening hook takes longer than four seconds', () => {
    const plans = buildRemotionStoryboardPlans(
      restoreAssistLaunchStoryboards,
      restoreAssistFixture.clientBrand
    );
    const mediaGuideItems = buildMediaGuideItems(
      restoreAssistLaunchStoryboards,
      plans
    );
    const testingPlan = buildMediaTestingPlan(
      restoreAssistLaunchStoryboards,
      mediaGuideItems
    );

    const authority = testingPlan.find(item => item.storyboardId === 'linkedin-authority');

    expect(authority?.visualChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Hook visible in opening beat',
          status: 'warn',
        }),
      ])
    );
  });
});
