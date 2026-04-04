/**
 * PR Distribution Channels Registry (Phase 93)
 *
 * Static registry of free press release distribution channels.
 * Channels marked requiresManualSubmission=true show instructions + links
 * to the user; the platform does not auto-submit on their behalf.
 *
 * @module lib/pr/distribution-channels
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionChannel {
  /** Unique identifier used as the `channel` field in PRDistribution records */
  id: string;
  /** Human-readable channel name */
  name: string;
  /** Channel homepage URL */
  url: string;
  /** Direct submission page URL */
  submissionUrl: string;
  /** Whether the channel offers a free submission tier */
  isFree: boolean;
  /**
   * If true: Synthex shows instructions + a link so the user can submit manually.
   * If false: Synthex can handle submission automatically (e.g. self-hosted newsroom).
   */
  requiresManualSubmission: boolean;
  /** Instructions shown to the user for manual channels */
  instructions: string;
}

// ---------------------------------------------------------------------------
// Channel registry
// ---------------------------------------------------------------------------

export const DISTRIBUTION_CHANNELS: DistributionChannel[] = [
  {
    id: 'self-hosted',
    name: 'Self-Hosted Newsroom',
    url: '',
    submissionUrl: '',
    isFree: true,
    requiresManualSubmission: false,
    instructions: 'Published to your public newsroom automatically. A canonical URL is created at your newsroom domain.',
  },
  {
    id: 'pr-com',
    name: 'PR.com',
    url: 'https://www.pr.com',
    submissionUrl: 'https://www.pr.com/submit-press-release',
    isFree: true,
    requiresManualSubmission: true,
    instructions:
      'Visit PR.com and paste your press release into their free submission form. PR.com is indexed by Google News and reaches business journalists directly.',
  },
  {
    id: 'openpr',
    name: 'OpenPR',
    url: 'https://www.openpr.com',
    submissionUrl: 'https://www.openpr.com/add-press-release.htm',
    isFree: true,
    requiresManualSubmission: true,
    instructions:
      'Register a free account at OpenPR, then paste your press release. OpenPR distributes to news aggregators and is crawled by AI search engines including Perplexity.',
  },
  {
    id: 'prlog',
    name: 'PRLog',
    url: 'https://www.prlog.org',
    submissionUrl: 'https://www.prlog.org/login',
    isFree: true,
    requiresManualSubmission: true,
    instructions:
      'Create a free PRLog account and submit your press release. PRLog is indexed by Google, Bing, and news aggregators. Your release will receive a permanent URL.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a channel by its id.
 * Returns undefined if the id is not recognised.
 */
export function getChannel(id: string): DistributionChannel | undefined {
  return DISTRIBUTION_CHANNELS.find((c) => c.id === id);
}

/**
 * Return only channels that are available for free.
 */
export function getFreeChannels(): DistributionChannel[] {
  return DISTRIBUTION_CHANNELS.filter((c) => c.isFree);
}
