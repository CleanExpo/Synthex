/**
 * Marketing Agency — Artlist asset-need detection.
 *
 * Pure, side-effect-free heuristic used by the agent runner (SYN-979) to decide
 * whether an opportunity's recommended creative requires a licensed audio/video
 * asset. Kept as its own module so it can be unit-tested without any prisma or
 * network dependency.
 *
 * The runner licenses a background AUDIO track via Artlist whenever an
 * opportunity calls for audio OR video creative (a video still needs a scored
 * soundtrack). The detected surface (audio vs. video) is preserved in
 * `assetType` for auditability.
 */

export interface AssetNeedInput {
  title: string;
  recommendation: string;
  nextAction?: string;
}

export interface AssetNeed {
  needsAsset: boolean;
  /** The creative surface that triggered the need. */
  assetType: 'audio' | 'video';
  /** Mood hint passed to the Artlist audio recommender. */
  mood: string;
  /** Requested track length in seconds. */
  durationSec: number;
  /** The keyword that triggered detection (null when no need). */
  matchedKeyword: string | null;
}

const VIDEO_KEYWORDS = [
  'video',
  'reel',
  'short',
  'shorts',
  'youtube',
  'tiktok',
  'clip',
  'motion',
  'animation',
  'animated',
  'commercial',
  'ad spot',
  'trailer',
  'explainer',
];

const AUDIO_KEYWORDS = [
  'audio',
  'music',
  'soundtrack',
  'song',
  'track',
  'voiceover',
  'voice-over',
  'voice over',
  'jingle',
  'podcast',
  'score',
  'sound design',
];

const MOOD_KEYWORDS: Array<{ keyword: string; mood: string }> = [
  { keyword: 'urgent', mood: 'urgent' },
  { keyword: 'emergency', mood: 'urgent' },
  { keyword: 'calm', mood: 'calm' },
  { keyword: 'reassur', mood: 'calm reassuring' },
  { keyword: 'trust', mood: 'calm reassuring' },
  { keyword: 'energetic', mood: 'energetic' },
  { keyword: 'upbeat', mood: 'energetic' },
  { keyword: 'inspir', mood: 'uplifting' },
  { keyword: 'uplift', mood: 'uplifting' },
  { keyword: 'professional', mood: 'confident corporate' },
];

const DEFAULT_MOOD = 'confident corporate';
const DEFAULT_DURATION_SEC = 30;

function firstMatch(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    if (haystack.includes(n)) return n;
  }
  return null;
}

function deriveMood(haystack: string): string {
  for (const { keyword, mood } of MOOD_KEYWORDS) {
    if (haystack.includes(keyword)) return mood;
  }
  return DEFAULT_MOOD;
}

/**
 * Returns whether the opportunity's creative direction implies a licensed
 * audio/video asset, and (if so) the parameters to request it.
 */
export function detectAssetNeed(input: AssetNeedInput): AssetNeed {
  const haystack = [input.title, input.recommendation, input.nextAction ?? '']
    .join(' \n ')
    .toLowerCase();

  // Video takes precedence: a video need also implies an audio track, but we
  // record the higher-level surface for auditability.
  const videoMatch = firstMatch(haystack, VIDEO_KEYWORDS);
  const audioMatch = videoMatch ? null : firstMatch(haystack, AUDIO_KEYWORDS);
  const matchedKeyword = videoMatch ?? audioMatch;

  if (!matchedKeyword) {
    return {
      needsAsset: false,
      assetType: 'audio',
      mood: DEFAULT_MOOD,
      durationSec: DEFAULT_DURATION_SEC,
      matchedKeyword: null,
    };
  }

  return {
    needsAsset: true,
    assetType: videoMatch ? 'video' : 'audio',
    mood: deriveMood(haystack),
    durationSec: DEFAULT_DURATION_SEC,
    matchedKeyword,
  };
}
