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
      // Graceful fallback — return null imageUrl, widget shows warm gradient
      return NextResponse.json({ imageUrl: null });
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
        // Fallback gracefully
        return NextResponse.json({ imageUrl: null });
      }

      const data = (await response.json()) as GeminiResponse;
      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (!inlineData?.data) {
        return NextResponse.json({ imageUrl: null });
      }

      const imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
      return NextResponse.json({ imageUrl });
    } catch (err) {
      console.error('Demo image error:', err);
      // Graceful fallback
      return NextResponse.json({ imageUrl: null });
    }
  });
}
