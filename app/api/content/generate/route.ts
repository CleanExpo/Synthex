import { NextRequest, NextResponse } from 'next/server';
import { contentGenerator } from '@/lib/services/content-generator';
import { db } from '@/lib/supabase-client';
import { prisma } from '@/lib/prisma';
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

    // Fetch persona from database if provided
    let persona: { id: string; name: string; attributes: Record<string, string> } | null = null;
    if (personaId) {
      const dbPersona = await prisma.persona.findUnique({
        where: { id: personaId },
        select: {
          id: true,
          name: true,
          tone: true,
          style: true,
          vocabulary: true,
          emotion: true,
        },
      });

      if (!dbPersona) {
        return NextResponse.json(
          {
            success: false,
            error: 'Persona not found',
            message: 'The specified persona does not exist. Create one first or omit personaId to use default settings.',
          },
          { status: 404 }
        );
      }

      persona = {
        id: dbPersona.id,
        name: dbPersona.name,
        attributes: {
          tone: dbPersona.tone,
          style: dbPersona.style,
          vocabulary: dbPersona.vocabulary,
          emotion: dbPersona.emotion,
        },
      };
    }

    // Generate content
    const result = await contentGenerator.generateContent({
      platform,
      persona: persona || undefined,
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
        body: result.primary,
        persona_id: personaId || undefined,
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
    const message = error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to generate content';
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
    const message = error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to generate with AI';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Export with authentication wrapper
export const PUT = withAuth(handlePut);