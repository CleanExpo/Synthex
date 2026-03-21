import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authStrict } from '@/lib/rate-limit';

const RequestSchema = z.object({
  businessName: z.string().min(1).max(80),
});

export async function POST(req: NextRequest) {
  // Strict rate limit: 5 req/min per IP — public route, no auth, burns AI credits
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://synthex.social',
            'X-Title': 'Synthex Demo',
          },
          body: JSON.stringify({
            model: 'anthropic/claude-haiku-4-5',
            messages: [
              {
                role: 'user',
                content: `Write a single Instagram caption (2–3 sentences, 1–2 hashtags) for a ${businessName}. Australian voice, no emojis, conversational. Return only the caption text, nothing else.`,
              },
            ],
            max_tokens: 150,
            temperature: 0.8,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        console.error('OpenRouter error:', err);
        return NextResponse.json(
          { error: 'AI generation failed' },
          { status: 502 }
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const caption = data?.choices?.[0]?.message?.content?.trim() ?? '';

      if (!caption) {
        return NextResponse.json(
          { error: 'Empty response from AI' },
          { status: 502 }
        );
      }

      return NextResponse.json({ caption });
    } catch (err) {
      console.error('Demo caption error:', err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
