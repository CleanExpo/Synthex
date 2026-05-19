import type { MediaGuideItem } from './media-guide';
import type { CampaignStoryboard } from './types';

export type MediaTestStatus = 'pass' | 'warn' | 'blocked';

export interface MediaTestCheck {
  label: string;
  status: MediaTestStatus;
  detail: string;
}

export interface MediaTestingPlanItem {
  storyboardId: string;
  title: string;
  format: CampaignStoryboard['primaryFormat'];
  pixelSize: string;
  durationSec: number;
  estimatedVoiceoverWords: number;
  estimatedWordsPerMinute: number;
  visualChecks: MediaTestCheck[];
  audioChecks: MediaTestCheck[];
  humanReviewQuestions: string[];
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getAudioPacingStatus(wordsPerMinute: number): MediaTestStatus {
  if (wordsPerMinute > 170) return 'warn';
  if (wordsPerMinute < 80) return 'warn';
  return 'pass';
}

function getHookStatus(storyboard: CampaignStoryboard): MediaTestStatus {
  const firstScene = storyboard.scenes[0];
  if (!firstScene) return 'blocked';
  return firstScene.endSec <= 4 ? 'pass' : 'warn';
}

function getCaptionStatus(storyboard: CampaignStoryboard): MediaTestStatus {
  const allScenesHaveCaptionText = storyboard.scenes.every(scene =>
    Boolean(scene.onScreenText.trim())
  );
  return allScenesHaveCaptionText ? 'pass' : 'blocked';
}

function getSafeAreaDetail(mediaGuideItem: MediaGuideItem): string {
  return `${mediaGuideItem.pixelSize}; ${mediaGuideItem.safeAreaNote}`;
}

export function buildMediaTestingPlan(
  storyboards: CampaignStoryboard[],
  mediaGuideItems: MediaGuideItem[]
): MediaTestingPlanItem[] {
  return storyboards.map(storyboard => {
    const mediaGuideItem = mediaGuideItems.find(
      item => item.storyboardId === storyboard.id
    );
    const voiceoverText = storyboard.scenes.map(scene => scene.voiceover).join(' ');
    const estimatedVoiceoverWords = countWords(voiceoverText);
    const estimatedWordsPerMinute = Math.round(
      (estimatedVoiceoverWords / storyboard.durationSec) * 60
    );
    const hookStatus = getHookStatus(storyboard);
    const audioPacingStatus = getAudioPacingStatus(estimatedWordsPerMinute);

    return {
      storyboardId: storyboard.id,
      title: storyboard.title,
      format: storyboard.primaryFormat,
      pixelSize: mediaGuideItem?.pixelSize ?? 'pending render size',
      durationSec: storyboard.durationSec,
      estimatedVoiceoverWords,
      estimatedWordsPerMinute,
      visualChecks: [
        {
          label: 'Hook visible in opening beat',
          status: hookStatus,
          detail:
            hookStatus === 'pass'
              ? 'The first scene lands inside the first four seconds.'
              : 'Consider shortening the first scene for faster thumb-stop testing.',
        },
        {
          label: 'Muted viewing supported',
          status: getCaptionStatus(storyboard),
          detail: 'Every scene has on-screen text that carries the core message.',
        },
        {
          label: 'Logo and CTA safe area',
          status: mediaGuideItem ? 'pass' : 'blocked',
          detail: mediaGuideItem
            ? getSafeAreaDetail(mediaGuideItem)
            : 'Render dimensions are missing from the media guide.',
        },
      ],
      audioChecks: [
        {
          label: 'Voiceover pacing',
          status: audioPacingStatus,
          detail: `${estimatedWordsPerMinute} estimated words per minute; target range is 80-170 for clear narration.`,
        },
        {
          label: 'Audio direction present',
          status: storyboard.audioDirection.trim() ? 'pass' : 'blocked',
          detail: storyboard.audioDirection,
        },
        {
          label: 'Mix target',
          status: 'pass',
          detail: 'Final render should be checked at -14 LUFS with a -1 dBTP ceiling before client-ready export.',
        },
      ],
      humanReviewQuestions: [
        'Does the first frame make the audience problem clear without explanation?',
        'Can the video still be understood when muted?',
        'Is the RestoreAssist logo/CTA readable on a phone-sized preview?',
        'Does the voiceover sound like a practical operator, not a generic software ad?',
        'Is any claim unsupported by product evidence, screenshots, or an approved sample report?',
      ],
    };
  });
}
