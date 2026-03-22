import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authStrict } from '@/lib/rate-limit';

const RequestSchema = z.object({
  businessName: z.string().min(1).max(80),
});

/**
 * Demo caption generation — FREE tier model via OpenRouter.
 *
 * Uses meta-llama/llama-3.3-70b-instruct:free (zero cost, no credit card).
 * This is intentionally a free-tier model to showcase the platform without
 * burning paid AI credits. Upgrade to a legacy model (Claude, GPT-4, etc.)
 * inside the dashboard for production-grade output.
 */
export async function POST(req: NextRequest) {
  // Strict rate limit: 5 req/min per IP — public route, no auth
  return authStrict(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { businessName } = parsed.data;

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openRouterKey && !anthropicKey && !openaiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const prompt = `Write a single Instagram caption (2-3 sentences, 1-2 hashtags) for a business called "${businessName}". Australian voice, no emojis, conversational. Return only the caption text, nothing else.`;

    try {
      let caption = '';
      let modelUsed = '';
      let tier = 'free';

      if (openRouterKey) {
        // Primary: OpenRouter free-tier model
        const response = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://synthex.social',
              'X-Title': 'Synthex Demo',
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-3.3-70b-instruct:free',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 200,
              temperature: 0.8,
            }),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            model?: string;
          };
          caption = data?.choices?.[0]?.message?.content?.trim() ?? '';
          modelUsed = data?.model ?? 'meta-llama/llama-3.3-70b-instruct:free';
        }
      }

      // Fallback: Anthropic Claude (if OpenRouter unavailable or failed)
      if (!caption && anthropicKey) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            content?: Array<{ text?: string }>;
            model?: string;
          };
          caption = data?.content?.[0]?.text?.trim() ?? '';
          modelUsed = data?.model ?? 'claude-haiku-4-5-20251001';
          tier = 'demo';
        } else {
          const err = await response.text();
          console.error('Anthropic demo error:', err);
        }
      }

      if (!caption) {
        return NextResponse.json(
          { error: 'AI generation failed' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        caption,
        model: modelUsed,
        tier,
      });
    } catch (err) {
      console.error('Demo caption error:', err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
