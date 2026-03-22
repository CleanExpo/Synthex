import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGeneration } from '@/lib/rate-limit';

const RequestSchema = z.object({
  businessName: z.string().min(1).max(80),
});

/**
 * Demo caption generation — FREE tier via OpenRouter, with Anthropic/OpenAI fallback.
 *
 * Rate limit: 20 req/min per IP (aiGeneration preset — NOT authStrict).
 * Priority: OpenRouter free model → Anthropic Claude Haiku → OpenAI → sample caption.
 * Never returns an error to the user — always produces something.
 */

/** Sample captions by business name keyword — guaranteed last-resort fallback */
const SAMPLE_CAPTIONS: Record<string, string> = {
  restoration: `Training Australia's best — because clean isn't just a look, it's a health standard. Whether you're new to the industry or levelling up your certification, CARSI has the course for you. #RestorationTraining #CleaningScience`,
  cafe: `Freshly brewed and ready to make your morning. Stop by and let us fuel your day the right way — good coffee, good vibes. #CoffeeCulture #MorningRitual`,
  tradie: `Quality workmanship on every job, no matter the size. When you need it done right the first time, you know who to call. #TradesmanLife #BuiltToLast`,
  salon: `Because you deserve to look and feel your best. Book in with us this week and walk out a new you. #HairSalon #SalonLife`,
  gym: `Another day, another personal best waiting to happen. Come in, put in the work, and watch what you're capable of. #FitnessGoals #GymLife`,
};

function getSampleCaption(businessName: string): string {
  const lower = businessName.toLowerCase();
  for (const [key, caption] of Object.entries(SAMPLE_CAPTIONS)) {
    if (lower.includes(key)) return caption;
  }
  return `${businessName} — where quality meets passion. Follow along for updates, behind-the-scenes content, and offers you won't want to miss. #AustralianBusiness #SmallBiz`;
}

async function generateViaOpenRouter(
  businessName: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://synthex.social',
        'X-Title': 'Synthex Demo',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          {
            role: 'user',
            content: `Write a single Instagram caption (2-3 sentences, 1-2 hashtags) for a business called "${businessName}". Australian voice, no emojis, conversational. Return only the caption text, nothing else.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function generateViaAnthropic(
  businessName: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Write a single Instagram caption (2-3 sentences, 1-2 hashtags) for a business called "${businessName}". Australian voice, no emojis, conversational. Return only the caption text, nothing else.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    return data?.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function generateViaOpenAI(
  businessName: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Write a single Instagram caption (2-3 sentences, 1-2 hashtags) for a business called "${businessName}". Australian voice, no emojis, conversational. Return only the caption text, nothing else.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  return aiGeneration(req, async () => {
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

    let caption: string | null = null;
    let model = 'sample';
    let tier = 'free';

    // 1. Try OpenRouter (free tier — zero cost)
    if (!caption && openRouterKey) {
      caption = await generateViaOpenRouter(businessName, openRouterKey);
      if (caption) {
        model = 'meta-llama/llama-3.3-70b-instruct:free';
        tier = 'free';
      }
    }

    // 2. Fallback: Anthropic Claude Haiku
    if (!caption && anthropicKey) {
      caption = await generateViaAnthropic(businessName, anthropicKey);
      if (caption) {
        model = 'claude-haiku-4-5-20251001';
        tier = 'demo';
      }
    }

    // 3. Fallback: OpenAI GPT-4o Mini
    if (!caption && openaiKey) {
      caption = await generateViaOpenAI(businessName, openaiKey);
      if (caption) {
        model = 'gpt-4o-mini';
        tier = 'demo';
      }
    }

    // 4. Final fallback: curated sample — demo ALWAYS produces output
    if (!caption) {
      caption = getSampleCaption(businessName);
      model = 'sample';
      tier = 'sample';
    }

    return NextResponse.json({ caption, model, tier });
  });
}
