/**
 * i18n Middleware
 * Language detection, content adaptation, and localization middleware
 */

import { i18n } from '../lib/i18n.js';
import { logger } from '../lib/logger.js';

// Middleware for Express.js applications
export const i18nMiddleware = async (req, res, next) => {
  try {
    // Detect user's preferred locale
    const detectedLocale = i18n.detectLocale(req);
    
    // Set locale for this request
    req.locale = detectedLocale;
    await i18n.setLocale(detectedLocale);
    
    // Add translation function to request
    req.t = async (key, options = {}) => {
      return await i18n.t(key, { 
        ...options, 
        locale: detectedLocale 
      });
    };
    
    // Add pluralization function
    req.pluralize = async (key, count, options = {}) => {
      return await i18n.pluralize(key, count, {
        ...options,
        locale: detectedLocale
      });
    };
    
    // Add formatting functions
    req.formatDate = (date, options = {}) => {
      return i18n.formatDate(date, detectedLocale, options);
    };
    
    req.formatNumber = (number, options = {}) => {
      return i18n.formatNumber(number, detectedLocale, options);
    };
    
    req.formatCurrency = (amount, currency = null) => {
      return i18n.formatCurrency(amount, detectedLocale, currency);
    };
    
    // Add locale data to request
    req.localeData = i18n.getLocaleData(detectedLocale);
    
    // Add locale information to response locals for templates
    res.locals = {
      ...res.locals,
      locale: detectedLocale,
      localeData: req.localeData,
      t: req.t,
      pluralize: req.pluralize,
      formatDate: req.formatDate,
      formatNumber: req.formatNumber,
      formatCurrency: req.formatCurrency,
      isRTL: req.localeData.direction === 'rtl',
      supportedLocales: i18n.getSupportedLocales()
    };
    
    // Set Content-Language header
    res.set('Content-Language', detectedLocale);
    
    // Log locale detection for analytics
    logger.debug('Locale detected', {
      category: 'i18n',
      locale: detectedLocale,
      userAgent: req.get('User-Agent'),
      acceptLanguage: req.get('Accept-Language')
    });
    
    next();
    
  } catch (error) {
    logger.error('i18n middleware error', error, { category: 'i18n' });
    
    // Fallback to default locale on error
    req.locale = 'en';
    req.localeData = i18n.getLocaleData('en');
    
    next();
  }
};

// Middleware for content optimization with locale awareness
export const contentLocalizationMiddleware = async (req, res, next) => {
  if (!req.body || !req.body.content) {
    return next();
  }
  
  try {
    const locale = req.locale || 'en';
    const platform = req.body.platform;
    const content = req.body.content;
    
    // Adapt content for platform and locale
    if (platform && content) {
      const adaptedContent = await i18n.adaptForPlatform(
        content, 
        platform, 
        locale
      );
      
      // Add adapted content to request
      req.body.adaptedContent = adaptedContent;
      
      // Add cultural context
      req.body.culturalContext = {
        locale,
        platform,
        direction: req.localeData.direction,
        contentTone: req.localeData.culturalContext?.contentTone,
        formalAddress: req.localeData.culturalContext?.formalAddress
      };
      
      logger.debug('Content adapted for locale', {
        category: 'i18n',
        locale,
        platform,
        originalLength: content.length,
        adaptedLength: adaptedContent.length
      });
    }
    
    next();
    
  } catch (error) {
    logger.error('Content localization middleware error', error, { 
      category: 'i18n' 
    });
    next();
  }
};

// API endpoint for changing locale
export const changeLocaleHandler = async (req, res) => {
  try {
    const { locale } = req.body;
    
    if (!locale || !i18n.isValidLocale(locale)) {
      return res.status(400).json({
        error: await i18n.t('errors.validation.invalidFormat'),
        supportedLocales: i18n.getSupportedLocales()
      });
    }
    
    // Set locale in session/cookie
    if (req.session) {
      req.session.locale = locale;
    }
    
    // Set cookie
    res.cookie('locale', locale, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Update current locale
    await i18n.setLocale(locale);
    
    res.json({
      success: true,
      locale,
      message: await i18n.t('notifications.success.settingsSaved'),
      localeData: i18n.getLocaleData(locale)
    });
    
  } catch (error) {
    logger.error('Change locale handler error', error, { category: 'i18n' });
    
    res.status(500).json({
      error: await i18n.t('errors.general.somethingWentWrong')
    });
  }
};

// API endpoint for getting translations
export const getTranslationsHandler = async (req, res) => {
  try {
    const { locale, contentType = 'ui' } = req.query;
    const targetLocale = locale || req.locale || 'en';
    
    if (!i18n.isValidLocale(targetLocale)) {
      return res.status(400).json({
        error: 'Invalid locale',
        supportedLocales: i18n.getSupportedLocales()
      });
    }
    
    // Load translations for locale
    const translations = await i18n.loadTranslations(targetLocale);
    
    res.json({
      locale: targetLocale,
      contentType,
      translations: translations[contentType] || {},
      localeData: i18n.getLocaleData(targetLocale)
    });
    
  } catch (error) {
    logger.error('Get translations handler error', error, { category: 'i18n' });
    
    res.status(500).json({
      error: 'Failed to load translations'
    });
  }
};

// API endpoint for getting supported locales
export const getSupportedLocalesHandler = async (req, res) => {
  try {
    const locales = i18n.getSupportedLocales();
    
    res.json({
      supportedLocales: locales,
      defaultLocale: 'en',
      currentLocale: req.locale
    });
    
  } catch (error) {
    logger.error('Get supported locales handler error', error, { category: 'i18n' });
    
    res.status(500).json({
      error: 'Failed to get supported locales'
    });
  }
};

// Content translation and adaptation utilities
export const contentAdaptationUtils = {
  // Adapt hashtags for different cultures
  adaptHashtags: (text, locale, platform) => {
    const localeData = i18n.getLocaleData(locale);
    const hashtagStyle = localeData.culturalContext?.hashtagStyle;
    
    if (!hashtagStyle || hashtagStyle === 'camelCase') {
      return text; // Default style
    }
    
    return text.replace(/#\w+/g, (hashtag) => {
      switch (hashtagStyle) {
        case 'lowercase':
          return hashtag.toLowerCase();
        case 'uppercase':
          return hashtag.toUpperCase();
        default:
          return hashtag;
      }
    });
  },
  
  // Adapt content length for platform and locale
  adaptLength: (text, platform, locale) => {
    const platformConfig = {
      instagram: 2200,
      facebook: 8000,
      twitter: 280,
      linkedin: 3000,
      tiktok: 150
    };
    
    const maxLength = platformConfig[platform];
    if (!maxLength || text.length <= maxLength) {
      return text;
    }
    
    // Truncate based on locale rules
    return i18n.truncateForPlatform(text, maxLength, locale);
  },
  
  // Add cultural context to content
  addCulturalContext: (content, locale, platform) => {
    const localeData = i18n.getLocaleData(locale);
    const culturalContext = localeData.culturalContext;
    
    if (!culturalContext) return content;
    
    let adapted = content;
    
    // Apply tone adjustments
    if (culturalContext.contentTone) {
      adapted = i18n.adaptTone(adapted, culturalContext.contentTone);
    }
    
    // Apply platform-specific cultural adaptations
    if (platform && culturalContext[platform]) {
      // Platform-specific cultural rules would be applied here
    }
    
    return adapted;
  },
  
  // Format numbers and currencies for locale
  formatMetrics: (metrics, locale) => {
    const formatted = {};
    
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        if (key.includes('currency') || key.includes('revenue')) {
          formatted[key] = i18n.formatCurrency(value, locale);
        } else {
          formatted[key] = i18n.formatNumber(value, locale);
        }
      } else {
        formatted[key] = value;
      }
    }
    
    return formatted;
  }
};

// Error handler with localized messages
export const localizedErrorHandler = async (error, req, res, next) => {
  const locale = req.locale || 'en';
  
  try {
    let message = error.message;
    let translationKey = null;
    
    // Map common errors to translation keys
    switch (error.code || error.name) {
      case 'ValidationError':
        translationKey = 'errors.validation.validationFailed';
        break;
      case 'UnauthorizedError':
        translationKey = 'errors.auth.unauthorized';
        break;
      case 'ForbiddenError':
        translationKey = 'errors.auth.forbidden';
        break;
      case 'NotFoundError':
        translationKey = 'errors.api.notFound';
        break;
      case 'RateLimitError':
        translationKey = 'errors.api.rateLimited';
        break;
      case 'NetworkError':
        translationKey = 'errors.api.networkError';
        break;
      default:
        translationKey = 'errors.general.somethingWentWrong';
        break;
    }
    
    // Get localized error message
    if (translationKey) {
      message = await i18n.t(translationKey, { locale });
    }
    
    // Format error response
    const errorResponse = {
      error: message,
      code: error.code,
      status: error.status || 500,
      locale
    };
    
    // Add additional error details in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.originalMessage = error.message;
    }
    
    res.status(error.status || 500).json(errorResponse);
    
  } catch (i18nError) {
    logger.error('Localized error handler failed', i18nError, { 
      category: 'i18n' 
    });
    
    // Fallback to original error
    res.status(error.status || 500).json({
      error: error.message,
      locale
    });
  }
};

export default {
  i18nMiddleware,
  contentLocalizationMiddleware,
  changeLocaleHandler,
  getTranslationsHandler,
  getSupportedLocalesHandler,
  contentAdaptationUtils,
  localizedErrorHandler
};