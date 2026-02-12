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
import { enhancedRateLimiters } from '@/src/middleware/enhanced-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';

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
    
    // Simulate AI generation (replace with actual AI service)
    const generatedContent: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      generatedContent.push({
        id: `gen-${Date.now()}-${i}`,
        content: `Generated content for: ${prompt} (Variation ${i + 1})`,
        platform,
        style: style || 'default',
        engagementScore: Math.random() * 100,
        viralProbability: Math.random(),
        hashtags: generateHashtags(prompt),
        bestPostTime: suggestPostTime(platform),
        createdAt: new Date().toISOString()
      });
    }
    
    // Log generation for analytics (userId is always defined after auth check)
    await supabase
      .from('generation_logs')
      .insert({
        user_id: userId,
        prompt,
        platform,
        style,
        count,
        tokens_used: prompt.length * count * 10, // Simplified token calculation
        created_at: new Date().toISOString()
      });
    
    return NextResponse.json({
      success: true,
      count: generatedContent.length,
      usage: {
        promptTokens: prompt.length,
        completionTokens: generatedContent.join('').length,
        totalTokens: prompt.length + generatedContent.join('').length
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

function suggestPostTime(platform: string): string {
  const bestTimes: Record<string, string[]> = {
    twitter: ['9:00 AM', '12:00 PM', '5:00 PM', '7:00 PM'],
    instagram: ['11:00 AM', '2:00 PM', '5:00 PM', '8:00 PM'],
    linkedin: ['7:30 AM', '12:00 PM', '5:30 PM'],
    tiktok: ['6:00 AM', '3:00 PM', '7:00 PM', '10:00 PM'],
    facebook: ['9:00 AM', '3:00 PM', '7:00 PM']
  };
  
  const times = bestTimes[platform] || bestTimes.twitter;
  return times[Math.floor(Math.random() * times.length)];
}

// Export with enhanced rate limiting
export async function POST(req: NextRequest) {
  // Apply AI-specific rate limiting
  return enhancedRateLimiters.ai(req, () => generateContent(req));
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