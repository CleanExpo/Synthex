import type {
  BrandSquareProps,
  ExplainerVideoProps,
  SceneProps,
  SocialReelProps,
} from '@/lib/remotion/types';
import type { CampaignStoryboard, ClientBrandProfile } from '../types';

export interface RemotionStoryboardPlan {
  storyboardId: string;
  compositionId: 'ExplainerVideo' | 'SocialReel' | 'BrandSquare';
  width: number;
  height: number;
  fps: 30;
  durationInFrames: number;
  inputProps: ExplainerVideoProps | SocialReelProps | BrandSquareProps;
  voiceoverScript: string;
}

function toSceneProps(storyboard: CampaignStoryboard): SceneProps[] {
  return storyboard.scenes.map(scene => ({
    text: scene.onScreenText,
    subtitle: scene.visualNote,
    duration: (scene.endSec - scene.startSec) * 30,
  }));
}

function toVoiceoverScript(storyboard: CampaignStoryboard): string {
  return storyboard.scenes.map(scene => scene.voiceover).join('\n\n');
}

export function buildRemotionStoryboardPlan(
  storyboard: CampaignStoryboard,
  brand: ClientBrandProfile
): RemotionStoryboardPlan {
  const scenes = toSceneProps(storyboard);
  const voiceoverScript = toVoiceoverScript(storyboard);
  const durationInFrames = storyboard.durationSec * 30;

  if (storyboard.primaryFormat === '1:1') {
    return {
      storyboardId: storyboard.id,
      compositionId: 'BrandSquare',
      width: 1080,
      height: 1080,
      fps: 30,
      durationInFrames,
      voiceoverScript,
      inputProps: {
        title: brand.displayName,
        scenes,
        brandColour: brand.colors.accent,
        problem: storyboard.scenes[0]?.onScreenText ?? storyboard.title,
        solution: storyboard.strategy,
        ctaText: storyboard.callToAction,
      },
    };
  }

  if (storyboard.primaryFormat === '9:16') {
    return {
      storyboardId: storyboard.id,
      compositionId: 'SocialReel',
      width: 720,
      height: 1280,
      fps: 30,
      durationInFrames,
      voiceoverScript,
      inputProps: {
        title: storyboard.title,
        scenes,
        brandColour: brand.colors.primary,
        aspectRatio: '9:16',
        showProgress: true,
      },
    };
  }

  return {
    storyboardId: storyboard.id,
    compositionId: 'ExplainerVideo',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames,
    voiceoverScript,
    inputProps: {
      title: storyboard.title,
      scenes,
      brandColour: brand.colors.primary,
      transition: 'fade',
      voiceoverScript,
    },
  };
}

export function buildRemotionStoryboardPlans(
  storyboards: CampaignStoryboard[],
  brand: ClientBrandProfile
): RemotionStoryboardPlan[] {
  return storyboards.map(storyboard =>
    buildRemotionStoryboardPlan(storyboard, brand)
  );
}
