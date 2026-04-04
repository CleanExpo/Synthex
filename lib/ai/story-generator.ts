/**
 * Monthly story narrative generator
 *
 * Isolated so tests can mock this module rather than the Anthropic SDK directly.
 *
 * @task SYN-553
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTI_SLOP_DIRECTIVE } from '@/lib/ai/prompts/anti-slop-directive';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }
  return _anthropic;
}

export interface StoryMetrics {
  orgName: string;
  monthLabel: string;
  postsPublished: number;
  autonomousPosts: number;
  totalReach: number;
  minutesSaved: number;
}

/** Calls Claude claude-sonnet-4-6 to generate a plain-English monthly marketing narrative. */
export async function generateMonthlyNarrative(
  metrics: StoryMetrics
): Promise<string> {
  const hoursaved = Math.round(metrics.minutesSaved / 60);
  const autoPct =
    metrics.postsPublished > 0
      ? Math.round((metrics.autonomousPosts / metrics.postsPublished) * 100)
      : 0;

  const prompt = `You are writing a monthly marketing performance summary for a small Australian business called "${metrics.orgName}".

Write 3–5 short paragraphs in plain English summarising what happened with their marketing in ${metrics.monthLabel}. Use warm, confident, non-jargon language. Do not use bullet points or headers — only flowing paragraphs.

Data for ${metrics.monthLabel}:
- Posts published: ${metrics.postsPublished}
- Posts published automatically (no human review needed): ${metrics.autonomousPosts} (${autoPct}%)
- Estimated total reach across all platforms: ${metrics.totalReach.toLocaleString()} people
- Time saved vs. manual posting: approximately ${hoursaved} hour${hoursaved !== 1 ? 's' : ''}

Guidelines:
- Open with what was accomplished this month (posts, reach)
- If autonomous_posts > 0, highlight the time-saving benefit naturally
- Close with a forward-looking sentence about what's coming (don't promise specifics)
- Keep each paragraph to 2–4 sentences
- Do not use marketing jargon or buzzwords
- Do not use dollar amounts
- Write for an Australian audience (use "organisation" not "organization", "colour" not "color")

Return only the paragraphs, no extra commentary.

${ANTI_SLOP_DIRECTIVE}`;

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text')
    throw new Error('Unexpected response type from Claude');
  return content.text.trim();
}
