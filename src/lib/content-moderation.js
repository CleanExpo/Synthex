/**
 * Advanced Content Moderation System
 * Comprehensive content safety, filtering, and compliance management
 */

import { logger } from './logger.js';
import { redisService } from './redis.js';
import { db } from './supabase.js';
import { emailService } from './email.js';

// Content moderation configuration
const MODERATION_CONFIG = {
  // Safety levels
  safetyLevels: {
    STRICT: {
      toxicityThreshold: 0.3,
      profanityThreshold: 0.2,
      spamThreshold: 0.4,
      requireReview: true,
      blockImmediately: true
    },
    MODERATE: {
      toxicityThreshold: 0.6,
      profanityThreshold: 0.5,
      spamThreshold: 0.7,
      requireReview: false,
      blockImmediately: false
    },
    PERMISSIVE: {
      toxicityThreshold: 0.8,
      profanityThreshold: 0.7,
      spamThreshold: 0.8,
      requireReview: false,
      blockImmediately: false
    }
  },

  // Content categories to check
  categories: {
    toxicity: { enabled: true, weight: 1.0 },
    profanity: { enabled: true, weight: 0.8 },
    spam: { enabled: true, weight: 0.9 },
    harassment: { enabled: true, weight: 1.0 },
    hate_speech: { enabled: true, weight: 1.0 },
    violence: { enabled: true, weight: 1.0 },
    adult_content: { enabled: true, weight: 0.7 },
    misinformation: { enabled: true, weight: 0.9 },
    copyright: { enabled: true, weight: 1.0 },
    privacy: { enabled: true, weight: 1.0 }
  },

  // Platform-specific rules
  platformRules: {
    instagram: {
      maxLength: 2200,
      maxHashtags: 30,
      restrictedWords: ['dm', 'click link', 'swipe up'],
      requireImageDescription: false
    },
    facebook: {
      maxLength: 8000,
      maxHashtags: 10,
      restrictedWords: ['share if you agree', 'tag friends'],
      preventLinkSpam: true
    },
    twitter: {
      maxLength: 280,
      maxHashtags: 5,
      restrictedWords: ['follow for follow', 'f4f'],
      preventSpamMentions: true
    },
    linkedin: {
      maxLength: 3000,
      maxHashtags: 5,
      restrictedWords: ['mlm', 'get rich quick'],
      requireProfessional: true
    },
    tiktok: {
      maxLength: 150,
      maxHashtags: 20,
      restrictedWords: ['free money', 'easy money'],
      preventTrendManipulation: true
    }
  },

  // Cache settings
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    keyPrefix: 'moderation:'
  }
};

// Profanity and blocked words lists
const BLOCKED_WORDS = {
  // Basic profanity (placeholder - real implementation would have comprehensive lists)
  profanity: [
    // This would contain actual profanity words
    'example_bad_word_1',
    'example_bad_word_2'
  ],

  // Spam indicators
  spam: [
    'click here now',
    'free money fast',
    'earn $1000 daily',
    'no experience needed',
    'work from home scam',
    'get rich quick',
    'make money online',
    'bitcoin giveaway',
    'crypto pump',
    'investment opportunity'
  ],

  // Harassment terms
  harassment: [
    'kill yourself',
    'you should die',
    'worthless human'
  ],

  // Hate speech indicators
  hate_speech: [
    // This would contain actual hate speech patterns
    'hate_speech_example'
  ],

  // Violence indicators
  violence: [
    'bomb making',
    'how to kill',
    'murder instructions',
    'terrorist attack'
  ],

  // Misinformation keywords
  misinformation: [
    'vaccines cause autism',
    'covid is fake',
    'election fraud proven',
    'flat earth proof'
  ]
};

// Regex patterns for advanced detection
const DETECTION_PATTERNS = {
  // URL patterns for link analysis
  urls: /https?:\/\/[^\s]+/gi,
  
  // Email patterns
  emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Phone number patterns
  phones: /(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/gi,
  
  // Social media handles
  handles: /@[A-Za-z0-9_]+/gi,
  
  // Hashtags
  hashtags: /#[A-Za-z0-9_]+/gi,
  
  // Excessive punctuation (spam indicator)
  excessivePunctuation: /[!?]{3,}|[.]{4,}/gi,
  
  // All caps (spam indicator)
  allCaps: /\b[A-Z]{4,}\b/gi,
  
  // Repeated characters (spam indicator)
  repeatedChars: /(.)\1{4,}/gi,
  
  // Money/financial scam patterns
  money: /\$\d+|\d+\s?(dollars?|usd|money|cash|earn|make)/gi,
  
  // Urgency indicators (spam)
  urgency: /\b(urgent|asap|hurry|limited time|act now|expires soon)\b/gi
};

class ContentModerationSystem {
  constructor() {
    this.blockedWordsCache = new Map();
    this.moderationCache = new Map();
    this.flaggedContent = new Map();
    this.userReputation = new Map();
    this.init();
  }

  async init() {
    logger.info('Initializing content moderation system', { category: 'moderation' });
    
    // Load blocked words into cache
    await this.loadBlockedWords();
    
    // Start reputation monitoring
    this.startReputationMonitoring();
    
    // Load user reputation scores
    await this.loadUserReputations();
    
    logger.info('Content moderation system initialized', { category: 'moderation' });
  }

  // Main content moderation function
  async moderateContent(content, options = {}) {
    const startTime = Date.now();
    const {
      userId,
      platform = 'general',
      safetyLevel = 'MODERATE',
      skipCache = false
    } = options;

    try {
      // Check cache first
      if (!skipCache && MODERATION_CONFIG.cache.enabled) {
        const cachedResult = await this.getCachedModeration(content);
        if (cachedResult) {
          logger.debug('Content moderation cache hit', { category: 'moderation' });
          return cachedResult;
        }
      }

      // Perform comprehensive moderation
      const moderationResult = await this.performComprehensiveModeration(
        content, 
        platform, 
        safetyLevel, 
        userId
      );

      // Cache the result
      if (MODERATION_CONFIG.cache.enabled) {
        await this.setCachedModeration(content, moderationResult);
      }

      // Log moderation activity
      this.logModerationActivity(content, moderationResult, options);

      // Update user reputation if needed
      if (userId && !moderationResult.approved) {
        await this.updateUserReputation(userId, moderationResult);
      }

      const duration = Date.now() - startTime;
      logger.debug('Content moderation completed', {
        category: 'moderation',
        duration,
        approved: moderationResult.approved,
        platform
      });

      return moderationResult;

    } catch (error) {
      logger.error('Content moderation failed', error, { 
        category: 'moderation',
        platform,
        contentLength: content.length 
      });
      
      // Fail safe - return conservative result
      return {
        approved: false,
        confidence: 1.0,
        reasons: ['moderation_system_error'],
        categories: {},
        recommendations: ['Content blocked due to system error - please try again'],
        requiresReview: true,
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Comprehensive moderation analysis
  async performComprehensiveModeration(content, platform, safetyLevel, userId) {
    const safetyConfig = MODERATION_CONFIG.safetyLevels[safetyLevel];
    const platformRules = MODERATION_CONFIG.platformRules[platform] || {};
    
    // Initialize result
    const result = {
      approved: true,
      confidence: 0,
      reasons: [],
      categories: {},
      recommendations: [],
      requiresReview: false,
      metadata: {
        platform,
        safetyLevel,
        contentLength: content.length,
        timestamp: new Date().toISOString()
      }
    };

    // 1. Basic content validation
    await this.validateBasicContent(content, platformRules, result);

    // 2. Text analysis
    await this.analyzeTextContent(content, safetyConfig, result);

    // 3. Pattern detection
    await this.detectSuspiciousPatterns(content, result);

    // 4. User reputation factor
    if (userId) {
      await this.applyUserReputationFactor(userId, result);
    }

    // 5. Platform-specific checks
    await this.performPlatformSpecificChecks(content, platform, result);

    // 6. Final decision logic
    this.makeFinalModerationDecision(result, safetyConfig);

    return result;
  }

  // Basic content validation (length, format, etc.)
  async validateBasicContent(content, platformRules, result) {
    // Check content length
    if (platformRules.maxLength && content.length > platformRules.maxLength) {
      result.approved = false;
      result.reasons.push('content_too_long');
      result.recommendations.push(`Content exceeds maximum length of ${platformRules.maxLength} characters`);
    }

    // Check for empty content
    if (!content.trim()) {
      result.approved = false;
      result.reasons.push('empty_content');
      result.recommendations.push('Content cannot be empty');
    }

    // Check hashtag count
    const hashtags = content.match(DETECTION_PATTERNS.hashtags) || [];
    if (platformRules.maxHashtags && hashtags.length > platformRules.maxHashtags) {
      result.approved = false;
      result.reasons.push('too_many_hashtags');
      result.recommendations.push(`Reduce hashtags to maximum ${platformRules.maxHashtags}`);
    }

    result.metadata.hashtags = hashtags.length;
  }

  // Text content analysis
  async analyzeTextContent(content, safetyConfig, result) {
    const lowercaseContent = content.toLowerCase();
    
    // Analyze each category
    for (const [category, config] of Object.entries(MODERATION_CONFIG.categories)) {
      if (!config.enabled) continue;

      const score = await this.analyzeCategoryContent(lowercaseContent, category);
      result.categories[category] = {
        score: score,
        threshold: safetyConfig[`${category}Threshold`] || 0.7,
        flagged: false
      };

      // Check if category is flagged
      const threshold = safetyConfig[`${category}Threshold`] || 0.7;
      if (score >= threshold) {
        result.categories[category].flagged = true;
        result.approved = false;
        result.reasons.push(`${category}_detected`);
        result.recommendations.push(this.getCategoryRecommendation(category));
        result.confidence = Math.max(result.confidence, score * config.weight);
      }
    }
  }

  // Analyze specific content categories
  async analyzeCategoryContent(content, category) {
    const blockedWords = BLOCKED_WORDS[category] || [];
    let score = 0;
    let matchCount = 0;

    // Check for blocked words
    for (const word of blockedWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = content.match(regex) || [];
      if (matches.length > 0) {
        matchCount += matches.length;
        score += matches.length * 0.2; // Each match increases score
      }
    }

    // Apply category-specific analysis
    switch (category) {
      case 'spam':
        score += this.analyzeSpamIndicators(content);
        break;
      case 'toxicity':
        score += this.analyzeToxicityIndicators(content);
        break;
      case 'profanity':
        score += this.analyzeProfanityLevel(content);
        break;
      case 'harassment':
        score += this.analyzeHarassmentIndicators(content);
        break;
      case 'misinformation':
        score += this.analyzeMisinformationIndicators(content);
        break;
    }

    // Normalize score to 0-1 range
    return Math.min(score, 1.0);
  }

  // Spam analysis
  analyzeSpamIndicators(content) {
    let spamScore = 0;

    // Excessive punctuation
    const excessivePunctuation = content.match(DETECTION_PATTERNS.excessivePunctuation) || [];
    spamScore += excessivePunctuation.length * 0.1;

    // All caps text
    const allCaps = content.match(DETECTION_PATTERNS.allCaps) || [];
    spamScore += allCaps.length * 0.05;

    // Repeated characters
    const repeatedChars = content.match(DETECTION_PATTERNS.repeatedChars) || [];
    spamScore += repeatedChars.length * 0.1;

    // Money/financial terms
    const moneyTerms = content.match(DETECTION_PATTERNS.money) || [];
    spamScore += moneyTerms.length * 0.15;

    // Urgency indicators
    const urgencyTerms = content.match(DETECTION_PATTERNS.urgency) || [];
    spamScore += urgencyTerms.length * 0.1;

    // URL density (too many links)
    const urls = content.match(DETECTION_PATTERNS.urls) || [];
    if (urls.length > 3) spamScore += 0.2;

    return spamScore;
  }

  // Toxicity analysis
  analyzeToxicityIndicators(content) {
    let toxicityScore = 0;

    // Check for aggressive language patterns
    const aggressivePatterns = [
      /you\s+(are|r)\s+(stupid|dumb|idiot)/gi,
      /shut\s+up/gi,
      /go\s+(die|away)/gi,
      /i\s+hate\s+you/gi
    ];

    for (const pattern of aggressivePatterns) {
      const matches = content.match(pattern) || [];
      toxicityScore += matches.length * 0.3;
    }

    // Personal attacks
    const personalAttacks = [
      /you\s+(suck|fail|loser)/gi,
      /your\s+(mom|mother|face)/gi
    ];

    for (const pattern of personalAttacks) {
      const matches = content.match(pattern) || [];
      toxicityScore += matches.length * 0.2;
    }

    return toxicityScore;
  }

  // Profanity level analysis
  analyzeProfanityLevel(content) {
    // This would use a comprehensive profanity detection system
    // For now, basic implementation
    const profanityWords = BLOCKED_WORDS.profanity || [];
    let profanityScore = 0;

    for (const word of profanityWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = content.match(regex) || [];
      profanityScore += matches.length * 0.3;
    }

    return Math.min(profanityScore, 1.0);
  }

  // Harassment indicators
  analyzeHarassmentIndicators(content) {
    let harassmentScore = 0;

    // Direct threats
    const threatPatterns = [
      /i\s+will\s+(kill|hurt|find)/gi,
      /you\s+(should|gonna|will)\s+die/gi,
      /i\s+know\s+where\s+you\s+live/gi
    ];

    for (const pattern of threatPatterns) {
      const matches = content.match(pattern) || [];
      harassmentScore += matches.length * 0.5;
    }

    return harassmentScore;
  }

  // Misinformation indicators
  analyzeMisinformationIndicators(content) {
    let misinfoScore = 0;

    // Check for common misinformation phrases
    const misinfoPatterns = [
      /proven\s+fact/gi,
      /they\s+don't\s+want\s+you\s+to\s+know/gi,
      /wake\s+up\s+sheeple/gi,
      /do\s+your\s+research/gi
    ];

    for (const pattern of misinfoPatterns) {
      const matches = content.match(pattern) || [];
      misinfoScore += matches.length * 0.2;
    }

    return misinfoScore;
  }

  // Suspicious pattern detection
  async detectSuspiciousPatterns(content, result) {
    // Check for excessive self-promotion
    const handles = content.match(DETECTION_PATTERNS.handles) || [];
    const urls = content.match(DETECTION_PATTERNS.urls) || [];
    
    if (handles.length > 5 || urls.length > 3) {
      result.reasons.push('excessive_promotion');
      result.recommendations.push('Reduce promotional content and links');
    }

    // Check for contact information sharing (potential privacy issue)
    const emails = content.match(DETECTION_PATTERNS.emails) || [];
    const phones = content.match(DETECTION_PATTERNS.phones) || [];
    
    if (emails.length > 0 || phones.length > 0) {
      result.reasons.push('personal_info_detected');
      result.recommendations.push('Avoid sharing personal contact information publicly');
    }

    // Update metadata
    result.metadata.patterns = {
      handles: handles.length,
      urls: urls.length,
      emails: emails.length,
      phones: phones.length
    };
  }

  // Apply user reputation factor
  async applyUserReputationFactor(userId, result) {
    const reputation = await this.getUserReputation(userId);
    
    // Adjust confidence based on user reputation
    if (reputation.score < 0.3) {
      // Low reputation users get stricter moderation
      result.confidence *= 1.5;
      result.requiresReview = true;
    } else if (reputation.score > 0.8) {
      // High reputation users get more lenient moderation
      result.confidence *= 0.7;
    }

    result.metadata.userReputation = reputation;
  }

  // Platform-specific checks
  async performPlatformSpecificChecks(content, platform, result) {
    const platformRules = MODERATION_CONFIG.platformRules[platform] || {};
    
    // Check for platform-specific restricted words
    if (platformRules.restrictedWords) {
      const lowercaseContent = content.toLowerCase();
      
      for (const restrictedWord of platformRules.restrictedWords) {
        if (lowercaseContent.includes(restrictedWord)) {
          result.reasons.push(`platform_restricted_content_${platform}`);
          result.recommendations.push(`Avoid using "${restrictedWord}" on ${platform}`);
        }
      }
    }

    // LinkedIn professional content check
    if (platform === 'linkedin' && platformRules.requireProfessional) {
      const professionalScore = this.analyzeProfessionalContent(content);
      if (professionalScore < 0.5) {
        result.reasons.push('unprofessional_content');
        result.recommendations.push('Content should maintain professional tone for LinkedIn');
      }
    }
  }

  // Analyze professional content for LinkedIn
  analyzeProfessionalContent(content) {
    let professionalScore = 0.7; // Start with neutral score
    
    // Professional keywords increase score
    const professionalTerms = [
      'business', 'professional', 'career', 'experience', 'skills',
      'industry', 'leadership', 'management', 'strategy', 'innovation'
    ];
    
    const lowercaseContent = content.toLowerCase();
    for (const term of professionalTerms) {
      if (lowercaseContent.includes(term)) {
        professionalScore += 0.1;
      }
    }
    
    // Unprofessional elements decrease score
    const unprofessionalPatterns = [
      /lol|omg|wtf/gi,
      /party|drunk|hangover/gi,
      /personal|private|relationship/gi
    ];
    
    for (const pattern of unprofessionalPatterns) {
      const matches = content.match(pattern) || [];
      professionalScore -= matches.length * 0.2;
    }
    
    return Math.max(Math.min(professionalScore, 1.0), 0);
  }

  // Final moderation decision
  makeFinalModerationDecision(result, safetyConfig) {
    // If any major violation detected, block content
    if (result.confidence > 0.8) {
      result.approved = false;
      result.requiresReview = true;
    }
    
    // Safety level specific adjustments
    if (safetyConfig.requireReview && result.confidence > 0.5) {
      result.requiresReview = true;
    }
    
    if (safetyConfig.blockImmediately && result.confidence > 0.3) {
      result.approved = false;
    }
    
    // Generate final recommendations
    if (!result.approved) {
      result.recommendations.unshift('Content violates community guidelines');
    } else if (result.requiresReview) {
      result.recommendations.unshift('Content flagged for manual review');
    }
  }

  // User reputation management
  async getUserReputation(userId) {
    // Check cache first
    if (this.userReputation.has(userId)) {
      return this.userReputation.get(userId);
    }

    try {
      // Load from database
      const { data, error } = await db.supabase
        .from('user_reputation')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Create default reputation
        const defaultReputation = {
          userId,
          score: 0.5,
          totalContent: 0,
          flaggedContent: 0,
          strikes: 0,
          lastUpdated: new Date().toISOString()
        };
        
        this.userReputation.set(userId, defaultReputation);
        return defaultReputation;
      }

      this.userReputation.set(userId, data);
      return data;

    } catch (error) {
      logger.error('Failed to load user reputation', error, { category: 'moderation' });
      return { userId, score: 0.5, strikes: 0 };
    }
  }

  async updateUserReputation(userId, moderationResult) {
    try {
      const reputation = await this.getUserReputation(userId);
      
      // Update reputation based on moderation result
      if (!moderationResult.approved) {
        reputation.flaggedContent++;
        reputation.score = Math.max(reputation.score - 0.1, 0);
        
        if (moderationResult.confidence > 0.8) {
          reputation.strikes++;
        }
      } else {
        // Improve reputation for approved content
        reputation.score = Math.min(reputation.score + 0.01, 1.0);
      }
      
      reputation.totalContent++;
      reputation.lastUpdated = new Date().toISOString();
      
      // Update cache
      this.userReputation.set(userId, reputation);
      
      // Update database
      await db.supabase
        .from('user_reputation')
        .upsert(reputation);
        
      // Check if user should be flagged for admin review
      if (reputation.strikes >= 3) {
        await this.flagUserForReview(userId, reputation);
      }
      
    } catch (error) {
      logger.error('Failed to update user reputation', error, { category: 'moderation' });
    }
  }

  // Flag user for admin review
  async flagUserForReview(userId, reputation) {
    try {
      logger.warn('User flagged for admin review', {
        category: 'moderation',
        userId,
        strikes: reputation.strikes,
        score: reputation.score
      });

      // Send alert to admins
      if (process.env.ADMIN_EMAIL) {
        await emailService.sendNotificationEmail(
          process.env.ADMIN_EMAIL,
          'System Administrator',
          'User Flagged for Review',
          `User ${userId} has been flagged for review due to multiple content violations.\n\nStrikes: ${reputation.strikes}\nReputation Score: ${reputation.score}\nFlagged Content: ${reputation.flaggedContent}/${reputation.totalContent}`,
          `https://synthex.social/admin/users/${userId}`,
          'Review User'
        );
      }

      // Log to database
      await db.supabase
        .from('moderation_alerts')
        .insert({
          user_id: userId,
          type: 'user_review',
          severity: 'high',
          metadata: reputation,
          created_at: new Date().toISOString()
        });

    } catch (error) {
      logger.error('Failed to flag user for review', error, { category: 'moderation' });
    }
  }

  // Cache management
  async getCachedModeration(content) {
    const cacheKey = `${MODERATION_CONFIG.cache.keyPrefix}${this.hashContent(content)}`;
    
    try {
      if (redisService.isConnected) {
        const cached = await redisService.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } else {
        const cached = this.moderationCache.get(cacheKey);
        return cached?.expires > Date.now() ? cached.data : null;
      }
    } catch (error) {
      return null;
    }
  }

  async setCachedModeration(content, result) {
    const cacheKey = `${MODERATION_CONFIG.cache.keyPrefix}${this.hashContent(content)}`;
    
    try {
      if (redisService.isConnected) {
        await redisService.set(cacheKey, JSON.stringify(result), MODERATION_CONFIG.cache.ttl);
      } else {
        this.moderationCache.set(cacheKey, {
          data: result,
          expires: Date.now() + (MODERATION_CONFIG.cache.ttl * 1000)
        });
      }
    } catch (error) {
      logger.warn('Failed to cache moderation result', error, { category: 'moderation' });
    }
  }

  hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Utility methods
  getCategoryRecommendation(category) {
    const recommendations = {
      toxicity: 'Please use respectful and constructive language',
      profanity: 'Remove inappropriate language to comply with community standards',
      spam: 'Avoid promotional language and excessive formatting',
      harassment: 'Content appears to target or harass individuals',
      hate_speech: 'Remove language that discriminates against groups or individuals',
      violence: 'Content contains references to violence or harmful activities',
      adult_content: 'Content may contain adult themes inappropriate for general audiences',
      misinformation: 'Please verify information accuracy and provide credible sources',
      copyright: 'Content may infringe on copyrighted material',
      privacy: 'Avoid sharing personal or private information'
    };
    
    return recommendations[category] || 'Content flagged for review';
  }

  // Load blocked words from database/config
  async loadBlockedWords() {
    try {
      // In a real implementation, this would load from database
      // For now, using the static BLOCKED_WORDS object
      for (const [category, words] of Object.entries(BLOCKED_WORDS)) {
        this.blockedWordsCache.set(category, new Set(words));
      }
      
      logger.debug('Blocked words loaded', { 
        category: 'moderation',
        categories: Object.keys(BLOCKED_WORDS).length 
      });
    } catch (error) {
      logger.error('Failed to load blocked words', error, { category: 'moderation' });
    }
  }

  // Load user reputations
  async loadUserReputations() {
    try {
      // Load recent user reputations
      const { data, error } = await db.supabase
        .from('user_reputation')
        .select('*')
        .gte('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!error && data) {
        for (const reputation of data) {
          this.userReputation.set(reputation.user_id, reputation);
        }
      }

      logger.debug('User reputations loaded', { 
        category: 'moderation',
        count: this.userReputation.size 
      });
    } catch (error) {
      logger.warn('Failed to load user reputations', error, { category: 'moderation' });
    }
  }

  // Start reputation monitoring
  startReputationMonitoring() {
    setInterval(async () => {
      await this.cleanupReputationCache();
    }, 60 * 60 * 1000); // Every hour
  }

  async cleanupReputationCache() {
    // Clean up old cache entries
    const hourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [key, value] of this.moderationCache.entries()) {
      if (value.expires < hourAgo) {
        this.moderationCache.delete(key);
      }
    }
  }

  // Logging
  logModerationActivity(content, result, options) {
    logger.info('Content moderation completed', {
      category: 'moderation',
      approved: result.approved,
      confidence: result.confidence,
      reasons: result.reasons,
      platform: options.platform,
      userId: options.userId,
      contentLength: content.length,
      requiresReview: result.requiresReview
    });
  }

  // Statistics and monitoring
  async getModerationStats(timeframe = '24h') {
    try {
      const timeFilter = this.getTimeFilter(timeframe);
      
      // This would query actual moderation logs from database
      return {
        totalModerated: 0,
        approved: 0,
        rejected: 0,
        flaggedForReview: 0,
        categories: {},
        platforms: {},
        userReputations: this.userReputation.size
      };
    } catch (error) {
      logger.error('Failed to get moderation stats', error, { category: 'moderation' });
      return null;
    }
  }

  getTimeFilter(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  // Health check
  async healthCheck() {
    return {
      status: 'healthy',
      blockedWordsLoaded: this.blockedWordsCache.size,
      userReputationsLoaded: this.userReputation.size,
      cacheSize: this.moderationCache.size,
      categories: Object.keys(MODERATION_CONFIG.categories).length
    };
  }
}

// Create singleton instance
export const contentModerator = new ContentModerationSystem();

// Export convenience methods
export const {
  moderateContent,
  getUserReputation,
  getModerationStats,
  healthCheck
} = contentModerator;

export default contentModerator;