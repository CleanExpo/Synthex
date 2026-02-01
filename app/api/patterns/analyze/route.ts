import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase-client';

// Platform-specific engagement benchmarks
const PLATFORM_BENCHMARKS = {
  twitter: {
    avgEngagementRate: 0.05,
    viralThreshold: 1000,
    peakHours: [9, 12, 15, 19],
  },
  linkedin: {
    avgEngagementRate: 0.08,
    viralThreshold: 500,
    peakHours: [8, 12, 17],
  },
  tiktok: {
    avgEngagementRate: 0.15,
    viralThreshold: 10000,
    peakHours: [6, 10, 19, 22],
  },
  instagram: {
    avgEngagementRate: 0.10,
    viralThreshold: 5000,
    peakHours: [11, 13, 17, 20],
  },
  facebook: {
    avgEngagementRate: 0.06,
    viralThreshold: 2000,
    peakHours: [9, 13, 15, 20],
  },
};

// Content hook patterns
const HOOK_PATTERNS = {
  question: /^(why|what|how|when|where|who|did you know|can you|would you)/i,
  story: /^(just|today|yesterday|last week|remember when|story time)/i,
  controversy: /^(unpopular opinion|hot take|controversial|nobody talks about)/i,
  data: /^(\d+%|studies show|research reveals|statistics|data shows)/i,
  humor: /^(pov:|imagine|me when|that moment when|mood:)/i,
  achievement: /^(just shipped|launched|proud to|excited to|finally)/i,
  vulnerability: /^(failed|learned|mistake|struggling|confession)/i,
  relatable: /^(anyone else|we all|everyone|who else|am i the only)/i,
};

// Sentiment keywords
const SENTIMENT_KEYWORDS = {
  positive: ['amazing', 'awesome', 'excellent', 'love', 'great', 'fantastic', 'wonderful', 'best', 'perfect', 'success'],
  negative: ['terrible', 'awful', 'hate', 'worst', 'fail', 'bad', 'poor', 'horrible', 'disaster', 'problem'],
  neutral: ['okay', 'fine', 'average', 'normal', 'regular', 'standard', 'typical', 'usual', 'common'],
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const timeRange = searchParams.get('timeRange') || '7d';

    // Fetch existing patterns from database
    const patterns = await db.patterns.list(platform || undefined);

    // Calculate time range filter
    const now = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
    }

    // Filter patterns by time range
    const filteredPatterns = patterns.filter(
      (p: any) => new Date(p.discovered_at) >= startDate
    );

    // Analyze patterns for insights
    const insights = analyzePatterns(filteredPatterns);

    return NextResponse.json({
      success: true,
      patterns: filteredPatterns,
      insights,
      count: filteredPatterns.length,
    });
  } catch (error: any) {
    console.error('Pattern analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, content, metrics } = body;

    if (!platform || !content) {
      return NextResponse.json(
        { error: 'Platform and content are required' },
        { status: 400 }
      );
    }

    // Analyze the content
    const analysis = analyzeContent(content, platform, metrics);

    // Calculate virality score
    const viralityScore = calculateViralityScore(metrics, platform);

    // Detect hook type
    const hookType = detectHookType(content);

    // Calculate sentiment
    const sentiment = analyzeSentiment(content);

    // Create pattern data
    const patternData = {
      platform,
      pattern_type: hookType,
      pattern_data: {
        content,
        metrics,
        analysis,
        sentiment,
        hook_type: hookType,
        timestamp: new Date().toISOString(),
      },
      engagement_score: viralityScore,
    };

    // Save to database
    const savedPattern = await db.patterns.create(patternData);

    return NextResponse.json({
      success: true,
      pattern: savedPattern,
      analysis: {
        viralityScore,
        hookType,
        sentiment,
        recommendations: generateRecommendations(analysis, platform),
      },
    });
  } catch (error: any) {
    console.error('Pattern creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create pattern' },
      { status: 500 }
    );
  }
}

// Analyze content characteristics
function analyzeContent(content: string, platform: string, metrics: any) {
  const analysis: any = {
    length: content.length,
    wordCount: content.split(/\s+/).length,
    hasEmojis: /[\u{1F300}-\u{1F9FF}]/u.test(content),
    hasHashtags: /#\w+/.test(content),
    hasMentions: /@\w+/.test(content),
    hasUrls: /https?:\/\/\S+/.test(content),
    hasQuestions: /\?/.test(content),
    hasNumbers: /\d+/.test(content),
    capitalLettersRatio: (content.match(/[A-Z]/g) || []).length / content.length,
    exclamationCount: (content.match(/!/g) || []).length,
  };

  // Platform-specific analysis
  switch (platform) {
    case 'twitter':
      analysis['isThread'] = content.includes('🧵') || content.includes('Thread:');
      analysis['isOptimalLength'] = content.length <= 280;
      break;
    case 'linkedin':
      analysis['hasProfessionalTone'] = /\b(professional|business|career|opportunity|growth)\b/i.test(content);
      analysis['hasCallToAction'] = /\b(comment|share|thoughts|agree|discuss)\b/i.test(content);
      break;
    case 'tiktok':
      analysis['hasTrend'] = /\b(pov|storytime|fyp|foryou)\b/i.test(content);
      analysis['hasHook'] = content.substring(0, 50).includes('?') || /^(wait|stop|look)/i.test(content);
      break;
  }

  return analysis;
}

// Calculate virality score based on metrics
function calculateViralityScore(metrics: any, platform: string) {
  const benchmark = PLATFORM_BENCHMARKS[platform as keyof typeof PLATFORM_BENCHMARKS];
  if (!benchmark) return 0;

  const { impressions = 0, engagement = 0, shares = 0, saves = 0 } = metrics;
  
  // Calculate engagement rate
  const engagementRate = impressions > 0 ? engagement / impressions : 0;
  
  // Compare to platform benchmark
  const engagementScore = Math.min((engagementRate / benchmark.avgEngagementRate) * 50, 50);
  
  // Viral threshold score
  const viralScore = Math.min((engagement / benchmark.viralThreshold) * 30, 30);
  
  // Share amplification score
  const shareScore = Math.min((shares / 100) * 20, 20);
  
  return Math.round(engagementScore + viralScore + shareScore);
}

// Detect content hook type
function detectHookType(content: string) {
  for (const [hookType, pattern] of Object.entries(HOOK_PATTERNS)) {
    if (pattern.test(content)) {
      return hookType;
    }
  }
  return 'general';
}

// Analyze sentiment
function analyzeSentiment(content: string) {
  const lowerContent = content.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  SENTIMENT_KEYWORDS.positive.forEach(word => {
    if (lowerContent.includes(word)) positiveScore++;
  });

  SENTIMENT_KEYWORDS.negative.forEach(word => {
    if (lowerContent.includes(word)) negativeScore++;
  });

  const totalScore = positiveScore + negativeScore;
  if (totalScore === 0) return 0.5; // Neutral

  return positiveScore / totalScore;
}

// Analyze patterns for insights
function analyzePatterns(patterns: any[]) {
  if (patterns.length === 0) {
    return {
      avgViralityScore: 0,
      topHookTypes: [],
      bestTimes: [],
      avgSentiment: 0.5,
    };
  }

  // Calculate average virality score
  const avgViralityScore = patterns.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / patterns.length;

  // Find top hook types
  const hookTypeCounts: Record<string, number> = {};
  patterns.forEach(p => {
    const hookType = p.pattern_data?.hook_type || 'general';
    hookTypeCounts[hookType] = (hookTypeCounts[hookType] || 0) + 1;
  });
  const topHookTypes = Object.entries(hookTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type, count]) => ({ type, count, percentage: (count / patterns.length) * 100 }));

  // Find best posting times
  const hourCounts: Record<number, number> = {};
  patterns.forEach(p => {
    const hour = new Date(p.discovered_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const bestTimes = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  // Calculate average sentiment
  const avgSentiment = patterns.reduce((sum, p) => sum + (p.pattern_data?.sentiment || 0.5), 0) / patterns.length;

  return {
    avgViralityScore: Math.round(avgViralityScore),
    topHookTypes,
    bestTimes,
    avgSentiment,
  };
}

// Generate recommendations based on analysis
function generateRecommendations(analysis: any, platform: string) {
  const recommendations: string[] = [];

  // Length recommendations
  if (platform === 'twitter' && !analysis.isOptimalLength) {
    recommendations.push('Keep tweets under 280 characters for better engagement');
  }
  if (platform === 'linkedin' && analysis.wordCount < 50) {
    recommendations.push('LinkedIn posts with 50-150 words tend to perform better');
  }

  // Content recommendations
  if (!analysis.hasEmojis) {
    recommendations.push('Add 1-2 relevant emojis to increase engagement by up to 25%');
  }
  if (!analysis.hasQuestions && platform !== 'tiktok') {
    recommendations.push('Include a question to encourage comments and boost engagement');
  }
  if (platform === 'linkedin' && !analysis.hasCallToAction) {
    recommendations.push('Add a clear call-to-action to drive meaningful engagement');
  }

  // Timing recommendations
  const benchmark = PLATFORM_BENCHMARKS[platform as keyof typeof PLATFORM_BENCHMARKS];
  if (benchmark) {
    recommendations.push(`Best posting times for ${platform}: ${benchmark.peakHours.join(':00, ')}:00`);
  }

  return recommendations;
}