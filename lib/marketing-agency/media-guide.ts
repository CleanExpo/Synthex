import type { RemotionStoryboardPlan } from './remotion/storyboard-plan';
import type { CampaignStoryboard } from './types';

export interface MediaGuideItem {
  storyboardId: string;
  title: string;
  platform: 'linkedin' | 'facebook';
  platformLogo: 'LinkedIn' | 'facebook';
  format: CampaignStoryboard['primaryFormat'];
  pixelSize: string;
  durationLabel: string;
  plainEnglishUse: string;
  previewClass: string;
  safeAreaNote: string;
}

function getPlainEnglishUse(storyboard: CampaignStoryboard): string {
  if (storyboard.channel === 'linkedin' && storyboard.primaryFormat === '16:9') {
    return 'Wider professional video for desktop feeds, sales follow-up, and authority posts.';
  }

  if (storyboard.channel === 'linkedin' && storyboard.primaryFormat === '1:1') {
    return 'Square feed video that is easy to scan on mobile and desktop.';
  }

  if (storyboard.channel === 'linkedin') {
    return 'Tall mobile-first feed video for fast cold-audience testing.';
  }

  return 'Tall mobile-first video for Facebook feed, Reels-style placement, and retargeting.';
}

function getPreviewClass(format: CampaignStoryboard['primaryFormat']): string {
  if (format === '16:9') return 'aspect-video';
  if (format === '1:1') return 'aspect-square';
  if (format === '4:5') return 'aspect-[4/5]';
  return 'aspect-[9/16]';
}

function getSafeAreaNote(format: CampaignStoryboard['primaryFormat']): string {
  if (format === '16:9') {
    return 'Keep important text away from the bottom 12% for captions and player controls.';
  }

  if (format === '1:1') {
    return 'Keep CTA and logo inside the centre square so it survives feed cropping.';
  }

  return 'Keep logo, CTA, and captions inside the middle column so mobile overlays do not cover them.';
}

export function buildMediaGuideItems(
  storyboards: CampaignStoryboard[],
  plans: RemotionStoryboardPlan[]
): MediaGuideItem[] {
  return storyboards.map(storyboard => {
    const plan = plans.find(item => item.storyboardId === storyboard.id);
    const pixelSize = plan ? `${plan.width} x ${plan.height}px` : 'pending render size';

    return {
      storyboardId: storyboard.id,
      title: storyboard.title,
      platform: storyboard.channel === 'linkedin' ? 'linkedin' : 'facebook',
      platformLogo: storyboard.channel === 'linkedin' ? 'LinkedIn' : 'facebook',
      format: storyboard.primaryFormat,
      pixelSize,
      durationLabel: `${storyboard.durationSec}s`,
      plainEnglishUse: getPlainEnglishUse(storyboard),
      previewClass: getPreviewClass(storyboard.primaryFormat),
      safeAreaNote: getSafeAreaNote(storyboard.primaryFormat),
    };
  });
}
