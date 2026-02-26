/**
 * AI Content Generation API with Enhanced Rate Limiting
 * POST /api/generate - Generate AI content
 * GET /api/generate - Get endpoint info and rate limits
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 * - JWT_SECRET: JWT signing key (CRITICAL)
 *
 * SECURITY: Requires authentication via JWT token
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiGeneration } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';
import { requireApiKey } from '@/lib/middleware/require-api-key';

// Backward compatibility: stub for enhancedRateLimiters
const enhancedRateLimiters = {
  aiGeneration: (req: NextRequest, handler: () => Promise<NextResponse>) => aiGeneration(req, handler),
  ai: (req: NextRequest, handler: () => Promise<NextResponse>) => aiGeneration(req, handler),
};

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Handler function
async function generateContent(req: NextRequest): Promise<NextResponse> {
  try {
    // Auth check - require JWT token
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('auth-token')?.value;

    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = verifyTokenSafe(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    const userId = payload.userId;

    const { prompt, platform, style, count = 1 } = await req.json();

    // Validate input
    if (!prompt || !platform) {
      return NextResponse.json(
        { error: 'Prompt and platform are required' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 10) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 10' },
        { status: 400 }
      );
    }
    
    // AI content generation requires OPENROUTER_API_KEY
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          error: 'AI content generation not configured',
          message: 'Content generation requires an AI API key. Contact support to enable this feature.',
        },
        { status: 501 }
      );
    }

    // Call AI service for real content generation
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://synthex.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'user',
            content: `Generate ${count} content variation(s) for ${platform}${style ? ` in ${style} style` : ''}.

Prompt: "${prompt}"

For each variation, respond with a JSON array of objects, each with:
- "content": the generated text
- "hashtags": relevant hashtags (array of strings)

Respond ONLY with valid JSON.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'AI service unavailable', message: 'Content generation failed. Please try again later.' },
        { status: 502 }
      );
    }

    const aiData = await response.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';
    const promptTokens = aiData.usage?.prompt_tokens || 0;
    const completionTokens = aiData.usage?.completion_tokens || 0;

    // Parse AI response
    let parsedVariations: Array<{ content: string; hashtags?: string[] }> = [];
    try {
      parsedVariations = JSON.parse(aiText);
      if (!Array.isArray(parsedVariations)) {
        parsedVariations = [{ content: aiText }];
      }
    } catch {
      // If AI didn't return valid JSON, wrap the raw text as a single variation
      parsedVariations = [{ content: aiText }];
    }

    const generatedContent = parsedVariations.slice(0, count).map((v, i) => ({
      id: `gen-${Date.now()}-${i}`,
      content: v.content,
      platform,
      style: style || 'default',
      hashtags: v.hashtags || generateHashtags(prompt),
      bestPostTime: suggestPostTime(platform),
      createdAt: new Date().toISOString(),
    }));

    // Log generation for analytics
    await supabase
      .from('generation_logs')
      .insert({
        user_id: userId,
        prompt,
        platform,
        style,
        count,
        tokens_used: promptTokens + completionTokens,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      count: generatedContent.length,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      results: generatedContent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}

// Helper functions
function generateHashtags(prompt: string): string[] {
  const words = prompt.toLowerCase().split(' ');
  const hashtags = words
    .filter(word => word.length > 4)
    .slice(0, 5)
    .map(word => `#${word}`);
  
  // Add trending hashtags based on platform
  hashtags.push('#viral', '#trending', '#fyp');
  
  return hashtags;
}

/** djb2 hash for deterministic selection */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function suggestPostTime(platform: string): string {
  const bestTimes: Record<string, string[]> = {
    twitter: ['9:00 AM', '12:00 PM', '5:00 PM', '7:00 PM'],
    instagram: ['11:00 AM', '2:00 PM', '5:00 PM', '8:00 PM'],
    linkedin: ['7:30 AM', '12:00 PM', '5:30 PM'],
    tiktok: ['6:00 AM', '3:00 PM', '7:00 PM', '10:00 PM'],
    facebook: ['9:00 AM', '3:00 PM', '7:00 PM']
  };

  const times = bestTimes[platform] || bestTimes.twitter;
  // Deterministic selection based on platform name — same platform always gets same suggestion
  return times[djb2(platform) % times.length];
}

// Export with API key gate + enhanced rate limiting
export async function POST(req: NextRequest) {
  return requireApiKey(req, async () => {
    // Apply AI-specific rate limiting
    return enhancedRateLimiters.ai(req, () => generateContent(req));
  });
}

// GET endpoint to check rate limit status
export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/generate',
    method: 'POST',
    description: 'AI content generation with rate limiting',
    rateLimits: {
      anonymous: '10 requests per hour',
      free: '20 requests per hour',
      starter: '100 requests per hour',
      pro: '500 requests per hour',
      enterprise: '5000 requests per hour'
    },
    requiredFields: {
      prompt: 'string - The content prompt',
      platform: 'string - Target platform (twitter, instagram, etc.)',
      style: 'string (optional) - Content style',
      count: 'number (optional) - Number of variations (1-10)'
    },
    example: {
      prompt: 'Announce our new AI product launch',
      platform: 'twitter',
      style: 'professional',
      count: 3
    }
  });
}