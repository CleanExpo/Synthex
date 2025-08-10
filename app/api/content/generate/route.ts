import { NextResponse } from 'next/server';
import { contentGenerator } from '@/lib/services/content-generator';
import { db } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      platform,
      personaId,
      topic,
      hookType,
      tone,
      includeHashtags = true,
      includeEmojis = true,
      targetLength = 'medium',
      useAI = false,
    } = body;

    // Validate required fields
    if (!platform || !topic) {
      return NextResponse.json(
        { error: 'Platform and topic are required' },
        { status: 400 }
      );
    }

    // Fetch persona if provided
    let persona = null;
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

    // Save to database
    try {
      await db.content.create({
        platform,
        content: result.primary,
        persona_id: personaId || null,
        metadata: result.metadata,
        status: 'draft',
      });
    } catch (dbError) {
      console.error('Failed to save content:', dbError);
    }

    return NextResponse.json({
      success: true,
      content: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate content' },
      { status: 500 }
    );
  }
}

// Generate content with AI
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { prompt, maxTokens = 500 } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Generate with AI
    const content = await contentGenerator.generateWithAI(prompt, maxTokens);

    return NextResponse.json({
      success: true,
      content,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate with AI' },
      { status: 500 }
    );
  }
}