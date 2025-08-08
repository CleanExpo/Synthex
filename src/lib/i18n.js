/**
 * Internationalization (i18n) System
 * Multi-language support with dynamic loading and platform-specific translations
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';
import { redisService } from './redis.js';

// i18n configuration
const I18N_CONFIG = {
  // Default settings
  defaultLocale: process.env.DEFAULT_LOCALE || 'en',
  fallbackLocale: 'en',
  supportedLocales: [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
  ],
  
  // Translation paths
  translationsPath: process.env.TRANSLATIONS_PATH || './src/locales',
  
  // Cache settings
  cache: {
    enabled: process.env.I18N_CACHE_ENABLED !== 'false',
    ttl: 3600, // 1 hour
    keyPrefix: 'i18n:',
    preloadTranslations: true
  },
  
  // Platform-specific settings
  platforms: {
    instagram: {
      maxLength: 2200,
      supportedFormats: ['hashtags', 'mentions', 'emojis']
    },
    facebook: {
      maxLength: 8000,
      supportedFormats: ['hashtags', 'mentions', 'links']
    },
    twitter: {
      maxLength: 280,
      supportedFormats: ['hashtags', 'mentions', 'threads']
    },
    linkedin: {
      maxLength: 3000,
      supportedFormats: ['mentions', 'links', 'professional']
    },
    tiktok: {
      maxLength: 150,
      supportedFormats: ['hashtags', 'trending']
    }
  },
  
  // Content type translations
  contentTypes: [
    'ui', 'content', 'errors', 'notifications', 'emails', 'platform_specific'
  ],
  
  // Auto-detection settings
  detection: {
    enabled: true,
    sources: ['header', 'query', 'cookie', 'session'],
    headerName: 'Accept-Language',
    queryParam: 'lang',
    cookieName: 'locale',
    sessionKey: 'locale'
  }
};

// Locale data with cultural context
const LOCALE_DATA = {
  en: {
    name: 'English',
    nativeName: 'English',
    region: 'US',
    direction: 'ltr',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    numberFormat: {
      decimal: '.',
      thousands: ','
    },
    culturalContext: {
      formalAddress: false,
      hashtagStyle: 'camelCase',
      contentTone: 'casual'
    }
  },
  es: {
    name: 'Español',
    nativeName: 'Español',
    region: 'ES',
    direction: 'ltr',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: {
      decimal: ',',
      thousands: '.'
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'camelCase',
      contentTone: 'warm'
    }
  },
  fr: {
    name: 'Français',
    nativeName: 'Français',
    region: 'FR',
    direction: 'ltr',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: {
      decimal: ',',
      thousands: ' '
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'camelCase',
      contentTone: 'elegant'
    }
  },
  de: {
    name: 'Deutsch',
    nativeName: 'Deutsch',
    region: 'DE',
    direction: 'ltr',
    currency: 'EUR',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    numberFormat: {
      decimal: ',',
      thousands: '.'
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'camelCase',
      contentTone: 'direct'
    }
  },
  it: {
    name: 'Italiano',
    nativeName: 'Italiano',
    region: 'IT',
    direction: 'ltr',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: {
      decimal: ',',
      thousands: '.'
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'camelCase',
      contentTone: 'expressive'
    }
  },
  pt: {
    name: 'Português',
    nativeName: 'Português',
    region: 'BR',
    direction: 'ltr',
    currency: 'BRL',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: {
      decimal: ',',
      thousands: '.'
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'camelCase',
      contentTone: 'friendly'
    }
  },
  ru: {
    name: 'Русский',
    nativeName: 'Русский',
    region: 'RU',
    direction: 'ltr',
    currency: 'RUB',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    numberFormat: {
      decimal: ',',
      thousands: ' '
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'lowercase',
      contentTone: 'formal'
    }
  },
  ja: {
    name: '日本語',
    nativeName: '日本語',
    region: 'JP',
    direction: 'ltr',
    currency: 'JPY',
    dateFormat: 'YYYY/MM/DD',
    timeFormat: '24h',
    numberFormat: {
      decimal: '.',
      thousands: ','
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'kanji',
      contentTone: 'polite'
    }
  },
  ko: {
    name: '한국어',
    nativeName: '한국어',
    region: 'KR',
    direction: 'ltr',
    currency: 'KRW',
    dateFormat: 'YYYY.MM.DD',
    timeFormat: '24h',
    numberFormat: {
      decimal: '.',
      thousands: ','
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'hangul',
      contentTone: 'respectful'
    }
  },
  zh: {
    name: '中文',
    nativeName: '中文',
    region: 'CN',
    direction: 'ltr',
    currency: 'CNY',
    dateFormat: 'YYYY年MM月DD日',
    timeFormat: '24h',
    numberFormat: {
      decimal: '.',
      thousands: ','
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'chinese',
      contentTone: 'harmonious'
    }
  },
  ar: {
    name: 'العربية',
    nativeName: 'العربية',
    region: 'SA',
    direction: 'rtl',
    currency: 'SAR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    numberFormat: {
      decimal: '.',
      thousands: ','
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'arabic',
      contentTone: 'respectful'
    }
  },
  hi: {
    name: 'हिन्दी',
    nativeName: 'हिन्दी',
    region: 'IN',
    direction: 'ltr',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    numberFormat: {
      decimal: '.',
      thousands: ','
    },
    culturalContext: {
      formalAddress: true,
      hashtagStyle: 'devanagari',
      contentTone: 'warm'
    }
  }
};

class InternationalizationSystem {
  constructor() {
    this.translations = new Map();
    this.loadedLocales = new Set();
    this.currentLocale = I18N_CONFIG.defaultLocale;
    this.fallbackChain = [I18N_CONFIG.fallbackLocale];
    this.init();
  }

  async init() {
    logger.info('Initializing i18n system', { category: 'i18n' });
    
    // Preload default and fallback translations
    if (I18N_CONFIG.cache.preloadTranslations) {
      await this.preloadTranslations();
    }
    
    logger.info('i18n system initialized', { 
      category: 'i18n',
      defaultLocale: I18N_CONFIG.defaultLocale,
      supportedLocales: I18N_CONFIG.supportedLocales.length
    });
  }

  // Preload critical translations
  async preloadTranslations() {
    const criticalLocales = [I18N_CONFIG.defaultLocale, I18N_CONFIG.fallbackLocale];
    
    for (const locale of criticalLocales) {
      try {
        await this.loadTranslations(locale);
      } catch (error) {
        logger.warn(`Failed to preload translations for locale: ${locale}`, error, { category: 'i18n' });
      }
    }
  }

  // Load translations for a specific locale
  async loadTranslations(locale) {
    if (this.loadedLocales.has(locale)) {
      return this.translations.get(locale);
    }

    logger.debug(`Loading translations for locale: ${locale}`, { category: 'i18n' });

    try {
      // Check cache first
      if (I18N_CONFIG.cache.enabled) {
        const cached = await this.getCachedTranslations(locale);
        if (cached) {
          this.translations.set(locale, cached);
          this.loadedLocales.add(locale);
          return cached;
        }
      }

      // Load from files
      const translations = await this.loadTranslationFiles(locale);
      
      // Cache translations
      if (I18N_CONFIG.cache.enabled) {
        await this.setCachedTranslations(locale, translations);
      }

      this.translations.set(locale, translations);
      this.loadedLocales.add(locale);

      logger.info(`Loaded translations for locale: ${locale}`, { 
        category: 'i18n',
        keysCount: Object.keys(translations).length
      });

      return translations;

    } catch (error) {
      logger.error(`Failed to load translations for locale: ${locale}`, error, { category: 'i18n' });
      return {};
    }
  }

  // Load translation files from disk
  async loadTranslationFiles(locale) {
    const translations = {};
    const localePath = path.join(I18N_CONFIG.translationsPath, locale);

    try {
      // Check if locale directory exists
      await fs.access(localePath);

      // Load all translation files for this locale
      for (const contentType of I18N_CONFIG.contentTypes) {
        const filePath = path.join(localePath, `${contentType}.json`);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          translations[contentType] = JSON.parse(content);
        } catch (error) {
          // File doesn't exist, skip
          if (error.code !== 'ENOENT') {
            logger.warn(`Failed to load translation file: ${filePath}`, error, { category: 'i18n' });
          }
        }
      }

      return translations;

    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`Translation directory not found: ${localePath}`, { category: 'i18n' });
      } else {
        throw error;
      }
      return {};
    }
  }

  // Get translation with fallback support
  async t(key, options = {}) {
    const {
      locale = this.currentLocale,
      defaultValue = key,
      interpolation = {},
      platform = null,
      contentType = 'ui'
    } = options;

    try {
      // Ensure translations are loaded
      await this.ensureTranslationsLoaded(locale);

      // Try to get translation from primary locale
      let translation = this.getTranslationFromLocale(locale, contentType, key);

      // Try fallback locales if not found
      if (!translation) {
        for (const fallbackLocale of this.fallbackChain) {
          await this.ensureTranslationsLoaded(fallbackLocale);
          translation = this.getTranslationFromLocale(fallbackLocale, contentType, key);
          if (translation) break;
        }
      }

      // Use default value if no translation found
      if (!translation) {
        translation = defaultValue;
        logger.debug(`Translation not found: ${key}`, { 
          category: 'i18n',
          locale,
          contentType 
        });
      }

      // Apply interpolation
      translation = this.interpolate(translation, interpolation);

      // Apply platform-specific adaptations
      if (platform) {
        translation = this.adaptForPlatform(translation, platform, locale);
      }

      return translation;

    } catch (error) {
      logger.error(`Translation error for key: ${key}`, error, { 
        category: 'i18n',
        locale,
        contentType 
      });
      return defaultValue;
    }
  }

  // Get translation from specific locale
  getTranslationFromLocale(locale, contentType, key) {
    const translations = this.translations.get(locale);
    if (!translations || !translations[contentType]) return null;

    // Support nested keys (e.g., "user.profile.name")
    const keys = key.split('.');
    let value = translations[contentType];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  }

  // Ensure translations are loaded for locale
  async ensureTranslationsLoaded(locale) {
    if (!this.loadedLocales.has(locale)) {
      await this.loadTranslations(locale);
    }
  }

  // Interpolate variables in translation strings
  interpolate(text, variables) {
    if (!variables || typeof text !== 'string') return text;

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  // Adapt translation for specific platform
  adaptForPlatform(text, platform, locale) {
    const platformConfig = I18N_CONFIG.platforms[platform];
    const localeData = LOCALE_DATA[locale];

    if (!platformConfig || !localeData) return text;

    let adapted = text;

    // Apply character limit
    if (platformConfig.maxLength && adapted.length > platformConfig.maxLength) {
      adapted = this.truncateForPlatform(adapted, platformConfig.maxLength, locale);
    }

    // Apply cultural adaptations
    if (localeData.culturalContext) {
      adapted = this.applyCulturalAdaptations(adapted, platform, localeData.culturalContext);
    }

    return adapted;
  }

  // Truncate text respecting word boundaries and locale-specific rules
  truncateForPlatform(text, maxLength, locale) {
    if (text.length <= maxLength) return text;

    const localeData = LOCALE_DATA[locale];
    
    // For languages without spaces (like Chinese, Japanese), truncate directly
    if (['zh', 'ja'].includes(locale)) {
      return text.substring(0, maxLength - 1) + '…';
    }

    // For other languages, respect word boundaries
    const truncated = text.substring(0, maxLength - 1);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '…';
    }
    
    return truncated + '…';
  }

  // Apply cultural adaptations
  applyCulturalAdaptations(text, platform, culturalContext) {
    let adapted = text;

    // Adjust hashtag style
    if (platform === 'twitter' || platform === 'instagram') {
      adapted = this.adaptHashtagStyle(adapted, culturalContext.hashtagStyle);
    }

    // Adjust tone based on cultural context
    adapted = this.adaptTone(adapted, culturalContext.contentTone);

    return adapted;
  }

  // Adapt hashtag style for different cultures
  adaptHashtagStyle(text, style) {
    // Extract hashtags
    const hashtags = text.match(/#\w+/g) || [];
    let adapted = text;

    for (const hashtag of hashtags) {
      let adaptedHashtag = hashtag;

      switch (style) {
        case 'lowercase':
          adaptedHashtag = hashtag.toLowerCase();
          break;
        case 'camelCase':
          // Keep as is - already handled in content generation
          break;
        case 'kanji':
        case 'chinese':
        case 'arabic':
        case 'devanagari':
          // These would require specific script handling
          break;
      }

      if (adaptedHashtag !== hashtag) {
        adapted = adapted.replace(hashtag, adaptedHashtag);
      }
    }

    return adapted;
  }

  // Adapt content tone
  adaptTone(text, tone) {
    // This is a simplified version - in production, this would use NLP
    switch (tone) {
      case 'formal':
        return text.replace(/!/g, '.');
      case 'casual':
        return text;
      case 'warm':
        return text.replace(/\./g, ' 🌟');
      case 'professional':
        return text.replace(/awesome|great|cool/gi, 'excellent');
      default:
        return text;
    }
  }

  // Detect user's locale from request
  detectLocale(req) {
    if (!I18N_CONFIG.detection.enabled) {
      return I18N_CONFIG.defaultLocale;
    }

    // Check each detection source in order
    for (const source of I18N_CONFIG.detection.sources) {
      let detectedLocale = null;

      switch (source) {
        case 'query':
          detectedLocale = req.query?.[I18N_CONFIG.detection.queryParam];
          break;
        case 'cookie':
          detectedLocale = req.cookies?.[I18N_CONFIG.detection.cookieName];
          break;
        case 'session':
          detectedLocale = req.session?.[I18N_CONFIG.detection.sessionKey];
          break;
        case 'header':
          detectedLocale = this.parseAcceptLanguageHeader(
            req.headers?.[I18N_CONFIG.detection.headerName.toLowerCase()]
          );
          break;
      }

      if (detectedLocale && this.isValidLocale(detectedLocale)) {
        return detectedLocale;
      }
    }

    return I18N_CONFIG.defaultLocale;
  }

  // Parse Accept-Language header
  parseAcceptLanguageHeader(headerValue) {
    if (!headerValue) return null;

    const languages = headerValue
      .split(',')
      .map(lang => {
        const [locale, quality] = lang.trim().split(';q=');
        return {
          locale: locale.split('-')[0], // Take only language part
          quality: quality ? parseFloat(quality) : 1.0
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Return the highest quality supported language
    for (const lang of languages) {
      if (this.isValidLocale(lang.locale)) {
        return lang.locale;
      }
    }

    return null;
  }

  // Check if locale is supported
  isValidLocale(locale) {
    return I18N_CONFIG.supportedLocales.includes(locale);
  }

  // Set current locale
  async setLocale(locale) {
    if (!this.isValidLocale(locale)) {
      logger.warn(`Invalid locale: ${locale}`, { category: 'i18n' });
      return false;
    }

    this.currentLocale = locale;
    await this.ensureTranslationsLoaded(locale);
    return true;
  }

  // Get locale data
  getLocaleData(locale = this.currentLocale) {
    return LOCALE_DATA[locale] || LOCALE_DATA[I18N_CONFIG.fallbackLocale];
  }

  // Format date according to locale
  formatDate(date, locale = this.currentLocale, options = {}) {
    const localeData = this.getLocaleData(locale);
    
    try {
      return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: options.timeZone || 'UTC'
      }).format(new Date(date));
    } catch (error) {
      logger.warn(`Date formatting failed for locale: ${locale}`, error, { category: 'i18n' });
      return new Date(date).toISOString().split('T')[0];
    }
  }

  // Format number according to locale
  formatNumber(number, locale = this.currentLocale, options = {}) {
    try {
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      logger.warn(`Number formatting failed for locale: ${locale}`, error, { category: 'i18n' });
      return number.toString();
    }
  }

  // Format currency according to locale
  formatCurrency(amount, locale = this.currentLocale, currency = null) {
    const localeData = this.getLocaleData(locale);
    const currencyCode = currency || localeData.currency || 'USD';

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode
      }).format(amount);
    } catch (error) {
      logger.warn(`Currency formatting failed for locale: ${locale}`, error, { category: 'i18n' });
      return `${currencyCode} ${amount}`;
    }
  }

  // Cache management
  async getCachedTranslations(locale) {
    const cacheKey = `${I18N_CONFIG.cache.keyPrefix}${locale}`;
    
    try {
      if (redisService.isConnected) {
        const cached = await redisService.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get cached translations', error, { category: 'i18n' });
      return null;
    }
  }

  async setCachedTranslations(locale, translations) {
    const cacheKey = `${I18N_CONFIG.cache.keyPrefix}${locale}`;
    
    try {
      if (redisService.isConnected) {
        await redisService.set(
          cacheKey, 
          JSON.stringify(translations), 
          I18N_CONFIG.cache.ttl
        );
      }
    } catch (error) {
      logger.warn('Failed to cache translations', error, { category: 'i18n' });
    }
  }

  // Pluralization support
  async pluralize(key, count, options = {}) {
    const locale = options.locale || this.currentLocale;
    
    // Get plural rule for locale
    const pluralRule = new Intl.PluralRules(locale);
    const rule = pluralRule.select(count);

    // Try to get specific plural form
    const pluralKey = `${key}.${rule}`;
    let translation = await this.t(pluralKey, { ...options, defaultValue: null });

    // Fallback to general form
    if (!translation) {
      translation = await this.t(key, options);
    }

    // Interpolate count
    return this.interpolate(translation, { ...options.interpolation, count });
  }

  // Get supported locales info
  getSupportedLocales() {
    return I18N_CONFIG.supportedLocales.map(locale => ({
      code: locale,
      ...LOCALE_DATA[locale]
    }));
  }

  // Health check
  healthCheck() {
    return {
      status: 'healthy',
      currentLocale: this.currentLocale,
      loadedLocales: Array.from(this.loadedLocales),
      supportedLocales: I18N_CONFIG.supportedLocales,
      cacheEnabled: I18N_CONFIG.cache.enabled
    };
  }

  // Statistics
  getStatistics() {
    const stats = {
      loadedLocales: this.loadedLocales.size,
      totalTranslations: 0,
      supportedLocales: I18N_CONFIG.supportedLocales.length,
      memoryUsage: process.memoryUsage().heapUsed
    };

    for (const [locale, translations] of this.translations.entries()) {
      let count = 0;
      for (const contentType in translations) {
        count += this.countTranslationKeys(translations[contentType]);
      }
      stats.totalTranslations += count;
    }

    return stats;
  }

  countTranslationKeys(obj) {
    let count = 0;
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        count += this.countTranslationKeys(obj[key]);
      } else {
        count++;
      }
    }
    return count;
  }
}

// Create singleton instance
export const i18n = new InternationalizationSystem();

// Express middleware for automatic locale detection
export const i18nMiddleware = (req, res, next) => {
  const detectedLocale = i18n.detectLocale(req);
  req.locale = detectedLocale;
  
  // Set locale for this request
  i18n.setLocale(detectedLocale);
  
  // Add translation function to request
  req.t = (key, options = {}) => i18n.t(key, { ...options, locale: detectedLocale });
  
  // Add locale data to response locals for templates
  res.locals.locale = detectedLocale;
  res.locals.localeData = i18n.getLocaleData(detectedLocale);
  res.locals.t = req.t;
  
  next();
};

// Export convenience methods
export const {
  t,
  setLocale,
  detectLocale,
  formatDate,
  formatNumber,
  formatCurrency,
  pluralize,
  getSupportedLocales,
  getLocaleData,
  healthCheck
} = i18n;

export default i18n;