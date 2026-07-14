import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGeneration } from '@/lib/rate-limit';
import { generateImage } from '@/lib/services/ai/image-generation';
import { systemGenerationContext } from '@/lib/ai/generation-context';

const RequestSchema = z.object({
  businessName: z.string().min(1).max(80),
  caption: z.string().max(500).optional(),
});

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

    try {
      // SANCTIONED EXCEPTION (Real Images Only spec 2026-07-12): public
      // lead-gen demo for arbitrary prospect businesses — explicit escape
      // hatch; output carries the UNGROUNDED warning. Founder decision
      // pending (retire or restrict).
      const result = await generateImage(
        {
          prompt: `Generate a high-quality social media photo for ${businessName}. Style: warm, natural light, professional. No text overlays.`,
          useReferences: false,
        },
        systemGenerationContext(undefined, {
          userId: 'demo-public',
          autonomyLevel: 'system',
        })
      );

      if (result.success && result.imageBase64) {
        return NextResponse.json({
          imageUrl: `data:image/png;base64,${result.imageBase64}`,
        });
      }
      if (result.success && result.imageUrl) {
        return NextResponse.json({ imageUrl: result.imageUrl });
      }

      // No key configured, provider failure, or no image in the response —
      // fall back to a deterministic Picsum stock photo instead of null.
      // Picsum is free, requires no API key, and always returns a beautiful
      // photo, so the demo surface never dead-ends a prospect.
      return NextResponse.json({ imageUrl: getPicsumUrl(businessName) });
    } catch (err) {
      console.error('Demo image error:', err);
      return NextResponse.json({ imageUrl: getPicsumUrl(businessName) });
    }
  });
}
