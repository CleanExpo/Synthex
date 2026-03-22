import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGeneration } from '@/lib/rate-limit';

const RequestSchema = z.object({
  businessName: z.string().min(1).max(80),
  caption: z.string().max(500).optional(),
});

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
}

/**
 * Map business keywords to Picsum seeds that return thematically relevant photos.
 * Picsum seeds are deterministic — same seed always returns the same photo.
 */
const KEYWORD_SEEDS: Array<[string, string]> = [
  ['cafe', 'coffee-shop-cafe-food'],
  ['coffee', 'coffee-shop-cafe-food'],
  ['restaurant', 'restaurant-food-dining'],
  ['food', 'restaurant-food-dining'],
  ['tradie', 'construction-building-tools'],
  ['plumb', 'construction-building-tools'],
  ['electr', 'construction-building-tools'],
  ['build', 'construction-building-tools'],
  ['salon', 'beauty-hair-salon'],
  ['hair', 'beauty-hair-salon'],
  ['beauty', 'beauty-hair-salon'],
  ['spa', 'beauty-hair-salon'],
  ['gym', 'fitness-gym-sport'],
  ['fit', 'fitness-gym-sport'],
  ['sport', 'fitness-gym-sport'],
  ['health', 'fitness-gym-sport'],
  ['retail', 'retail-shop-fashion'],
  ['fashion', 'retail-shop-fashion'],
  ['cloth', 'retail-shop-fashion'],
  ['tech', 'tech-office-modern'],
  ['digit', 'tech-office-modern'],
  ['clean', 'cleaning-professional-service'],
  ['restore', 'cleaning-professional-service'],
];

function getPicsumUrl(businessName: string): string {
  const lower = businessName.toLowerCase();
  let seed = businessName.trim().replace(/\s+/g, '-').toLowerCase();
  for (const [keyword, themeSeed] of KEYWORD_SEEDS) {
    if (lower.includes(keyword)) {
      seed = themeSeed;
      break;
    }
  }
  // 800×600 gives a crisp 4:3 crop that fits the card
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // No Gemini key — return a deterministic Picsum stock photo instead of null.
      // Picsum is free, requires no API key, and always returns a beautiful photo.
      return NextResponse.json({ imageUrl: getPicsumUrl(businessName) });
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate a high-quality social media photo for ${businessName}. Style: warm, natural light, professional. No text overlays.`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['IMAGE'],
            },
          }),
        }
      );

      if (!response.ok) {
        return NextResponse.json({ imageUrl: getPicsumUrl(businessName) });
      }

      const data = (await response.json()) as GeminiResponse;
      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (!inlineData?.data) {
        return NextResponse.json({ imageUrl: getPicsumUrl(businessName) });
      }

      const imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
      return NextResponse.json({ imageUrl });
    } catch (err) {
      console.error('Demo image error:', err);
      return NextResponse.json({ imageUrl: getPicsumUrl(businessName) });
    }
  });
}
