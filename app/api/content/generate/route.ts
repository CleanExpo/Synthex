import { NextRequest, NextResponse } from 'next/server';
import { contentGenerator } from '@/lib/services/content-generator';
import { db } from '@/lib/supabase-client';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { z } from 'zod';

// Input validation schema
const generateContentSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads']),
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic too long'),
  personaId: z.string().uuid().optional(),
  hookType: z.string().optional(),
  tone: z.string().optional(),
  includeHashtags: z.boolean().optional().default(true),
  includeEmojis: z.boolean().optional().default(true),
  targetLength: z.enum(['short', 'medium', 'long']).optional().default('medium'),
  useAI: z.boolean().optional().default(false),
});

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = generateContentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const {
      platform,
      personaId,
      topic,
      hookType,
      tone,
      includeHashtags,
      includeEmojis,
      targetLength,
    } = validationResult.data;

    // Get authenticated user ID
    const userId = request.userId;

    // Fetch persona if provided
    let persona: { id: string; name: string; attributes: Record<string, string> } | null = null;
    if (personaId) {
      // In production, fetch from database
      // For now, use mock persona
      persona = {
        id: personaId,
        name: 'Professional Voice',
        attributes: {
          tone: 'Professional',
          style: 'Formal',
          vocabulary: 'Technical',
          emotion: 'Confident',
        },
      };
    }

    // Generate content
    const result = await contentGenerator.generateContent({
      platform,
      persona,
      topic,
      hookType,
      tone,
      includeHashtags,
      includeEmojis,
      targetLength,
    });

    // Save to database with authenticated user
    try {
      await db.content.create(userId, {
        platform,
        content: result.primary,
        persona_id: personaId || null,
        metadata: result.metadata,
        status: 'draft',
      });
    } catch (dbError) {
      console.error('Failed to save content:', dbError);
      // Non-critical error - continue returning the generated content
    }

    return NextResponse.json({
      success: true,
      content: result,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Content generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate content';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Export with authentication wrapper
export const POST = withAuth(handlePost);

// AI generation input schema
const aiGenerateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000, 'Prompt too long'),
  maxTokens: z.number().int().min(50).max(2000).optional().default(500),
});

// Generate content with AI
async function handlePut(request: AuthenticatedRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = aiGenerateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { prompt, maxTokens } = validationResult.data;

    // Generate with AI
    const content = await contentGenerator.generateWithAI(prompt, maxTokens);

    return NextResponse.json({
      success: true,
      content,
      userId: request.userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('AI generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate with AI';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Export with authentication wrapper
export const PUT = withAuth(handlePut);