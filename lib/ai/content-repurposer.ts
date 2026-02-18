/**
 * Content Repurposing Service
 *
 * @description Transforms long-form content (blogs, articles, video transcripts)
 * into multiple short-form derivative formats (threads, video scripts, carousels).
 *
 * Supported output formats:
 * - thread: Twitter/X thread with numbered tweets
 * - video_script: Short-form video script (TikTok/Reels/Shorts)
 * - carousel_outline: Instagram/LinkedIn carousel slide outline
 * - key_takeaways: Bulleted list of main insights (5-7 points)
 * - summary: Condensed paragraph (150-250 words)
 * - quote_graphics: 3-5 quotable statements for graphics
 *
 * @module lib/ai/content-repurposer
 */

import { getAIProvider } from '@/lib/ai/providers';
import type { AIProvider } from '@/lib/ai/providers';
import { contentScorer } from '@/lib/ai/content-scorer';

// ============================================================================
// TYPES
// ============================================================================

export type SourceType = 'blog' | 'article' | 'video_transcript' | 'podcast' | 'newsletter';

export type OutputFormat =
  | 'thread'
  | 'video_script'
  | 'carousel_outline'
  | 'key_takeaways'
  | 'summary'
  | 'quote_graphics';

export interface RepurposeContentParams {
  /** Long-form source content to repurpose */
  sourceContent: string;
  /** Type of source content */
  sourceType: SourceType;
  /** Output formats to generate */
  outputFormats: OutputFormat[];
}

export interface RepurposedContent {
  /** Output format type */
  format: OutputFormat;
  /** Generated content */
  content: string;
  /** Content metadata */
  metadata: {
    wordCount: number;
    characterCount: number;
    /** Number of items (tweets, slides, takeaways, quotes) */
    itemCount?: number;
    /** Additional format-specific details */
    formatDetails?: Record<string, unknown>;
  };
  /** Quality score from ContentScorer */
  score?: number;
}

export interface RepurposeResult {
  source: {
    content: string;
    type: SourceType;
    wordCount: number;
  };
  results: RepurposedContent[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FORMAT_LABELS: Record<OutputFormat, string> = {
  thread: 'Twitter/X Thread',
  video_script: 'Video Script',
  carousel_outline: 'Carousel Outline',
  key_takeaways: 'Key Takeaways',
  summary: 'Summary',
  quote_graphics: 'Quote Graphics',
};

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

function buildSystemPrompt(format: OutputFormat, sourceType: SourceType): string {
  const sourceLabel = sourceType.replace('_', ' ');

  const prompts: Record<OutputFormat, string> = {
    thread: `You are a social media expert. Transform the provided ${sourceLabel} into a Twitter/X thread.

Rules:
- Create 5-10 numbered tweets (format: "1/ content")
- First tweet must be a compelling hook that stands alone
- Each tweet: max 270 characters (reserve space for numbering)
- Last tweet: include a clear CTA (follow, share, save)
- Use simple language, break complex ideas into digestible pieces
- Include 2-3 relevant hashtags on the final tweet only
- Separate each tweet with \\n\\n

Output ONLY the thread content, no explanations.`,

    video_script: `You are a short-form video expert. Transform the provided ${sourceLabel} into a TikTok/Reels/Shorts video script.

Rules:
- Duration: 30-60 seconds when read aloud
- Structure:
  - HOOK (first 3 seconds): Attention-grabbing opener
  - BODY (20-45 seconds): 3-4 key points, conversational delivery
  - CTA (5-10 seconds): Clear call-to-action
- Use natural, spoken language (not written style)
- Include [VISUAL CUE] brackets for on-screen text suggestions
- Keep sentences short and punchy
- Format as:
  HOOK:
  [content]

  BODY:
  [content]

  CTA:
  [content]

Output ONLY the script, no explanations.`,

    carousel_outline: `You are a carousel content expert. Transform the provided ${sourceLabel} into an Instagram/LinkedIn carousel outline.

Rules:
- Create 6-10 slides
- Slide 1: Eye-catching title/hook (max 15 words)
- Slides 2-8: One key point per slide with supporting text
- Each slide: headline (5-10 words) + body (15-30 words)
- Final slide: CTA + summary takeaway
- Format as:
  SLIDE 1:
  Headline: [text]
  Body: [text]

  SLIDE 2:
  [continue pattern]

Output ONLY the carousel outline, no explanations.`,

    key_takeaways: `You are a content strategist. Extract the key takeaways from the provided ${sourceLabel}.

Rules:
- Extract 5-7 main insights/takeaways
- Each takeaway: 1-2 sentences, clear and actionable
- Start each with a bullet point (-)
- Order from most to least important
- Focus on practical, implementable insights
- Avoid generic statements — be specific

Output ONLY the bulleted takeaways, no explanations.`,

    summary: `You are a professional editor. Create a concise summary of the provided ${sourceLabel}.

Rules:
- Length: 150-250 words
- Capture the main thesis and key arguments
- Maintain the author's tone and perspective
- Structure: opening statement, key points, conclusion
- Use clear, accessible language
- No bullet points — write as flowing prose

Output ONLY the summary paragraph, no explanations.`,

    quote_graphics: `You are a content curator. Extract quotable statements from the provided ${sourceLabel} for social media graphics.

Rules:
- Extract 3-5 standalone quotes
- Each quote: 10-30 words, impactful and shareable
- Quotes should make sense without context
- Include a mix of:
  - Insightful observations
  - Actionable advice
  - Provocative statements
- Format as numbered list (1. "quote")
- Do not alter the original wording — extract verbatim or very close paraphrases

Output ONLY the numbered quotes, no explanations.`,
  };

  return prompts[format];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Count words in content */
function countWords(content: string): number {
  return content.split(/\s+/).filter((w) => w.trim().length > 0).length;
}

/** Count items in formatted output */
function countItems(content: string, format: OutputFormat): number | undefined {
  switch (format) {
    case 'thread': {
      // Count numbered tweets (1/, 2/, etc.)
      const tweetMatches = content.match(/^\d+\//gm);
      return tweetMatches?.length ?? content.split(/\n\n+/).filter((s) => s.trim()).length;
    }
    case 'carousel_outline': {
      // Count SLIDE markers
      const slideMatches = content.match(/SLIDE\s+\d+:/gi);
      return slideMatches?.length;
    }
    case 'key_takeaways': {
      // Count bullet points
      const bulletMatches = content.match(/^-/gm);
      return bulletMatches?.length;
    }
    case 'quote_graphics': {
      // Count numbered quotes
      const quoteMatches = content.match(/^\d+\.\s*"/gm);
      return quoteMatches?.length;
    }
    default:
      return undefined;
  }
}

/**
 * Create fallback content when AI generation fails.
 * Returns a simplified version based on source content.
 */
function createFallbackContent(sourceContent: string, format: OutputFormat): string {
  const words = sourceContent.split(/\s+/);
  const firstSentences = sourceContent.split(/[.!?]/).slice(0, 3).join('. ').trim();

  switch (format) {
    case 'thread':
      return `1/ ${firstSentences.substring(0, 270)}`;

    case 'video_script':
      return `HOOK:\n${firstSentences.substring(0, 100)}\n\nBODY:\n${words.slice(0, 50).join(' ')}\n\nCTA:\nShare your thoughts in the comments!`;

    case 'carousel_outline':
      return `SLIDE 1:\nHeadline: Key Insights\nBody: ${firstSentences.substring(0, 50)}`;

    case 'key_takeaways':
      return `- ${firstSentences}`;

    case 'summary':
      return words.slice(0, 50).join(' ') + '...';

    case 'quote_graphics':
      return `1. "${firstSentences.substring(0, 80)}"`;
  }
}

// ============================================================================
// CONTENT REPURPOSER CLASS
// ============================================================================

/**
 * ContentRepurposer transforms long-form content into multiple short-form
 * derivative formats using AI for intelligent transformation and
 * ContentScorer for quality scoring.
 *
 * @example
 * const result = await contentRepurposer.repurpose({
 *   sourceContent: 'Your long-form blog post here...',
 *   sourceType: 'blog',
 *   outputFormats: ['thread', 'video_script', 'key_takeaways'],
 * });
 */
export class ContentRepurposer {
  private get ai(): AIProvider {
    return getAIProvider();
  }

  /**
   * Repurpose long-form content into multiple short-form formats.
   * Generates all requested formats in parallel using Promise.allSettled.
   */
  async repurpose(params: RepurposeContentParams): Promise<RepurposeResult> {
    const { sourceContent, sourceType, outputFormats } = params;

    // Generate all formats in parallel
    const results = await Promise.allSettled(
      outputFormats.map((format) =>
        this.generateFormat(sourceContent, sourceType, format)
      )
    );

    // Map results, using fallback for rejected promises
    const repurposedResults: RepurposedContent[] = results.map((result, index) => {
      const format = outputFormats[index];

      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Fallback: create simplified content
      const fallbackContent = createFallbackContent(sourceContent, format);
      const scoreResult = contentScorer.score(fallbackContent, 'twitter');

      return {
        format,
        content: fallbackContent,
        metadata: {
          wordCount: countWords(fallbackContent),
          characterCount: fallbackContent.length,
          itemCount: countItems(fallbackContent, format),
          formatDetails: { fallback: true, error: result.reason?.message },
        },
        score: scoreResult.overall,
      };
    });

    return {
      source: {
        content: sourceContent,
        type: sourceType,
        wordCount: countWords(sourceContent),
      },
      results: repurposedResults,
    };
  }

  /**
   * Generate a single format using AI.
   */
  private async generateFormat(
    sourceContent: string,
    sourceType: SourceType,
    format: OutputFormat
  ): Promise<RepurposedContent> {
    const systemPrompt = buildSystemPrompt(format, sourceType);

    const response = await this.ai.complete({
      model: this.ai.models.balanced,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Transform this ${sourceType.replace('_', ' ')} into a ${FORMAT_LABELS[format]}:\n\n${sourceContent}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const generatedContent = response.choices[0]?.message?.content ?? '';

    // Determine platform for scoring based on format
    const scoringPlatform = format === 'thread' ? 'twitter' : 'linkedin';
    const scoreResult = contentScorer.score(generatedContent, scoringPlatform);

    return {
      format,
      content: generatedContent,
      metadata: {
        wordCount: countWords(generatedContent),
        characterCount: generatedContent.length,
        itemCount: countItems(generatedContent, format),
      },
      score: scoreResult.overall,
    };
  }
}

/** Singleton instance for use across the application. */
export const contentRepurposer = new ContentRepurposer();
