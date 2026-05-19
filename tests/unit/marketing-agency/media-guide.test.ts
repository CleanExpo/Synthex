import { restoreAssistFixture } from '@/lib/marketing-agency/fixtures/restoreassist';
import { buildMediaGuideItems } from '@/lib/marketing-agency/media-guide';
import { restoreAssistLaunchStoryboards } from '@/lib/marketing-agency/storyboards';
import { buildRemotionStoryboardPlans } from '@/lib/marketing-agency/remotion/storyboard-plan';

describe('marketing agency media guide', () => {
  it('adds plain-English size guidance and logo labels for each storyboard', () => {
    const plans = buildRemotionStoryboardPlans(
      restoreAssistLaunchStoryboards,
      restoreAssistFixture.clientBrand
    );
    const items = buildMediaGuideItems(restoreAssistLaunchStoryboards, plans);

    expect(items).toHaveLength(restoreAssistLaunchStoryboards.length);
    expect(items.map(item => item.platformLogo)).toEqual(
      expect.arrayContaining(['LinkedIn', 'facebook'])
    );
    expect(items.find(item => item.storyboardId === 'linkedin-authority')).toEqual(
      expect.objectContaining({
        pixelSize: '1920 x 1080px',
        format: '16:9',
      })
    );
    expect(items.find(item => item.storyboardId === 'facebook-retargeting-15')).toEqual(
      expect.objectContaining({
        pixelSize: '720 x 1280px',
        format: '9:16',
      })
    );
    expect(items.every(item => item.plainEnglishUse && item.safeAreaNote)).toBe(true);
  });
});
