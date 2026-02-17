/**
 * Content Scoring Service
 *
 * @description Analyzes content and returns detailed quality metrics across
 * five dimensions without modifying the content. All scoring is done via
 * pure functions with no AI calls, enabling real-time use.
 *
 * Dimensions scored (0-100 each):
 * - readability:   Flesch-Kincaid approximation for social content
 * - engagement:    Hook presence, questions, emojis, CTAs, conversation starters
 * - platformFit:   Character limits, formatting patterns per platform
 * - clarity:       Jargon, passive voice, specificity
 * - emotional:     Sentiment strength, power words, urgency, storytelling
 *
 * Overall = weighted average (engagement 30%, readability 25%, platformFit 20%,
 *           clarity 15%, emotional 10%)
 *
 * @module lib/ai/content-scorer
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Score result for a single scoring dimension.
 */
export interface DimensionScore {
  /** Normalized score 0-100 */
  score: number;
  /** Problems detected in the content */
  issues: string[];
  /** Actionable improvement suggestions */
  suggestions: string[];
}

/**
 * Full scoring result returned by ContentScorer.score().
 */
export interface ScoreResult {
  /** Weighted overall score 0-100 */
  overall: number;
  /** Per-dimension breakdowns */
  dimensions: {
    readability: DimensionScore;
    engagement: DimensionScore;
    platformFit: DimensionScore;
    clarity: DimensionScore;
    emotional: DimensionScore;
  };
  /** Top 3 highest-impact suggestions across all dimensions */
  topSuggestions: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Character limits per platform */
const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  facebook: 63206,
  youtube: 5000,
  pinterest: 500,
  reddit: 40000,
  threads: 500,
};

/** Scoring dimension weights — must sum to 1.0 */
const DIMENSION_WEIGHTS = {
  engagement: 0.30,
  readability: 0.25,
  platformFit: 0.20,
  clarity: 0.15,
  emotional: 0.10,
} as const;

/** Words that suggest vagueness or lack of specificity */
const VAGUE_WORDS = [
  'things', 'stuff', 'nice', 'good', 'bad', 'great', 'very', 'really',
  'basically', 'literally', 'actually', 'kind of', 'sort of', 'a lot',
  'many', 'some', 'various', 'several', 'etc', 'and so on',
];

/** Common jargon patterns */
const JARGON_PATTERNS = [
  /\b(synergy|leverage|paradigm|disruptive|pivot|agile|scalable|bandwidth|circle back|touch base|move the needle|low-hanging fruit|boil the ocean|deep dive|drill down|takeaway|learnings|optics|unpack|holistic|ecosystem|stakeholder|deliverable)\b/gi,
];

/** Passive voice indicator phrases */
const PASSIVE_VOICE_PATTERNS = [
  /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+ed\b/gi,
  /\b(has|have|had)\s+been\s+\w+ed\b/gi,
];

/** Power words that drive emotional response */
const POWER_WORDS = [
  'secret', 'proven', 'exclusive', 'guaranteed', 'instantly', 'free',
  'new', 'now', 'announcing', 'discover', 'results', 'easy', 'save',
  'transform', 'breakthrough', 'ultimate', 'powerful', 'massive', 'critical',
  'urgent', 'limited', 'rare', 'revolutionary', 'shocking', 'incredible',
];

/** Urgency cues */
const URGENCY_PATTERNS = [
  /\b(today|now|immediately|hurry|limited|last chance|deadline|expires|don't miss|act fast|only \d+)\b/i,
];

/** Storytelling elements */
const STORYTELLING_PATTERNS = [
  /\b(i (was|were|had|used to|remember|once)|when i|story|journey|experience|ago|years? ago|moment|turning point)\b/i,
];

/** Hook patterns that signal engaging openings */
const HOOK_PATTERNS = [
  /^(here's|the truth|stop|i made|unpopular|hot take|this changed|the secret|most people|3 things)/i,
  /^[\u{1F300}-\u{1F9FF}]/u,
  /^\d+ (things|tips|ways|reasons|mistakes)/i,
];

/** CTA patterns */
const CTA_PATTERNS = [
  /comment|share|follow|like|save|click|tap|swipe|link|dm|message/i,
  /👇|⬇️|🔗|📲|💬|🙋/,
  /what do you think|let me know|tell me|your thoughts/i,
];

// ============================================================================
// PURE HELPER FUNCTIONS
// ============================================================================

/** Returns true if the content contains emoji characters. */
function hasEmojis(content: string): boolean {
  return /[\u{1F300}-\u{1F9FF}]/u.test(content);
}

/** Returns true if the content contains hashtags. */
function hasHashtags(content: string): boolean {
  return /#\w+/.test(content);
}

/** Returns true if the content contains a recognizable CTA. */
function hasCTA(content: string): boolean {
  return CTA_PATTERNS.some((pattern) => pattern.test(content));
}

/** Returns true if the content starts with a recognised hook pattern. */
function startsWithHook(content: string): boolean {
  return HOOK_PATTERNS.some((pattern) => pattern.test(content.trim()));
}

/** Counts pattern matches in text, handling global flags correctly. */
function countMatches(text: string, pattern: RegExp): number {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  return (text.match(re) ?? []).length;
}

/** Splits text into sentences using common delimiters. */
function splitSentences(text: string): string[] {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
}

/** Splits text into words. */
function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.trim().length > 0);
}

/** Clamps a value to [0, 100]. */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ============================================================================
// SCORING DIMENSION FUNCTIONS
// ============================================================================

/**
 * Scores readability using a Flesch-Kincaid-inspired heuristic adapted for
 * short-form social content. Rewards short sentences, short words,
 * paragraph breaks, and list usage.
 */
function scoreReadability(content: string): DimensionScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 60; // Baseline

  const words = splitWords(content);
  const sentences = splitSentences(content);
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);

  // Average sentence length (words per sentence)
  const avgSentenceLength = wordCount / sentenceCount;
  if (avgSentenceLength > 25) {
    score -= 15;
    issues.push('Sentences are too long on average');
    suggestions.push('Break long sentences into shorter ones (aim for under 20 words per sentence)');
  } else if (avgSentenceLength > 15) {
    score -= 5;
    suggestions.push('Consider shortening some sentences for easier scanning');
  } else {
    score += 10; // Short sentences bonus
  }

  // Average word length (chars per word, excluding punctuation)
  const cleanWords = words.map((w) => w.replace(/[^a-zA-Z]/g, ''));
  const totalWordChars = cleanWords.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = wordCount > 0 ? totalWordChars / wordCount : 0;
  if (avgWordLength > 6) {
    score -= 10;
    issues.push('Word complexity is high');
    suggestions.push('Replace complex words with simpler alternatives for better readability');
  } else if (avgWordLength <= 4.5) {
    score += 5;
  }

  // Paragraph breaks (double newlines) reward skimmability
  const paragraphCount = (content.match(/\n\n+/g) ?? []).length;
  if (paragraphCount > 0) {
    score += Math.min(paragraphCount * 5, 15);
  } else if (wordCount > 60) {
    issues.push('No paragraph breaks found');
    suggestions.push('Add blank lines between paragraphs to improve readability');
  }

  // List usage (lines starting with - or * or numbers)
  const listLines = (content.match(/^(\s*[-*•]|\d+[.)]\s)/gm) ?? []).length;
  if (listLines >= 3) {
    score += 10;
  } else if (wordCount > 80 && listLines === 0) {
    suggestions.push('Consider using a bullet list for key points');
  }

  // Very short content penalised slightly for context
  if (wordCount < 5) {
    score -= 10;
    issues.push('Content is very short — context may be missing');
  }

  return { score: clamp(score), issues, suggestions };
}

/**
 * Scores engagement potential based on hook presence, question usage,
 * emoji usage, CTA strength, and conversation starters.
 */
function scoreEngagement(content: string): DimensionScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 40; // Baseline

  // Hook presence
  if (startsWithHook(content)) {
    score += 20;
  } else {
    issues.push('Content does not start with an engaging hook');
    suggestions.push('Open with a hook: a bold claim, surprising statistic, or compelling question');
  }

  // Question usage
  const questionCount = (content.match(/\?/g) ?? []).length;
  if (questionCount >= 1) {
    score += 15;
  } else {
    suggestions.push('Add a question to invite audience interaction and boost comments');
  }

  // Emoji usage
  if (hasEmojis(content)) {
    score += 10;
  } else {
    suggestions.push('Add 1-2 relevant emojis to increase visual appeal and reach');
  }

  // CTA presence
  if (hasCTA(content)) {
    score += 15;
  } else {
    issues.push('No clear call-to-action detected');
    suggestions.push('Include a CTA (e.g., "What do you think?", "Share this with someone who needs it")');
  }

  // Conversation starter words
  const conversationWords = /\b(agree|disagree|thoughts|opinion|experience|ever|you|your|we|our)\b/gi;
  const conversationCount = countMatches(content, conversationWords);
  if (conversationCount >= 3) {
    score += 10;
  } else if (conversationCount === 0) {
    suggestions.push('Use "you/your" language to speak directly to the reader');
  }

  // Hashtags boost discoverability
  if (hasHashtags(content)) {
    score += 5;
  }

  return { score: clamp(score), issues, suggestions };
}

/**
 * Scores how well the content fits the target platform based on character
 * count vs platform limit, formatting patterns, and platform-specific
 * elements (LinkedIn line breaks, Twitter thread potential, Instagram
 * hashtag density).
 */
function scorePlatformFit(content: string, platform: string): DimensionScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 50; // Baseline

  const limit = PLATFORM_LIMITS[platform] ?? 2200;
  const length = content.length;
  const lengthRatio = length / limit;

  // Character count scoring
  if (length === 0) {
    return { score: 0, issues: ['Content is empty'], suggestions: [] };
  }

  if (length > limit) {
    score -= 30;
    issues.push(`Content exceeds ${platform} character limit (${length}/${limit})`);
    suggestions.push(`Trim content to under ${limit} characters for ${platform}`);
  } else if (lengthRatio < 0.1) {
    score -= 10;
    issues.push('Content is very short for this platform');
    suggestions.push(`Expand content — ${platform} posts perform better with more substance`);
  } else if (lengthRatio >= 0.3 && lengthRatio <= 0.8) {
    score += 20; // Sweet spot
  } else if (lengthRatio > 0.9 && lengthRatio <= 1.0) {
    score += 5;
    suggestions.push('Content is near the character limit — verify it stays within bounds after edits');
  }

  // Platform-specific formatting checks
  switch (platform) {
    case 'linkedin': {
      // LinkedIn rewards line breaks for readability
      const hasLineBreaks = /\n\n/.test(content);
      if (hasLineBreaks) {
        score += 15;
      } else if (length > 300) {
        issues.push('LinkedIn posts without paragraph breaks have lower reach');
        suggestions.push('Add blank lines between paragraphs for LinkedIn\'s algorithm');
      }
      // LinkedIn rewards low hashtag counts (2-5 optimal)
      const hashtagCount = (content.match(/#\w+/g) ?? []).length;
      if (hashtagCount > 10) {
        score -= 10;
        issues.push('Too many hashtags for LinkedIn (optimal: 2-5)');
        suggestions.push('Reduce hashtags to 2-5 highly relevant ones for LinkedIn');
      } else if (hashtagCount >= 2 && hashtagCount <= 5) {
        score += 5;
      }
      break;
    }

    case 'twitter':
    case 'threads': {
      // Thread potential for longer content
      if (length > 200) {
        suggestions.push('Consider breaking into a thread for longer content');
        score += 5; // Threads are still valid
      }
      // Twitter-specific: emojis and short punchy sentences
      if (!hasEmojis(content) && platform === 'twitter') {
        suggestions.push('Emojis boost Twitter engagement and expand visual presence');
      }
      break;
    }

    case 'instagram': {
      // Instagram optimal hashtag density: 5-15
      const igHashtags = (content.match(/#\w+/g) ?? []).length;
      if (igHashtags >= 5 && igHashtags <= 15) {
        score += 10;
      } else if (igHashtags === 0) {
        issues.push('Instagram posts without hashtags have lower discovery');
        suggestions.push('Add 5-15 relevant hashtags for Instagram discoverability');
      } else if (igHashtags > 20) {
        score -= 5;
        issues.push('Too many hashtags on Instagram can appear spammy (optimal: 5-15)');
      }
      break;
    }

    case 'tiktok': {
      // TikTok short-form — rewards hooks and trending references
      if (!startsWithHook(content)) {
        suggestions.push('TikTok captions convert better with a strong first line hook');
      }
      const tiktokTags = (content.match(/#\w+/g) ?? []).length;
      if (tiktokTags < 3) {
        suggestions.push('Use 3-5 trending hashtags on TikTok (#fyp, #foryou, plus niche tags)');
      }
      break;
    }

    case 'youtube': {
      // YouTube descriptions benefit from keyword-rich paragraphs
      if (length < 200) {
        issues.push('YouTube descriptions work best with at least 200 characters');
        suggestions.push('Expand the YouTube description with keywords and links');
      }
      break;
    }

    case 'pinterest': {
      // Pinterest: keyword-rich, action-oriented
      if (length < 50) {
        suggestions.push('Add more descriptive text to improve Pinterest SEO');
      }
      break;
    }

    case 'reddit': {
      // Reddit rewards longer, substantive posts
      if (length < 100) {
        suggestions.push('Reddit posts with more context and detail receive more upvotes');
      }
      break;
    }

    case 'facebook': {
      // Facebook: mid-length storytelling performs well
      if (lengthRatio < 0.005 && length < 250) {
        suggestions.push('Facebook posts with 250-500 characters tend to get better organic reach');
      }
      break;
    }
  }

  return { score: clamp(score), issues, suggestions };
}

/**
 * Scores clarity by detecting jargon, passive voice ratio, and vague
 * word usage. Higher scores indicate clearer, more direct writing.
 */
function scoreClarity(content: string): DimensionScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 70; // Baseline — most content starts reasonably clear

  const words = splitWords(content);
  const wordCount = Math.max(words.length, 1);

  // Jargon detection
  const jargonMatches = JARGON_PATTERNS.flatMap((pattern) => {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    return content.match(re) ?? [];
  });
  const jargonCount = jargonMatches.length;
  if (jargonCount > 0) {
    score -= Math.min(jargonCount * 5, 25);
    issues.push(`${jargonCount} jargon word(s) detected: ${[...new Set(jargonMatches.map((m) => m.toLowerCase()))].slice(0, 3).join(', ')}`);
    suggestions.push('Replace jargon with plain language that everyone can understand');
  }

  // Passive voice ratio
  const passiveMatches = PASSIVE_VOICE_PATTERNS.flatMap((pattern) => {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    return content.match(re) ?? [];
  });
  const passiveCount = passiveMatches.length;
  const sentences = splitSentences(content);
  const sentenceCount = Math.max(sentences.length, 1);
  const passiveRatio = passiveCount / sentenceCount;

  if (passiveRatio > 0.4) {
    score -= 20;
    issues.push('High passive voice ratio — content feels indirect');
    suggestions.push('Rewrite passive sentences in active voice for stronger impact');
  } else if (passiveRatio > 0.2) {
    score -= 10;
    suggestions.push('Reduce passive voice for a more direct, engaging tone');
  }

  // Vague word detection
  const contentLower = content.toLowerCase();
  const vagueFound = VAGUE_WORDS.filter((word) => {
    const pattern = new RegExp(`\\b${word.replace(' ', '\\s+')}\\b`, 'i');
    return pattern.test(contentLower);
  });
  const vagueCount = vagueFound.length;

  if (vagueCount > 3) {
    score -= 15;
    issues.push(`${vagueCount} vague words found: ${vagueFound.slice(0, 3).join(', ')}...`);
    suggestions.push('Replace vague words (things, stuff, nice) with specific, concrete language');
  } else if (vagueCount > 1) {
    score -= 5;
    suggestions.push(`Replace vague words like "${vagueFound[0]}" with more specific alternatives`);
  }

  // Specificity bonus — numbers and data points signal precision
  const numberCount = (content.match(/\b\d+([.,]\d+)?(%|\s*(x|times|percent|million|billion|thousand))?\b/g) ?? []).length;
  if (numberCount >= 2) {
    score += 10;
  } else if (numberCount === 0 && wordCount > 30) {
    suggestions.push('Include specific numbers or data points to increase credibility');
  }

  return { score: clamp(score), issues, suggestions };
}

/**
 * Scores emotional resonance based on sentiment strength, power words,
 * urgency cues, and storytelling elements.
 */
function scoreEmotional(content: string): DimensionScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 40; // Baseline

  // Power words presence
  const contentLower = content.toLowerCase();
  const powerWordsFound = POWER_WORDS.filter((word) => contentLower.includes(word));
  const powerWordCount = powerWordsFound.length;

  if (powerWordCount >= 3) {
    score += 20;
  } else if (powerWordCount >= 1) {
    score += 10;
  } else {
    suggestions.push('Add power words (proven, discover, transform, breakthrough) to increase emotional impact');
  }

  // Urgency cues
  if (URGENCY_PATTERNS.some((p) => p.test(content))) {
    score += 15;
  } else {
    suggestions.push('Add a sense of urgency or timeliness to motivate action');
  }

  // Storytelling elements
  if (STORYTELLING_PATTERNS.some((p) => p.test(content))) {
    score += 20;
  } else {
    suggestions.push('Open with a personal story or experience to build emotional connection');
  }

  // Sentiment strength — exclamation points and strong adjectives
  const exclamationCount = (content.match(/!/g) ?? []).length;
  if (exclamationCount >= 1 && exclamationCount <= 3) {
    score += 5;
  } else if (exclamationCount > 5) {
    score -= 5;
    issues.push('Excessive exclamation points reduce credibility');
    suggestions.push('Use no more than 1-2 exclamation points per post');
  }

  // Negative emotional hooks (frustration, problem-aware content)
  const negativeHooks = /\b(frustrat|struggling|problem|challenge|mistake|fail|wrong|stop|warning)\b/gi;
  const negativeCount = countMatches(content, negativeHooks);
  if (negativeCount >= 1) {
    score += 5; // Pain-aware content resonates
  }

  // Positive outcome references
  const positiveOutcome = /\b(success|result|growth|win|achieve|transform|improve|better|breakthrough)\b/gi;
  const positiveCount = countMatches(content, positiveOutcome);
  if (positiveCount >= 1) {
    score += 5;
  }

  return { score: clamp(score), issues, suggestions };
}

// ============================================================================
// CONTENT SCORER CLASS
// ============================================================================

/**
 * ContentScorer analyzes content and returns detailed quality metrics.
 * All operations are pure and synchronous — no AI calls, no side effects.
 *
 * @example
 * const result = contentScorer.score('Your content here', 'linkedin');
 * console.log(result.overall);         // e.g., 72
 * console.log(result.topSuggestions);  // ["Add a hook...", ...]
 */
export class ContentScorer {
  /**
   * Scores the given content against a target platform and returns a
   * comprehensive ScoreResult including per-dimension breakdowns and
   * prioritized suggestions.
   *
   * @param content  - The raw content string to evaluate
   * @param platform - Target platform key (defaults to 'linkedin')
   * @returns        ScoreResult with overall score and dimension details
   */
  score(content: string, platform: string = 'linkedin'): ScoreResult {
    const normalizedPlatform = platform.toLowerCase();

    // Compute all dimensions
    const readability = scoreReadability(content);
    const engagement = scoreEngagement(content);
    const platformFit = scorePlatformFit(content, normalizedPlatform);
    const clarity = scoreClarity(content);
    const emotional = scoreEmotional(content);

    // Weighted overall score
    const overall = clamp(
      engagement.score * DIMENSION_WEIGHTS.engagement +
      readability.score * DIMENSION_WEIGHTS.readability +
      platformFit.score * DIMENSION_WEIGHTS.platformFit +
      clarity.score * DIMENSION_WEIGHTS.clarity +
      emotional.score * DIMENSION_WEIGHTS.emotional
    );

    // Collect all suggestions with their dimension scores for prioritization
    type SuggestionEntry = { text: string; dimensionScore: number };
    const allSuggestions: SuggestionEntry[] = [
      ...engagement.suggestions.map((text) => ({ text, dimensionScore: engagement.score })),
      ...readability.suggestions.map((text) => ({ text, dimensionScore: readability.score })),
      ...platformFit.suggestions.map((text) => ({ text, dimensionScore: platformFit.score })),
      ...clarity.suggestions.map((text) => ({ text, dimensionScore: clarity.score })),
      ...emotional.suggestions.map((text) => ({ text, dimensionScore: emotional.score })),
    ];

    // Prioritize suggestions from lowest-scoring dimensions (most impact)
    const topSuggestions = allSuggestions
      .sort((a, b) => a.dimensionScore - b.dimensionScore)
      .slice(0, 3)
      .map((s) => s.text);

    return {
      overall,
      dimensions: {
        readability,
        engagement,
        platformFit,
        clarity,
        emotional,
      },
      topSuggestions,
    };
  }
}

/** Singleton instance for use across the application. */
export const contentScorer = new ContentScorer();
