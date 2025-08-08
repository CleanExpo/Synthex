/**
 * Platform Optimizer API Endpoints
 * Handles optimization requests for all social media platforms
 */

// Platform-specific optimization logic
const platformOptimizers = {
  instagram: {
    maxLength: 2200,
    optimalLength: { min: 125, max: 150 },
    hashtagRange: { min: 10, max: 30 },
    bestTimes: {
      days: ['Tuesday', 'Wednesday', 'Thursday'],
      hours: ['11am', '2pm', '5pm']
    }
  },
  facebook: {
    maxLength: 63206,
    optimalLength: { min: 40, max: 80 },
    hashtagRange: { min: 1, max: 2 },
    bestTimes: {
      days: ['Thursday', 'Friday', 'Saturday'],
      hours: ['1pm', '3pm', '7pm']
    }
  },
  twitter: {
    maxLength: 280,
    optimalLength: { min: 71, max: 100 },
    hashtagRange: { min: 1, max: 2 },
    bestTimes: {
      days: ['Wednesday', 'Friday'],
      hours: ['9am', '12pm', '3pm']
    }
  },
  linkedin: {
    maxLength: 3000,
    optimalLength: { min: 150, max: 300 },
    hashtagRange: { min: 3, max: 5 },
    bestTimes: {
      days: ['Tuesday', 'Wednesday', 'Thursday'],
      hours: ['8am', '10am', '12pm', '5pm']
    }
  },
  tiktok: {
    maxLength: 300,
    optimalLength: { min: 10, max: 50 },
    hashtagRange: { min: 3, max: 5 },
    bestTimes: {
      days: ['Tuesday', 'Thursday', 'Saturday'],
      hours: ['6am', '7pm', '9pm']
    }
  }
};

// Generate relevant hashtags
function generateHashtags(content, platform, count = 5) {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && 
      !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'have', 'will'].includes(word));
  
  const hashtags = words.slice(0, count).map(word => `#${word}`);
  
  // Add platform-specific hashtags
  const platformTags = {
    instagram: ['#instagood', '#photooftheday', '#instadaily', '#love', '#beautiful'],
    facebook: ['#community', '#share', '#connect'],
    twitter: ['#trending', '#breaking'],
    linkedin: ['#professional', '#business', '#leadership', '#industry', '#growth'],
    tiktok: ['#fyp', '#foryou', '#viral', '#trending', '#tiktok']
  };
  
  const platformSpecific = platformTags[platform] || [];
  return [...hashtags, ...platformSpecific.slice(0, 3)].slice(0, count);
}

// Calculate optimization score
function calculateScore(content, platform, options = {}) {
  let score = 70; // Base score
  const config = platformOptimizers[platform];
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = content.length;
  
  // Length optimization
  if (config.optimalLength) {
    if (wordCount >= config.optimalLength.min && wordCount <= config.optimalLength.max) {
      score += 10;
    } else if (wordCount < config.optimalLength.min) {
      score -= 5;
    }
  }
  
  // Character count for Twitter
  if (platform === 'twitter') {
    if (charCount <= 240) score += 10;
    if (charCount <= 200) score += 5;
    if (charCount > 280) score -= 20;
  }
  
  // Engagement elements
  const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(content);
  const hasHashtags = /#\w+/g.test(content);
  const hasQuestion = /\?/.test(content);
  const hasCallToAction = /(click|tap|swipe|comment|share|follow|link|bio|check|visit)/i.test(content);
  const hasNumbers = /\b\d+\b/g.test(content);
  
  if (hasEmojis) score += 5;
  if (hasHashtags) score += 5;
  if (hasQuestion) score += 10;
  if (hasCallToAction) score += 10;
  if (hasNumbers) score += 5;
  
  // Platform-specific bonuses
  switch (platform) {
    case 'instagram':
      if (content.includes('@')) score += 5; // Mentions
      break;
    case 'linkedin':
      if (content.match(/\b(insight|experience|learned|professional|industry)\b/i)) score += 10;
      break;
    case 'tiktok':
      if (content.match(/\b(trend|viral|challenge|duet)\b/i)) score += 8;
      break;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

// Generate suggestions
function generateSuggestions(content, platform, score) {
  const suggestions = [];
  const config = platformOptimizers[platform];
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = content.length;
  
  // Length suggestions
  if (config.optimalLength) {
    if (wordCount < config.optimalLength.min) {
      suggestions.push(`Consider expanding your content (current: ${wordCount} words, optimal: ${config.optimalLength.min}-${config.optimalLength.max} words)`);
    } else if (wordCount > config.optimalLength.max) {
      suggestions.push(`Consider shortening your content (current: ${wordCount} words, optimal: ${config.optimalLength.min}-${config.optimalLength.max} words)`);
    }
  }
  
  // Platform-specific suggestions
  if (platform === 'twitter' && charCount > 240) {
    suggestions.push('Consider shortening to leave room for retweets and replies');
  }
  
  if (!/#\w+/g.test(content)) {
    const range = config.hashtagRange;
    suggestions.push(`Add ${range.min}-${range.max} relevant hashtags to increase discoverability`);
  }
  
  if (!/[\u{1F300}-\u{1F9FF}]/u.test(content)) {
    suggestions.push('Add emojis to increase visual appeal and engagement');
  }
  
  if (!/\?/.test(content)) {
    suggestions.push('Consider asking a question to encourage engagement');
  }
  
  if (!/\b(click|tap|swipe|comment|share|follow|link|bio|check|visit)\b/i.test(content)) {
    suggestions.push('Include a clear call-to-action to drive desired behavior');
  }
  
  // Score-based suggestions
  if (score < 60) {
    suggestions.push('Content needs significant optimization for better performance');
  } else if (score < 80) {
    suggestions.push('Good content! A few tweaks could improve engagement');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Excellent! Your content is well-optimized for this platform');
  }
  
  return suggestions;
}

// Main optimization handler
async function optimizeContent(platform, content, options = {}) {
  if (!platformOptimizers[platform]) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  const config = platformOptimizers[platform];
  const score = calculateScore(content, platform, options);
  const suggestions = generateSuggestions(content, platform, score);
  const hashtags = generateHashtags(content, platform, config.hashtagRange.max);
  
  return {
    platform,
    content,
    score,
    optimized: score >= 80,
    suggestions,
    hashtags: options.includeHashtags !== false ? hashtags : [],
    bestTiming: options.includeTiming !== false ? config.bestTimes : null,
    analytics: {
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      charCount: content.length,
      readingTime: Math.ceil(content.split(/\s+/).length / 200), // minutes
      sentiment: analyzeSentiment(content)
    },
    recommendations: getRecommendations(platform, content, score)
  };
}

// Simple sentiment analysis
function analyzeSentiment(content) {
  const positiveWords = ['great', 'awesome', 'excellent', 'amazing', 'love', 'best', 'happy', 'excited', 'wonderful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'sad', 'angry', 'disappointed'];
  
  const words = content.toLowerCase().split(/\s+/);
  const positive = words.filter(word => positiveWords.includes(word)).length;
  const negative = words.filter(word => negativeWords.includes(word)).length;
  
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

// Get platform-specific recommendations
function getRecommendations(platform, content, score) {
  const recs = {
    posting: `Best times: ${platformOptimizers[platform].bestTimes.days.join(', ')} at ${platformOptimizers[platform].bestTimes.hours.join(', ')}`,
    engagement: 'Respond to comments within the first hour for maximum reach',
    content: ''
  };
  
  switch (platform) {
    case 'instagram':
      recs.content = 'Use high-quality visuals and Instagram Stories for behind-the-scenes content';
      break;
    case 'facebook':
      recs.content = 'Native videos perform 6x better than external links';
      break;
    case 'twitter':
      recs.content = 'Create threads for longer content and use Twitter Spaces for live discussions';
      break;
    case 'linkedin':
      recs.content = 'Share professional insights and tag relevant industry leaders';
      break;
    case 'tiktok':
      recs.content = 'Use trending sounds and participate in challenges for maximum reach';
      break;
  }
  
  return recs;
}

// API Handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { method, query, body } = req;
    
    if (method === 'GET' && query.platform) {
      // Get platform info
      const platform = query.platform.toLowerCase();
      if (!platformOptimizers[platform]) {
        return res.status(400).json({ error: 'Unsupported platform' });
      }
      
      res.json({
        platform,
        config: platformOptimizers[platform],
        supported: true
      });
      
    } else if (method === 'POST') {
      const { platform, content, options = {} } = body;
      
      if (!platform || !content) {
        return res.status(400).json({ 
          error: 'Missing required fields: platform and content' 
        });
      }
      
      const result = await optimizeContent(platform.toLowerCase(), content, options);
      res.json(result);
      
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Optimize API error:', error);
    res.status(500).json({
      error: 'Optimization failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Export for testing
export { optimizeContent, calculateScore, generateHashtags };