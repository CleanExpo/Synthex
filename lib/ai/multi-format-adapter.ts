/**
 * Multi-Format Content Adapter Service
 *
 * @description Takes a single piece of content and generates platform-specific
 * variations for all 9 supported platforms. Uses AI for intelligent adaptation
 * and ContentScorer for quality scoring.
 *
 * Supported platforms (9): twitter, linkedin, instagram, tiktok, facebook,
 * youtube, pinterest, reddit, threads
 *
 * @module lib/ai/multi-format-adapter
 */

import { getAIProvider } from '@/lib/ai/providers';
import type { AIProvider } from '@/lib/ai/providers';
import { contentScorer } from '@/lib/ai/content-scorer';

// ============================================================================
// TYPES
// ============================================================================

export interface AdaptContentOptions {
  /** When true (default), reshape length for platform norms. When false, preserve length aside from hard limits. */
  adjustLength?: boolean;
  /** When true (default), add platform-appropriate hashtags. When false, do not add hashtags. */
  addHashtags?: boolean;
}

export interface AdaptContentParams {
  /** Original content to adapt */
  sourceContent: string;
  /** Platform the content was originally written for (optional) */
  sourcePlatform?: string;
  /** Array of platform names to generate for */
  targetPlatforms: string[];
  /** Optional tone override */
  tone?: string;
  /** Content goal */
  goal?: string;
  /** Dashboard adaptation toggles (defaults: adjustLength + addHashtags on) */
  options?: AdaptContentOptions;
}

export interface AdaptedContent {
  source: {
    content: string;
    platform?: string;
  };
  variants: PlatformVariant[];
}

export interface PlatformVariant {
  platform: string;
  /** The adapted text */
  content: string;
  format:
    | 'standard'
    | 'thread'
    | 'carousel'
    | 'short-form'
    | 'long-form'
    | 'script';
  metadata: {
    characterCount: number;
    characterLimit: number;
    hashtags: string[];
    mentions: string[];
    wordCount: number;
    formatDetails?: Record<string, unknown>;
  };
  /** Optional quality score from ContentScorer */
  score?: number;
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

/** Default content format per platform */
const PLATFORM_FORMATS: Record<string, PlatformVariant['format']> = {
  twitter: 'standard',
  linkedin: 'long-form',
  instagram: 'standard',
  tiktok: 'short-form',
  facebook: 'standard',
  youtube: 'long-form',
  pinterest: 'short-form',
  reddit: 'long-form',
  threads: 'short-form',
};

// ============================================================================
// PLATFORM SYSTEM PROMPTS
// ============================================================================

/**
 * Build option-driven prompt lines for length and hashtag behaviour.
 * Exported for unit tests — defaults match historical always-on adaptation.
 * Reddit never adds hashtags (platform convention), regardless of the toggle.
 */
export function buildAdaptOptionInstructions(
  options?: AdaptContentOptions,
  platform?: string
): {
  lengthInstruction: string;
  hashtagInstruction: string;
} {
  const adjustLength = options?.adjustLength !== false;
  // Reddit does not use hashtags — never instruct the model to invent them.
  const addHashtags =
    platform === 'reddit' ? false : options?.addHashtags !== false;

  return {
    lengthInstruction: adjustLength
      ? "Reshape length for this platform's norms while respecting the hard character limit."
      : 'Preserve the original length as closely as possible. Only truncate if the source exceeds the hard character limit — do not shorten or expand for engagement norms.',
    hashtagInstruction: addHashtags
      ? 'Add platform-appropriate hashtags per the rules below.'
      : 'Do not add hashtags. Keep any hashtags that already appear in the source; do not invent new ones.',
  };
}

function buildSystemPrompt(
  platform: string,
  tone?: string,
  goal?: string,
  options?: AdaptContentOptions
): string {
  const toneInstruction = tone ? `Use a ${tone} tone throughout.` : '';
  const goalInstruction = goal ? `Optimize for ${goal.replace('_', ' ')}.` : '';
  const { lengthInstruction, hashtagInstruction } =
    buildAdaptOptionInstructions(options, platform);
  const optionBlock = `${lengthInstruction}\n${hashtagInstruction}`;

  // When hashtags are disabled (incl. Reddit), strip per-platform "Add N hashtags"
  // lines so they cannot contradict the option instruction.
  const withHashtags = platform !== 'reddit' && options?.addHashtags !== false;

  const platformPrompts: Record<string, string> = {
    twitter: `You are a Twitter/X content expert. Adapt the given content for Twitter.
Rules:
- Maximum 280 characters for a single tweet
- If the adapted content exceeds 280 characters, create a thread with numbered tweets (1/N format)
- Each tweet in a thread: max 270 characters (reserve 10 for numbering)
- Be concise and punchy
${withHashtags ? '- Add max 2 relevant hashtags\n' : ''}- Use short, impactful sentences
${optionBlock}
${toneInstruction}
${goalInstruction}

If creating a thread, separate each tweet with \\n---\\n delimiter.
Output ONLY the adapted content, no explanations.`,

    linkedin: `You are a LinkedIn content expert. Adapt the given content for LinkedIn.
Rules:
- Maximum 3000 characters
- Professional tone by default
- Start with a strong hook line
- Add line breaks between paragraphs for readability
- End with a question or call-to-action to drive engagement
${withHashtags ? '- Add max 5 relevant hashtags at the end\n' : ''}- Use data and insights where possible
${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    instagram: `You are an Instagram content expert. Adapt the given content for Instagram captions.
Rules:
- Maximum 2200 characters
- Visual-friendly and emoji-rich
- Strong hook in the first line (people see only first 2 lines before "more")
- Use line breaks for readability
${withHashtags ? '- Add hashtags in a comment-block format (separated by dots at the end)\n- Aim for 5-15 relevant hashtags\n' : ''}${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    tiktok: `You are a TikTok content expert. Adapt the given content for TikTok captions.
Rules:
- Maximum 2200 characters
- Casual, trendy, and conversational
- Short punchy sentences
- Strong hook in the first line
${withHashtags ? '- Use trending hashtag style (3-5 hashtags including #fyp)\n' : ''}- Keep it fun and engaging
${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    facebook: `You are a Facebook content expert. Adapt the given content for Facebook.
Rules:
- Maximum 63206 characters (but keep it moderate length for engagement)
- Conversational and community-focused
- Ask questions to drive comments
- Make it shareable
- Moderate length (200-500 characters optimal)
${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    youtube: `You are a YouTube content expert. Adapt the given content for a YouTube video description.
Rules:
- Maximum 5000 characters
- Description format with clear structure
- Include relevant keywords for SEO
- Add timestamps section if content is long enough
- Include call-to-action (subscribe, like, comment)
- Add links and chapter markers if applicable
${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    pinterest: `You are a Pinterest content expert. Adapt the given content for a Pinterest pin description.
Rules:
- Maximum 500 characters
- SEO-rich with keywords first
- Action-oriented language
- Descriptive and keyword-focused
${withHashtags ? '- Include relevant hashtags (2-5)\n' : ''}${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    reddit: `You are a Reddit content expert. Adapt the given content for Reddit.
Rules:
- Maximum 40000 characters
- Authentic and genuine — no marketing-speak or corporate jargon
- Provide real value and substance
- Conversational but informative
- Structure with paragraphs for readability
- No hashtags (Reddit doesn't use them)
- Subreddit-appropriate tone (assume general audience)
${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,

    threads: `You are a Threads content expert. Adapt the given content for Threads.
Rules:
- Maximum 500 characters
- Casual and conversational
- Similar to Twitter but can be slightly longer
- Engaging and shareable
${withHashtags ? '- Use 1-3 relevant hashtags\n' : ''}${optionBlock}
${toneInstruction}
${goalInstruction}

Output ONLY the adapted content, no explanations.`,
  };

  return platformPrompts[platform] || platformPrompts.twitter;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Extract hashtags from content */
function extractHashtags(content: string): string[] {
  return (content.match(/#\w+/g) ?? []).map(h => h.toLowerCase());
}

/** Extract @mentions from content */
function extractMentions(content: string): string[] {
  return content.match(/@\w+/g) ?? [];
}

/** Count words in content */
function countWords(content: string): number {
  return content.split(/\s+/).filter(w => w.trim().length > 0).length;
}

/**
 * Split content into a Twitter thread when it exceeds 280 chars.
 * Returns the content formatted with \n---\n delimiters and tweet count.
 */
function splitIntoThread(content: string): {
  content: string;
  tweetCount: number;
} {
  if (content.length <= 280) {
    return { content, tweetCount: 1 };
  }

  const sentences = content.split(/(?<=[.!?])\s+/);
  const tweets: string[] = [];
  let currentTweet = '';

  for (const sentence of sentences) {
    // Reserve space for numbering (e.g., "1/N " = ~5 chars, but plan says 10)
    const maxLength = 270;
    const testContent = currentTweet ? `${currentTweet} ${sentence}` : sentence;

    if (testContent.length <= maxLength) {
      currentTweet = testContent;
    } else {
      if (currentTweet) {
        tweets.push(currentTweet);
      }
      // If single sentence is too long, truncate with ellipsis
      currentTweet =
        sentence.length > maxLength
          ? sentence.substring(0, maxLength - 3) + '...'
          : sentence;
    }
  }

  if (currentTweet) {
    tweets.push(currentTweet);
  }

  const total = tweets.length;
  const numberedTweets = tweets.map((tweet, i) => `${i + 1}/${total} ${tweet}`);

  return {
    content: numberedTweets.join('\n---\n'),
    tweetCount: total,
  };
}

/**
 * Rule-based fallback when AI call fails for a platform.
 * Truncates or pads source content to fit platform limits.
 */
function createFallbackVariant(
  sourceContent: string,
  platform: string
): string {
  const limit = PLATFORM_LIMITS[platform] ?? 2200;

  if (sourceContent.length <= limit) {
    return sourceContent;
  }

  // Truncate at sentence boundary if possible
  const truncated = sourceContent.substring(0, limit - 3);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );

  if (lastSentenceEnd > limit * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  return truncated + '...';
}

// ============================================================================
// MULTI-FORMAT ADAPTER CLASS
// ============================================================================

/**
 * MultiFormatAdapter takes content and generates platform-specific variations
 * using AI for intelligent adaptation and ContentScorer for quality scoring.
 *
 * @example
 * const result = await multiFormatAdapter.adaptContent({
 *   sourceContent: 'Your content here',
 *   targetPlatforms: ['twitter', 'linkedin', 'instagram'],
 *   tone: 'professional',
 *   goal: 'engagement',
 * });
 */
export class MultiFormatAdapter {
  private get ai(): AIProvider {
    return getAIProvider();
  }

  /**
   * Adapt content for multiple target platforms in parallel.
   * Uses AI for intelligent adaptation and scores each variant.
   * Falls back to rule-based truncation if AI call fails.
   */
  async adaptContent(params: AdaptContentParams): Promise<AdaptedContent> {
    const {
      sourceContent,
      sourcePlatform,
      targetPlatforms,
      tone,
      goal,
      options,
    } = params;

    // Generate all platform variants in parallel
    const results = await Promise.allSettled(
      targetPlatforms.map(platform =>
        this.generateVariant(sourceContent, platform, tone, goal, options)
      )
    );

    // Map results, using fallback for rejected promises
    const variants: PlatformVariant[] = results.map((result, index) => {
      const platform = targetPlatforms[index];

      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Fallback: rule-based truncation
      const fallbackContent = createFallbackVariant(sourceContent, platform);
      const format = PLATFORM_FORMATS[platform] ?? 'standard';
      const limit = PLATFORM_LIMITS[platform] ?? 2200;

      // Score the fallback variant
      const scoreResult = contentScorer.score(fallbackContent, platform);

      return {
        platform,
        content: fallbackContent,
        format,
        metadata: {
          characterCount: fallbackContent.length,
          characterLimit: limit,
          hashtags: extractHashtags(fallbackContent),
          mentions: extractMentions(fallbackContent),
          wordCount: countWords(fallbackContent),
        },
        score: scoreResult.overall,
      };
    });

    return {
      source: {
        content: sourceContent,
        platform: sourcePlatform,
      },
      variants,
    };
  }

  /**
   * Generate a single platform variant using AI.
   */
  private async generateVariant(
    sourceContent: string,
    platform: string,
    tone?: string,
    goal?: string,
    options?: AdaptContentOptions
  ): Promise<PlatformVariant> {
    const systemPrompt = buildSystemPrompt(platform, tone, goal, options);
    const limit = PLATFORM_LIMITS[platform] ?? 2200;

    const response = await this.ai.complete({
      model: this.ai.models.balanced,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Adapt this content:\n\n${sourceContent}` },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    let adaptedContent = response.choices[0]?.message?.content ?? '';

    // Determine format
    let format: PlatformVariant['format'] =
      PLATFORM_FORMATS[platform] ?? 'standard';
    let formatDetails: Record<string, unknown> | undefined;

    // Handle Twitter thread logic
    if (platform === 'twitter') {
      // Check if AI returned a thread (with --- delimiters)
      if (adaptedContent.includes('\n---\n')) {
        const tweetCount = adaptedContent.split('\n---\n').length;
        format = 'thread';
        formatDetails = { tweetCount };
      } else if (adaptedContent.length > 280) {
        // AI exceeded limit — split into thread manually
        const threadResult = splitIntoThread(adaptedContent);
        adaptedContent = threadResult.content;
        format = 'thread';
        formatDetails = { tweetCount: threadResult.tweetCount };
      }
    }

    // Score the adapted content
    const scoreResult = contentScorer.score(adaptedContent, platform);

    return {
      platform,
      content: adaptedContent,
      format,
      metadata: {
        characterCount: adaptedContent.length,
        characterLimit: limit,
        hashtags: extractHashtags(adaptedContent),
        mentions: extractMentions(adaptedContent),
        wordCount: countWords(adaptedContent),
        formatDetails,
      },
      score: scoreResult.overall,
    };
  }
}

/** Singleton instance for use across the application. */
export const multiFormatAdapter = new MultiFormatAdapter();
