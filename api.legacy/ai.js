/**
 * AI API Endpoints
 * Handles AI-powered content generation and optimization
 */

import { aiService } from '../src/lib/ai.js';
import { authService } from '../src/lib/auth.js';
import { db } from '../src/lib/supabase.js';

// Main AI handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from auth token
    const userId = authService.getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { action, ...params } = req.body;

    // Rate limiting
    const rateLimit = aiService.checkRateLimit(userId, action);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: rateLimit.message,
        resetTime: rateLimit.resetTime
      });
    }

    let result;

    switch (action) {
      case 'optimize':
        result = await handleOptimize(params, userId);
        break;
      case 'generate-hashtags':
        result = await handleGenerateHashtags(params);
        break;
      case 'generate-ideas':
        result = await handleGenerateIdeas(params);
        break;
      case 'analyze':
        result = await handleAnalyze(params);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Track usage
    await trackAIUsage(userId, action, params.platform);

    res.json({
      success: true,
      data: result,
      creditsRemaining: rateLimit.remaining
    });

  } catch (error) {
    console.error('AI API error:', error);
    res.status(500).json({
      error: 'AI processing failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Handle content optimization
async function handleOptimize(params, userId) {
  const { platform, content, options = {} } = params;

  if (!platform || !content) {
    throw new Error('Platform and content are required');
  }

  const result = await aiService.generateOptimizedContent(platform, content, options);

  // Save optimized content if user wants to
  if (options.save) {
    await db.content.saveOptimizedContent(userId, {
      platform,
      originalContent: content,
      optimizedContent: result.optimizedContent,
      score: calculateOptimizationScore(result),
      hashtags: result.hashtags,
      suggestions: result.suggestions
    });
  }

  return result;
}

// Handle hashtag generation
async function handleGenerateHashtags(params) {
  const { content, platform, count = 10 } = params;

  if (!content || !platform) {
    throw new Error('Content and platform are required');
  }

  const hashtags = await aiService.generateHashtags(content, platform, count);
  
  return {
    hashtags,
    count: hashtags.length,
    platform
  };
}

// Handle content ideas generation
async function handleGenerateIdeas(params) {
  const { platform, topic, count = 5 } = params;

  if (!platform || !topic) {
    throw new Error('Platform and topic are required');
  }

  const ideas = await aiService.generateContentIdeas(platform, topic, count);
  
  return {
    ideas,
    count: ideas.length,
    platform,
    topic
  };
}

// Handle content analysis
async function handleAnalyze(params) {
  const { content, platform } = params;

  if (!content || !platform) {
    throw new Error('Content and platform are required');
  }

  const analysis = await aiService.analyzeContent(content, platform);
  
  return {
    ...analysis,
    platform,
    contentLength: content.length,
    wordCount: content.split(/\s+/).length
  };
}

// Track AI usage for analytics
async function trackAIUsage(userId, action, platform) {
  try {
    await db.analytics.trackOptimization(userId, platform || 'ai', 0);
    
    // Update feature usage
    const usage = await db.features?.updateUsage?.(userId, `ai_${action}`, platform);
    
  } catch (error) {
    console.error('Failed to track AI usage:', error);
    // Don't throw error for tracking failures
  }
}

// Calculate optimization score
function calculateOptimizationScore(result) {
  let score = 70; // Base score

  // AI-generated content gets bonus
  if (result.aiGenerated) score += 10;
  
  // Hashtags bonus
  if (result.hashtags && result.hashtags.length > 0) score += 10;
  
  // Suggestions indicate analysis depth
  if (result.suggestions && result.suggestions.length > 0) score += 10;

  return Math.min(score, 100);
}