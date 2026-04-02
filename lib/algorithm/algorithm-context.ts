/**
 * lib/algorithm/algorithm-context.ts
 *
 * Provides a concise algorithm intelligence context block for injection into
 * the AI Advisor synthesis prompt. Summarises the top-weighted, CONFIRMED or
 * LEAKED signals per platform so the Advisor can ground its recommendations
 * in verified algorithm intelligence without an extra DB round-trip.
 *
 * Plain-English translations are used throughout — raw signal names (NavBoost,
 * sends_per_reach, etc.) are NEVER returned to client-facing output.
 *
 * @task SYN-604
 */

export interface PlatformSignalSummary {
  platform: string;
  surface: string;
  topSignals: {
    plainEnglish: string;
    confidenceLevel: 'CONFIRMED' | 'LEAKED' | 'INFERRED';
    weightTier: 'critical' | 'strong' | 'moderate';
    implication: string;
  }[];
}

/** Pre-compiled signal summaries derived from the algorithm-knowledge-base reference files. */
const PLATFORM_SIGNALS: PlatformSignalSummary[] = [
  {
    platform: 'google_search',
    surface: 'web',
    topSignals: [
      {
        plainEnglish: 'Google tracks whether visitors stay on your page or go back to search',
        confidenceLevel: 'LEAKED',
        weightTier: 'critical',
        implication: 'Page titles and descriptions that accurately match intent reduce bounce-backs',
      },
      {
        plainEnglish: 'Whether your content adds something not found on competing pages',
        confidenceLevel: 'LEAKED',
        weightTier: 'strong',
        implication: 'Add original data, case studies, or first-person insights',
      },
      {
        plainEnglish: 'How fast your website loads and responds for real visitors',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'strong',
        implication: 'LCP < 2.5s, INP < 200ms — failing these on mobile is a ranking penalty',
      },
      {
        plainEnglish: 'Whether your content is seen as written by someone with real expertise',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'strong',
        implication: 'Named authors, credentials, and cited sources improve trust signals',
      },
    ],
  },
  {
    platform: 'instagram',
    surface: 'reels',
    topSignals: [
      {
        plainEnglish: 'How often people share your Reels in direct messages to friends',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'critical',
        implication: 'Content designed to make people say "send this to someone" outperforms content that only gets likes',
      },
      {
        plainEnglish: 'How long people watch your video before stopping',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'critical',
        implication: 'Hook in first 3 seconds; under 30s videos achieve higher completion rates',
      },
      {
        plainEnglish: 'When people save your post to come back to later',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'strong',
        implication: 'Educational, reference, or aspirational content earns saves',
      },
    ],
  },
  {
    platform: 'instagram',
    surface: 'feed',
    topSignals: [
      {
        plainEnglish: 'History of interactions between this account and each follower',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'critical',
        implication: 'Reply to every comment — each reply strengthens the relationship signal',
      },
      {
        plainEnglish: 'How relevant the content is to each individual user\'s interests',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'critical',
        implication: 'Consistent topic focus helps Instagram learn who to show your posts to',
      },
    ],
  },
  {
    platform: 'linkedin',
    surface: 'feed',
    topSignals: [
      {
        plainEnglish: 'Whether people click "see more" to read your full post',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'critical',
        implication: 'First 2–3 lines visible in feed must be compelling enough to earn the expand click',
      },
      {
        plainEnglish: 'How much engagement your post gets in the first 60–90 minutes',
        confidenceLevel: 'CONFIRMED',
        weightTier: 'critical',
        implication: 'Post when your audience is most active; reply to comments immediately after publishing',
      },
      {
        plainEnglish: 'Posts containing links to external websites get reduced reach',
        confidenceLevel: 'INFERRED',
        weightTier: 'strong',
        implication: 'Put external links in the first comment, not the post body',
      },
    ],
  },
];

/**
 * Returns a compact algorithm context block for injection into the Advisor
 * synthesis prompt. Scoped to the platforms provided (defaults to all).
 */
export function getAlgorithmContextBlock(platforms?: string[]): string {
  const filtered = platforms?.length
    ? PLATFORM_SIGNALS.filter(p => platforms.includes(p.platform))
    : PLATFORM_SIGNALS;

  if (filtered.length === 0) return '';

  const lines: string[] = [
    '--- ALGORITHM INTELLIGENCE CONTEXT ---',
    'Use these verified platform algorithm signals when making content recommendations.',
    'CRITICAL: All algorithm signals in client-facing recommendations MUST use plain-English',
    'descriptions — never expose raw signal names (NavBoost, sends_per_reach, CrUX, etc.).',
    '',
  ];

  for (const platform of filtered) {
    lines.push(`${platform.platform.replace('_', ' ').toUpperCase()} — ${platform.surface}:`);
    for (const signal of platform.topSignals) {
      const confidence = signal.confidenceLevel === 'CONFIRMED'
        ? 'platform confirmed'
        : signal.confidenceLevel === 'LEAKED'
          ? 'from verified platform documents'
          : 'based on observed patterns';
      lines.push(`  • ${signal.plainEnglish} (${confidence}, ${signal.weightTier} impact)`);
      lines.push(`    → ${signal.implication}`);
    }
    lines.push('');
  }

  lines.push('--- END ALGORITHM CONTEXT ---');

  return lines.join('\n');
}

/**
 * Returns the plain-English translation for a given raw signal name.
 * Returns the signal name unchanged if no translation is found.
 */
export function translateSignal(rawSignalName: string, platform: string): string {
  // Find matching signal across all platforms
  const platformData = PLATFORM_SIGNALS.find(p => p.platform === platform);
  if (!platformData) return rawSignalName;

  const signal = platformData.topSignals.find(
    s => s.plainEnglish.toLowerCase().includes(rawSignalName.toLowerCase())
  );

  return signal?.plainEnglish ?? rawSignalName;
}
