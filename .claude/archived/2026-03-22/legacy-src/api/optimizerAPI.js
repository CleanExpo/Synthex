/**
 * Optimizer API Integration Layer
 * Handles API calls for platform optimization with fallback support
 */

import { isFeatureEnabled } from '../config/features.js';

export class OptimizerAPI {
  constructor() {
    this.baseURL = '/api';
    this.version = isFeatureEnabled('platformOptimizers') ? 'v2' : 'v1';
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
  }
  
  // Analyze content for platform optimization
  async analyzeContent(platform, content, options = {}) {
    const cacheKey = `${platform}-${content.substring(0, 50)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey) && !options.skipCache) {
      return this.cache.get(cacheKey);
    }
    
    try {
      // Try new optimizer API
      const result = await this.newAnalysis(platform, content, options);
      
      // Cache successful result
      this.cache.set(cacheKey, result);
      
      // Clear old cache entries
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      return result;
    } catch (error) {
      console.error('Optimizer API error, falling back:', error);
      
      // Fallback to legacy analysis
      const fallbackResult = await this.legacyAnalysis(platform, content);

      if (!options.skipCache) {
        this.cache.set(cacheKey, fallbackResult);
      }

      return fallbackResult;
    }
  }
  
  // New optimizer API
  async newAnalysis(platform, content, options = {}) {
    const endpoint = `${this.baseURL}/${this.version}/optimize/${platform}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': this.version
      },
      body: JSON.stringify({
        content,
        options: {
          includeHashtags: options.includeHashtags !== false,
          includeTiming: options.includeTiming !== false,
          includeMedia: options.includeMedia !== false,
          targetAudience: options.targetAudience || 'general',
          tone: options.tone || 'professional',
          ...options
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  // Legacy analysis fallback
  async legacyAnalysis(platform, content) {
    // Client-side analysis as fallback
    const analysis = {
      platform,
      content,
      optimized: true,
      suggestions: [],
      score: 0,
      hashtags: [],
      bestTiming: null,
      mediaRecommendations: []
    };
    
    // Basic content analysis
    const wordCount = content.split(/\s+/).length;
    const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(content);
    const hasHashtags = /#\w+/g.test(content);
    const hasLinks = /https?:\/\/\S+/g.test(content);
    
    // Platform-specific rules
    switch (platform) {
      case 'instagram':
        if (wordCount > 125) {
          analysis.suggestions.push('Consider shortening caption (125 words max for optimal engagement)');
        }
        if (!hasHashtags) {
          analysis.suggestions.push('Add relevant hashtags (10-30 recommended)');
          analysis.hashtags = this.generateHashtags(content, 'instagram');
        }
        if (!hasEmojis) {
          analysis.suggestions.push('Add emojis to increase engagement');
        }
        analysis.bestTiming = { days: ['Tuesday', 'Wednesday'], hours: ['11am', '2pm'] };
        analysis.score = this.calculateScore(content, 'instagram');
        break;
        
      case 'facebook':
        if (wordCount < 40 || wordCount > 80) {
          analysis.suggestions.push('Optimal post length is 40-80 words');
        }
        if (!hasLinks) {
          analysis.suggestions.push('Consider adding a link for higher engagement');
        }
        analysis.bestTiming = { days: ['Thursday', 'Friday'], hours: ['1pm', '3pm'] };
        analysis.score = this.calculateScore(content, 'facebook');
        break;
        
      case 'twitter':
        const charCount = content.length;
        if (charCount > 280) {
          analysis.suggestions.push('Tweet exceeds character limit (280 max)');
        } else if (charCount > 240) {
          analysis.suggestions.push('Consider shorter tweet for retweet space');
        }
        if (!hasHashtags) {
          analysis.suggestions.push('Add 1-2 relevant hashtags');
          analysis.hashtags = this.generateHashtags(content, 'twitter').slice(0, 2);
        }
        analysis.bestTiming = { days: ['Wednesday', 'Friday'], hours: ['9am', '3pm'] };
        analysis.score = this.calculateScore(content, 'twitter');
        break;
        
      case 'linkedin':
        if (wordCount < 150) {
          analysis.suggestions.push('LinkedIn posts perform better with 150+ words');
        }
        if (!hasLinks) {
          analysis.suggestions.push('Add relevant article or resource link');
        }
        analysis.bestTiming = { days: ['Tuesday', 'Thursday'], hours: ['8am', '10am', '5pm'] };
        analysis.score = this.calculateScore(content, 'linkedin');
        break;
        
      case 'tiktok':
        analysis.suggestions.push('Keep captions short and punchy');
        analysis.suggestions.push('Use trending sounds and effects');
        if (!hasHashtags) {
          analysis.hashtags = this.generateHashtags(content, 'tiktok');
        }
        analysis.bestTiming = { days: ['Tuesday', 'Thursday', 'Saturday'], hours: ['6am', '7pm', '9pm'] };
        analysis.mediaRecommendations = ['vertical video', 'trending audio', 'quick cuts'];
        analysis.score = this.calculateScore(content, 'tiktok');
        break;
        
      default:
        analysis.suggestions.push('Platform-specific optimization not available');
        analysis.error = true;
        analysis.message = 'Unsupported platform';
    }
    
    // Calculate overall optimization score
    if (analysis.suggestions.length === 0) {
      analysis.suggestions.push('Content is well-optimized!');
      analysis.score = Math.max(analysis.score, 85);
    }
    
    return analysis;
  }
  
  // Generate relevant hashtags
  generateHashtags(content, platform) {
    const words = content.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => 
      word.length > 4 && !['the', 'and', 'for', 'with', 'this', 'that', 'from'].includes(word)
    );
    
    const hashtags = keywords.slice(0, 5).map(word => `#${word}`);
    
    // Add platform-specific trending hashtags
    switch (platform) {
      case 'instagram':
        hashtags.push('#instagood', '#photooftheday', '#instadaily');
        break;
      case 'twitter':
        hashtags.push('#trending');
        break;
      case 'tiktok':
        hashtags.push('#fyp', '#foryou', '#viral');
        break;
    }
    
    return hashtags;
  }
  
  // Calculate optimization score
  calculateScore(content, platform) {
    let score = 70; // Base score
    
    const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(content);
    const hasHashtags = /#\w+/g.test(content);
    const hasQuestion = /\?/.test(content);
    const hasCallToAction = /(click|tap|swipe|comment|share|follow|link|bio)/i.test(content);
    
    if (hasEmojis) score += 5;
    if (hasHashtags) score += 5;
    if (hasQuestion) score += 10; // Questions increase engagement
    if (hasCallToAction) score += 10;
    
    // Platform-specific scoring
    switch (platform) {
      case 'instagram':
        if (content.length > 50 && content.length < 150) score += 5;
        break;
      case 'twitter':
        if (content.length < 240) score += 5;
        if (content.length < 200) score += 5; // Even better for retweets
        break;
      case 'linkedin':
        if (content.length > 150) score += 10;
        break;
    }
    
    return Math.min(score, 100);
  }
  
  // Batch analyze multiple contents
  async batchAnalyze(items) {
    const results = [];
    
    for (const item of items) {
      try {
        const result = await this.analyzeContent(item.platform, item.content, item.options);
        results.push({ ...result, id: item.id });
      } catch (error) {
        console.error(`Failed to analyze item ${item.id}:`, error);
        results.push({ 
          id: item.id, 
          error: true, 
          message: error.message 
        });
      }
    }
    
    return results;
  }
  
  // Get platform best practices
  async getBestPractices(platform) {
    const practices = {
      instagram: {
        caption: '125-150 words optimal',
        hashtags: '10-30 hashtags',
        timing: 'Tue/Wed 11am-2pm',
        media: 'High-quality images, Reels perform best',
        engagement: 'Ask questions, use polls, respond to comments'
      },
      facebook: {
        caption: '40-80 words optimal',
        hashtags: '1-2 hashtags max',
        timing: 'Thu/Fri 1-3pm',
        media: 'Native video performs best',
        engagement: 'Share valuable content, create discussions'
      },
      twitter: {
        caption: '71-100 characters optimal',
        hashtags: '1-2 hashtags',
        timing: 'Wed/Fri 9am-3pm',
        media: 'Images get 2x engagement',
        engagement: 'Retweet, reply, use threads'
      },
      linkedin: {
        caption: '150-300 words optimal',
        hashtags: '3-5 professional hashtags',
        timing: 'Tue/Thu 8-10am, 5pm',
        media: 'Native documents, professional images',
        engagement: 'Share insights, ask for opinions'
      },
      tiktok: {
        caption: 'Short and catchy',
        hashtags: '3-5 trending hashtags',
        timing: 'Tue/Thu/Sat 6am, 7-9pm',
        media: 'Vertical video, trending sounds',
        engagement: 'Follow trends, use effects, duet/stitch'
      }
    };
    
    return practices[platform] || null;
  }
}

// Create singleton instance
export const optimizerAPI = new OptimizerAPI();

// Export for browser
if (typeof window !== 'undefined') {
  window.synthexOptimizerAPI = optimizerAPI;
}
