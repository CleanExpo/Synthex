/**
 * Content Translation Service
 * Automatic translation of content using various translation APIs
 */

import { logger } from '../lib/logger.js';
import { i18n } from '../lib/i18n.js';
import { redisService } from '../lib/redis.js';

// Translation service configuration
const TRANSLATION_CONFIG = {
  // Default provider
  defaultProvider: process.env.TRANSLATION_PROVIDER || 'mock',
  
  // Provider configurations
  providers: {
    google: {
      enabled: process.env.GOOGLE_TRANSLATE_ENABLED === 'true',
      apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
      projectId: process.env.GOOGLE_TRANSLATE_PROJECT_ID,
      endpoint: 'https://translation.googleapis.com/language/translate/v2'
    },
    azure: {
      enabled: process.env.AZURE_TRANSLATOR_ENABLED === 'true',
      apiKey: process.env.AZURE_TRANSLATOR_API_KEY,
      region: process.env.AZURE_TRANSLATOR_REGION || 'global',
      endpoint: 'https://api.cognitive.microsofttranslator.com'
    },
    aws: {
      enabled: process.env.AWS_TRANSLATE_ENABLED === 'true',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_TRANSLATE_REGION || 'us-east-1'
    },
    mock: {
      enabled: true,
      // Mock provider for testing
    }
  },
  
  // Cache settings
  cache: {
    enabled: process.env.TRANSLATION_CACHE_ENABLED !== 'false',
    ttl: 86400 * 7, // 7 days
    keyPrefix: 'translation:'
  },
  
  // Quality settings
  quality: {
    minConfidence: 0.8,
    fallbackToDefault: true,
    preserveFormatting: true,
    detectLanguage: true
  },
  
  // Rate limiting
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000
  }
};

class TranslationService {
  constructor() {
    this.rateLimitCounts = new Map();
    this.supportedLanguages = new Set();
    this.init();
  }

  async init() {
    logger.info('Initializing translation service', { category: 'translation' });
    
    // Load supported languages
    await this.loadSupportedLanguages();
    
    // Initialize rate limiting cleanup
    this.startRateLimitCleanup();
    
    logger.info('Translation service initialized', { 
      category: 'translation',
      provider: TRANSLATION_CONFIG.defaultProvider,
      supportedLanguages: this.supportedLanguages.size
    });
  }

  // Main translation function
  async translateText(text, targetLanguage, options = {}) {
    const startTime = Date.now();
    const {
      sourceLanguage = 'auto',
      provider = TRANSLATION_CONFIG.defaultProvider,
      preserveFormatting = TRANSLATION_CONFIG.quality.preserveFormatting,
      platform = null,
      contentType = 'general'
    } = options;

    try {
      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input for translation');
      }

      if (!this.isLanguageSupported(targetLanguage)) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      // Check rate limits
      await this.checkRateLimit();

      // Check cache first
      const cacheKey = this.generateCacheKey(text, sourceLanguage, targetLanguage, platform);
      
      if (TRANSLATION_CONFIG.cache.enabled) {
        const cached = await this.getCachedTranslation(cacheKey);
        if (cached) {
          logger.debug('Translation cache hit', { 
            category: 'translation',
            sourceLanguage,
            targetLanguage,
            textLength: text.length
          });
          return cached;
        }
      }

      // Detect source language if not specified
      let detectedSourceLanguage = sourceLanguage;
      if (sourceLanguage === 'auto' && TRANSLATION_CONFIG.quality.detectLanguage) {
        detectedSourceLanguage = await this.detectLanguage(text, provider);
      }

      // Skip translation if source and target are the same
      if (detectedSourceLanguage === targetLanguage) {
        const result = {
          translatedText: text,
          sourceLanguage: detectedSourceLanguage,
          targetLanguage,
          confidence: 1.0,
          provider: 'none',
          fromCache: false,
          duration: Date.now() - startTime
        };

        // Still cache the result to avoid repeated detection
        if (TRANSLATION_CONFIG.cache.enabled) {
          await this.setCachedTranslation(cacheKey, result);
        }

        return result;
      }

      // Perform translation
      const translation = await this.performTranslation(
        text, 
        detectedSourceLanguage, 
        targetLanguage, 
        provider, 
        options
      );

      // Post-process translation
      let translatedText = translation.translatedText;

      if (preserveFormatting) {
        translatedText = await this.preserveFormatting(text, translatedText);
      }

      if (platform) {
        translatedText = await this.adaptForPlatform(
          translatedText, 
          platform, 
          targetLanguage
        );
      }

      const result = {
        translatedText,
        sourceLanguage: detectedSourceLanguage,
        targetLanguage,
        confidence: translation.confidence || 0.9,
        provider,
        fromCache: false,
        duration: Date.now() - startTime,
        metadata: {
          originalLength: text.length,
          translatedLength: translatedText.length,
          contentType,
          platform
        }
      };

      // Cache the result
      if (TRANSLATION_CONFIG.cache.enabled) {
        await this.setCachedTranslation(cacheKey, result);
      }

      // Log successful translation
      logger.info('Text translated successfully', {
        category: 'translation',
        sourceLanguage: detectedSourceLanguage,
        targetLanguage,
        provider,
        duration: result.duration,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      logger.error('Translation failed', error, {
        category: 'translation',
        sourceLanguage,
        targetLanguage,
        provider,
        textLength: text.length
      });

      // Return fallback result
      if (TRANSLATION_CONFIG.quality.fallbackToDefault) {
        return {
          translatedText: text,
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
          targetLanguage,
          confidence: 0,
          provider: 'fallback',
          error: error.message,
          fromCache: false,
          duration: Date.now() - startTime
        };
      }

      throw error;
    }
  }

  // Detect language of given text
  async detectLanguage(text, provider = TRANSLATION_CONFIG.defaultProvider) {
    try {
      switch (provider) {
        case 'google':
          return await this.detectLanguageGoogle(text);
        case 'azure':
          return await this.detectLanguageAzure(text);
        case 'aws':
          return await this.detectLanguageAWS(text);
        case 'mock':
        default:
          return await this.detectLanguageMock(text);
      }
    } catch (error) {
      logger.warn('Language detection failed', error, { category: 'translation' });
      return 'en'; // Default to English
    }
  }

  // Perform actual translation using specified provider
  async performTranslation(text, sourceLanguage, targetLanguage, provider, options = {}) {
    switch (provider) {
      case 'google':
        return await this.translateWithGoogle(text, sourceLanguage, targetLanguage, options);
      case 'azure':
        return await this.translateWithAzure(text, sourceLanguage, targetLanguage, options);
      case 'aws':
        return await this.translateWithAWS(text, sourceLanguage, targetLanguage, options);
      case 'mock':
      default:
        return await this.translateWithMock(text, sourceLanguage, targetLanguage, options);
    }
  }

  // Google Translate implementation
  async detectLanguageGoogle(text) {
    // This would implement actual Google Translate API call
    // For now, return mock detection
    return this.detectLanguageMock(text);
  }

  async translateWithGoogle(text, sourceLanguage, targetLanguage, options = {}) {
    // This would implement actual Google Translate API call
    // For now, return mock translation
    return this.translateWithMock(text, sourceLanguage, targetLanguage, options);
  }

  // Azure Translator implementation
  async detectLanguageAzure(text) {
    // This would implement actual Azure Translator API call
    // For now, return mock detection
    return this.detectLanguageMock(text);
  }

  async translateWithAzure(text, sourceLanguage, targetLanguage, options = {}) {
    // This would implement actual Azure Translator API call
    // For now, return mock translation
    return this.translateWithMock(text, sourceLanguage, targetLanguage, options);
  }

  // AWS Translate implementation
  async detectLanguageAWS(text) {
    // This would implement actual AWS Translate API call
    // For now, return mock detection
    return this.detectLanguageMock(text);
  }

  async translateWithAWS(text, sourceLanguage, targetLanguage, options = {}) {
    // This would implement actual AWS Translate API call
    // For now, return mock translation
    return this.translateWithMock(text, sourceLanguage, targetLanguage, options);
  }

  // Mock implementation for testing
  async detectLanguageMock(text) {
    // Simple language detection heuristics
    if (/[¡¿ñáéíóúü]/i.test(text)) return 'es';
    if (/[àâäéèêëïîôöùûüÿç]/i.test(text)) return 'fr';
    if (/[äöüß]/i.test(text)) return 'de';
    if (/[àèìòù]/i.test(text)) return 'it';
    if (/[ção]/i.test(text)) return 'pt';
    if (/[ёа-я]/i.test(text)) return 'ru';
    if (/[ひらがなカタカナ漢字]/.test(text)) return 'ja';
    if (/[한글가-힣]/.test(text)) return 'ko';
    if (/[中文汉字]/.test(text)) return 'zh';
    if (/[العربية]/.test(text)) return 'ar';
    if (/[हिन्दी]/.test(text)) return 'hi';
    
    return 'en'; // Default to English
  }

  async translateWithMock(text, sourceLanguage, targetLanguage, options = {}) {
    // Mock translation - just prepend language code for demo
    const translatedText = `[${targetLanguage}] ${text}`;
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      translatedText,
      confidence: 0.95
    };
  }

  // Platform adaptation after translation
  async adaptForPlatform(text, platform, targetLanguage) {
    const localeData = i18n.getLocaleData(targetLanguage);
    const platformConfig = TRANSLATION_CONFIG.platforms || {};
    
    let adapted = text;
    
    // Apply platform-specific length limits
    const platformLimits = {
      instagram: 2200,
      facebook: 8000,
      twitter: 280,
      linkedin: 3000,
      tiktok: 150
    };
    
    const maxLength = platformLimits[platform];
    if (maxLength && adapted.length > maxLength) {
      adapted = await i18n.truncateForPlatform(adapted, maxLength, targetLanguage);
    }
    
    // Apply cultural adaptations
    if (localeData.culturalContext) {
      adapted = await i18n.adaptTone(adapted, localeData.culturalContext.contentTone);
      adapted = await i18n.adaptHashtagStyle(adapted, localeData.culturalContext.hashtagStyle);
    }
    
    return adapted;
  }

  // Preserve original formatting (hashtags, mentions, etc.)
  async preserveFormatting(originalText, translatedText) {
    // Extract formatting elements from original
    const hashtags = originalText.match(/#\w+/g) || [];
    const mentions = originalText.match(/@\w+/g) || [];
    const urls = originalText.match(/https?:\/\/[^\s]+/g) || [];
    const emojis = originalText.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
    
    let preservedText = translatedText;
    
    // Attempt to preserve hashtags at the end
    if (hashtags.length > 0) {
      preservedText = `${preservedText} ${hashtags.join(' ')}`;
    }
    
    // Preserve mentions (these usually shouldn't be translated)
    mentions.forEach(mention => {
      if (!preservedText.includes(mention)) {
        preservedText = preservedText.replace(/(@\w+)/g, mention);
      }
    });
    
    // Preserve URLs (these definitely shouldn't be translated)
    urls.forEach(url => {
      if (!preservedText.includes(url)) {
        preservedText += ` ${url}`;
      }
    });
    
    return preservedText;
  }

  // Batch translation for multiple texts
  async translateBatch(texts, targetLanguage, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 10;
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (text, index) => {
        try {
          const result = await this.translateText(text, targetLanguage, options);
          return { index: i + index, success: true, ...result };
        } catch (error) {
          return { 
            index: i + index, 
            success: false, 
            error: error.message,
            originalText: text
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  // Cache management
  generateCacheKey(text, sourceLanguage, targetLanguage, platform) {
    const crypto = require('crypto');
    const key = `${sourceLanguage}:${targetLanguage}:${platform}:${text}`;
    return TRANSLATION_CONFIG.cache.keyPrefix + 
           crypto.createHash('md5').update(key).digest('hex');
  }

  async getCachedTranslation(cacheKey) {
    try {
      if (redisService.isConnected) {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          const result = JSON.parse(cached);
          result.fromCache = true;
          return result;
        }
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get cached translation', error, { category: 'translation' });
      return null;
    }
  }

  async setCachedTranslation(cacheKey, result) {
    try {
      if (redisService.isConnected) {
        const cacheData = { ...result, fromCache: true };
        await redisService.set(
          cacheKey, 
          JSON.stringify(cacheData), 
          TRANSLATION_CONFIG.cache.ttl
        );
      }
    } catch (error) {
      logger.warn('Failed to cache translation', error, { category: 'translation' });
    }
  }

  // Rate limiting
  async checkRateLimit() {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = Math.floor(now / 86400000);

    const limits = [
      { key: `minute:${minute}`, limit: TRANSLATION_CONFIG.rateLimit.requestsPerMinute },
      { key: `hour:${hour}`, limit: TRANSLATION_CONFIG.rateLimit.requestsPerHour },
      { key: `day:${day}`, limit: TRANSLATION_CONFIG.rateLimit.requestsPerDay }
    ];

    for (const { key, limit } of limits) {
      const count = this.rateLimitCounts.get(key) || 0;
      if (count >= limit) {
        throw new Error(`Rate limit exceeded: ${limit} requests per ${key.split(':')[0]}`);
      }
      this.rateLimitCounts.set(key, count + 1);
    }
  }

  startRateLimitCleanup() {
    setInterval(() => {
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);
      const currentHour = Math.floor(now / 3600000);
      const currentDay = Math.floor(now / 86400000);

      // Clean up old rate limit entries
      for (const key of this.rateLimitCounts.keys()) {
        const [period, timestamp] = key.split(':');
        const time = parseInt(timestamp);

        if (
          (period === 'minute' && time < currentMinute - 1) ||
          (period === 'hour' && time < currentHour - 1) ||
          (period === 'day' && time < currentDay - 1)
        ) {
          this.rateLimitCounts.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  // Utility methods
  isLanguageSupported(language) {
    return i18n.isValidLocale(language);
  }

  async loadSupportedLanguages() {
    // Load supported languages from i18n system
    const supportedLocales = i18n.getSupportedLocales();
    this.supportedLanguages = new Set(supportedLocales.map(locale => locale.code));
  }

  getSupportedLanguages() {
    return Array.from(this.supportedLanguages);
  }

  // Statistics and monitoring
  getStatistics() {
    return {
      supportedLanguages: this.supportedLanguages.size,
      provider: TRANSLATION_CONFIG.defaultProvider,
      cacheEnabled: TRANSLATION_CONFIG.cache.enabled,
      rateLimits: {
        perMinute: TRANSLATION_CONFIG.rateLimit.requestsPerMinute,
        perHour: TRANSLATION_CONFIG.rateLimit.requestsPerHour,
        perDay: TRANSLATION_CONFIG.rateLimit.requestsPerDay
      }
    };
  }

  // Health check
  async healthCheck() {
    try {
      // Test translation with a simple phrase
      const testResult = await this.translateText(
        'Hello, world!', 
        'es',
        { provider: 'mock' }
      );

      return {
        status: 'healthy',
        provider: TRANSLATION_CONFIG.defaultProvider,
        supportedLanguages: this.supportedLanguages.size,
        cacheEnabled: TRANSLATION_CONFIG.cache.enabled,
        testTranslation: testResult.success !== false
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Create singleton instance
export const translationService = new TranslationService();

// Export convenience methods
export const {
  translateText,
  translateBatch,
  detectLanguage,
  getSupportedLanguages,
  healthCheck
} = translationService;

export default translationService;