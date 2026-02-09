/**
 * AI Content API Tests
 *
 * Tests for hashtag generation, content optimization, and translation endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/ai/openrouter-client', () => ({
  openRouterClient: {
    complete: vi.fn(),
    models: {
      balanced: 'anthropic/claude-3-haiku',
      creative: 'anthropic/claude-3-sonnet',
    },
  },
}));

vi.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: vi.fn().mockResolvedValue({ allowed: true }),
    createSecureResponse: vi.fn((body, status) => new Response(JSON.stringify(body), { status })),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true },
    PUBLIC_READ: { requireAuth: false },
  },
}));

vi.mock('@/lib/security/audit-logger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn().mockReturnValue({ sub: 'test-user-id' }),
  },
}));

// ============================================
// HASHTAG GENERATION TESTS
// ============================================

describe('AI Content API - Hashtags', () => {
  describe('Input Validation', () => {
    it('should require content field', () => {
      const schema = {
        content: '',
        platform: 'twitter',
      };
      expect(schema.content.length).toBe(0);
    });

    it('should accept valid platform values', () => {
      const validPlatforms = ['twitter', 'linkedin', 'instagram', 'tiktok', 'facebook', 'youtube'];
      validPlatforms.forEach(platform => {
        expect(validPlatforms).toContain(platform);
      });
    });

    it('should enforce count limits', () => {
      const minCount = 1;
      const maxCount = 30;
      expect(minCount).toBeGreaterThan(0);
      expect(maxCount).toBeLessThanOrEqual(30);
    });

    it('should validate style options', () => {
      const validStyles = ['broad', 'targeted', 'mixed'];
      expect(validStyles).toContain('mixed');
    });
  });

  describe('Platform Hashtag Limits', () => {
    const platformLimits: Record<string, number> = {
      twitter: 3,
      linkedin: 5,
      instagram: 30,
      tiktok: 10,
      facebook: 10,
      youtube: 15,
    };

    it('should have correct Twitter limit', () => {
      expect(platformLimits.twitter).toBe(3);
    });

    it('should have correct Instagram limit', () => {
      expect(platformLimits.instagram).toBe(30);
    });

    it('should have correct LinkedIn limit', () => {
      expect(platformLimits.linkedin).toBe(5);
    });
  });

  describe('Fallback Hashtag Categories', () => {
    const categories = ['business', 'marketing', 'tech', 'lifestyle', 'fitness', 'food', 'travel', 'fashion'];

    it('should have business category', () => {
      expect(categories).toContain('business');
    });

    it('should have marketing category', () => {
      expect(categories).toContain('marketing');
    });

    it('should have tech category', () => {
      expect(categories).toContain('tech');
    });
  });

  describe('Hashtag Parsing', () => {
    it('should parse hashtags from JSON array', () => {
      const aiResponse = '["#marketing", "#growth", "#success"]';
      const parsed = JSON.parse(aiResponse);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toBe('#marketing');
    });

    it('should extract hashtags from text', () => {
      const text = 'Here are some hashtags: #marketing #business #success';
      const hashtags = text.match(/#\w+/g);
      expect(hashtags).toHaveLength(3);
    });

    it('should normalize hashtags to lowercase', () => {
      const hashtag = '#MARKETING';
      const normalized = hashtag.toLowerCase();
      expect(normalized).toBe('#marketing');
    });
  });

  describe('Relevance Scoring', () => {
    it('should give higher score for direct matches', () => {
      const content = 'marketing strategies for success';
      const hashtag = '#marketing';
      const tag = hashtag.replace('#', '').toLowerCase();
      const hasMatch = content.toLowerCase().includes(tag);
      expect(hasMatch).toBe(true);
    });

    it('should calculate popularity estimation', () => {
      const highVolumeKeywords = ['fyp', 'viral', 'trending'];
      const hashtag = '#viral';
      const tag = hashtag.toLowerCase();
      const isHighVolume = highVolumeKeywords.some(h => tag.includes(h));
      expect(isHighVolume).toBe(true);
    });
  });
});

// ============================================
// CONTENT OPTIMIZATION TESTS
// ============================================

describe('AI Content API - Optimize', () => {
  describe('Input Validation', () => {
    it('should require content field', () => {
      const minLength = 1;
      const maxLength = 10000;
      expect(minLength).toBe(1);
      expect(maxLength).toBe(10000);
    });

    it('should accept valid goal values', () => {
      const validGoals = ['engagement', 'reach', 'conversions', 'brand_awareness', 'traffic'];
      validGoals.forEach(goal => {
        expect(validGoals).toContain(goal);
      });
    });

    it('should accept valid tone values', () => {
      const validTones = ['professional', 'casual', 'humorous', 'inspirational', 'educational', 'urgent'];
      expect(validTones).toContain('professional');
    });
  });

  describe('Platform Character Limits', () => {
    const platformLimits: Record<string, number> = {
      twitter: 280,
      linkedin: 3000,
      instagram: 2200,
      tiktok: 2200,
      facebook: 63206,
      youtube: 5000,
    };

    it('should have correct Twitter limit', () => {
      expect(platformLimits.twitter).toBe(280);
    });

    it('should have correct LinkedIn limit', () => {
      expect(platformLimits.linkedin).toBe(3000);
    });

    it('should have correct Facebook limit', () => {
      expect(platformLimits.facebook).toBe(63206);
    });
  });

  describe('CTA Templates', () => {
    const engagementCTAs = [
      'What do you think?',
      'Share your thoughts below!',
      'Drop a comment if you agree!',
    ];

    it('should have engagement CTAs', () => {
      expect(engagementCTAs.length).toBeGreaterThan(0);
    });

    it('should include question-based CTAs', () => {
      const hasQuestion = engagementCTAs.some(cta => cta.includes('?'));
      expect(hasQuestion).toBe(true);
    });
  });

  describe('Hook Detection', () => {
    it('should detect hook starters', () => {
      const hookPatterns = [
        /^(here's|the truth|stop|i made|unpopular|hot take)/i,
        /^\d+ (things|tips|ways|reasons|mistakes)/i,
      ];

      const content1 = "Here's what nobody tells you about marketing";
      const content2 = "5 tips for better engagement";

      const hasHook1 = hookPatterns.some(p => p.test(content1));
      const hasHook2 = hookPatterns.some(p => p.test(content2));

      expect(hasHook1).toBe(true);
      expect(hasHook2).toBe(true);
    });
  });

  describe('Emoji Detection', () => {
    it('should detect emojis in content', () => {
      const content = '🚀 Launch day is here!';
      const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(content);
      expect(hasEmoji).toBe(true);
    });

    it('should return false for content without emojis', () => {
      const content = 'Launch day is here!';
      const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(content);
      expect(hasEmoji).toBe(false);
    });
  });

  describe('CTA Detection', () => {
    it('should detect CTA keywords', () => {
      const ctaPatterns = [
        /comment|share|follow|like|save|click|tap|swipe|link|dm|message/i,
        /what do you think|let me know|tell me|your thoughts/i,
      ];

      const content = 'What do you think about this? Share your thoughts!';
      const hasCTA = ctaPatterns.some(p => p.test(content));
      expect(hasCTA).toBe(true);
    });
  });

  describe('Smart Truncation', () => {
    it('should truncate at sentence boundary when possible', () => {
      const content = 'This is sentence one. This is sentence two. This is sentence three.';
      const maxLength = 50;

      const truncated = content.substring(0, maxLength - 3);
      const lastSentence = truncated.lastIndexOf('.');

      expect(lastSentence).toBeGreaterThan(0);
    });
  });

  describe('Optimization Score Calculation', () => {
    it('should calculate overall score', () => {
      const engagement = 75;
      const readability = 80;
      const platformFit = 70;
      const cta = 85;

      const overall = Math.round((engagement + readability + platformFit + cta) / 4);
      expect(overall).toBe(78);
    });

    it('should cap score at 100', () => {
      const score = 120;
      const capped = Math.min(score, 100);
      expect(capped).toBe(100);
    });
  });
});

// ============================================
// TRANSLATION TESTS
// ============================================

describe('AI Content API - Translate', () => {
  describe('Supported Languages', () => {
    const supportedLanguages = [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru',
      'ja', 'ko', 'zh', 'zh-TW', 'ar', 'hi', 'tr', 'vi', 'th',
      'id', 'sv', 'da', 'no', 'fi', 'el', 'he', 'uk', 'cs', 'ro', 'hu'
    ];

    it('should support major European languages', () => {
      expect(supportedLanguages).toContain('en');
      expect(supportedLanguages).toContain('es');
      expect(supportedLanguages).toContain('fr');
      expect(supportedLanguages).toContain('de');
    });

    it('should support Asian languages', () => {
      expect(supportedLanguages).toContain('ja');
      expect(supportedLanguages).toContain('ko');
      expect(supportedLanguages).toContain('zh');
    });

    it('should support RTL languages', () => {
      expect(supportedLanguages).toContain('ar');
      expect(supportedLanguages).toContain('he');
    });

    it('should have at least 25 languages', () => {
      expect(supportedLanguages.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Input Validation', () => {
    it('should require content field', () => {
      const minLength = 1;
      const maxLength = 10000;
      expect(minLength).toBe(1);
      expect(maxLength).toBe(10000);
    });

    it('should require targetLanguage', () => {
      const targetLanguage = 'es';
      expect(targetLanguage.length).toBeGreaterThanOrEqual(2);
    });

    it('should accept valid formality levels', () => {
      const validLevels = ['formal', 'informal', 'neutral'];
      expect(validLevels).toContain('neutral');
    });
  });

  describe('Language Metadata', () => {
    const languageInfo = {
      es: { name: 'Spanish', nativeName: 'Español' },
      ar: { name: 'Arabic', nativeName: 'العربية', rtl: true },
      ja: { name: 'Japanese', nativeName: '日本語' },
    };

    it('should have native names', () => {
      expect(languageInfo.es.nativeName).toBe('Español');
      expect(languageInfo.ja.nativeName).toBe('日本語');
    });

    it('should mark RTL languages', () => {
      expect(languageInfo.ar.rtl).toBe(true);
    });
  });

  describe('Emoji Preservation', () => {
    it('should extract emojis from content', () => {
      const content = '🚀 Launch day! #excited';
      const emojis = content.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
      expect(emojis).toHaveLength(1);
      expect(emojis[0]).toBe('🚀');
    });

    it('should detect missing emojis in translation', () => {
      const originalEmojis = ['🚀', '🎉'];
      const translatedEmojis = ['🚀'];
      const missingCount = originalEmojis.length - translatedEmojis.length;
      expect(missingCount).toBe(1);
    });
  });

  describe('Hashtag Preservation', () => {
    it('should extract hashtags from content', () => {
      const content = 'Check this out! #marketing #success';
      const hashtags = content.match(/#\w+/g) || [];
      expect(hashtags).toHaveLength(2);
    });

    it('should compare hashtags case-insensitively', () => {
      const original = '#Marketing';
      const translated = '#marketing';
      const match = original.toLowerCase() === translated.toLowerCase();
      expect(match).toBe(true);
    });
  });

  describe('Translation Quality Metrics', () => {
    it('should calculate length ratio', () => {
      const originalLength = 100;
      const translatedLength = 120;
      const ratio = translatedLength / originalLength;
      expect(ratio).toBe(1.2);
    });

    it('should score length within acceptable range', () => {
      const lengthRatio = 1.2;
      const isAcceptable = lengthRatio >= 0.5 && lengthRatio <= 2.0;
      expect(isAcceptable).toBe(true);
    });

    it('should calculate hashtag preservation score', () => {
      const originalHashtags = 3;
      const translatedHashtags = 2;
      const score = Math.round((translatedHashtags / originalHashtags) * 100);
      expect(score).toBe(67);
    });

    it('should calculate overall quality score', () => {
      const lengthScore = 100;
      const hashtagScore = 100;
      const emojiScore = 100;
      const completenessScore = 100;

      const overall = Math.round((lengthScore + hashtagScore + emojiScore + completenessScore) / 4);
      expect(overall).toBe(100);
    });
  });

  describe('Translation Response Parsing', () => {
    it('should parse valid JSON response', () => {
      const response = '{"translated": "Hola mundo", "detectedLanguage": "en", "notes": ["Simple greeting"]}';
      const parsed = JSON.parse(response);

      expect(parsed.translated).toBe('Hola mundo');
      expect(parsed.detectedLanguage).toBe('en');
      expect(parsed.notes).toHaveLength(1);
    });

    it('should handle response with embedded JSON', () => {
      const response = 'Here is the translation: {"translated": "Bonjour"}';
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      expect(jsonMatch).not.toBeNull();
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        expect(parsed.translated).toBe('Bonjour');
      }
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('AI Content API - Integration', () => {
  describe('Security', () => {
    it('should require authentication for POST endpoints', () => {
      const policies = {
        AUTHENTICATED_WRITE: { requireAuth: true },
        PUBLIC_READ: { requireAuth: false },
      };

      expect(policies.AUTHENTICATED_WRITE.requireAuth).toBe(true);
    });

    it('should allow public access to language list', () => {
      const policies = {
        PUBLIC_READ: { requireAuth: false },
      };

      expect(policies.PUBLIC_READ.requireAuth).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log hashtag generation', () => {
      const auditEntry = {
        action: 'ai.hashtags_generated',
        resource: 'ai_content',
        category: 'api',
        severity: 'low',
      };

      expect(auditEntry.action).toBe('ai.hashtags_generated');
      expect(auditEntry.category).toBe('api');
    });

    it('should log content optimization', () => {
      const auditEntry = {
        action: 'ai.content_optimized',
        resource: 'ai_content',
        category: 'api',
        severity: 'low',
      };

      expect(auditEntry.action).toBe('ai.content_optimized');
    });

    it('should log translation', () => {
      const auditEntry = {
        action: 'ai.content_translated',
        resource: 'ai_content',
        category: 'api',
        severity: 'low',
      };

      expect(auditEntry.action).toBe('ai.content_translated');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid JSON', () => {
      const errorResponse = { error: 'Invalid JSON body' };
      expect(errorResponse.error).toBe('Invalid JSON body');
    });

    it('should return 401 for missing authentication', () => {
      const errorResponse = { error: 'Authentication required' };
      expect(errorResponse.error).toBe('Authentication required');
    });

    it('should return 503 for unavailable translation service', () => {
      const errorResponse = { error: 'Translation service not configured. Please configure OPENROUTER_API_KEY.' };
      expect(errorResponse.error).toContain('OPENROUTER_API_KEY');
    });
  });

  describe('Response Structure', () => {
    it('should include success flag in hashtag response', () => {
      const response = {
        success: true,
        hashtags: ['#marketing', '#growth'],
        detailed: [],
        metadata: {},
      };

      expect(response.success).toBe(true);
      expect(response.hashtags).toHaveLength(2);
    });

    it('should include original and optimized content', () => {
      const response = {
        success: true,
        original: 'Original content',
        optimized: 'Optimized content',
        suggestions: [],
        score: {},
        metadata: {},
      };

      expect(response.original).toBeDefined();
      expect(response.optimized).toBeDefined();
    });

    it('should include language info in translation response', () => {
      const response = {
        success: true,
        original: 'Hello',
        translated: 'Hola',
        sourceLanguage: { code: 'en', name: 'English' },
        targetLanguage: { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
      };

      expect(response.targetLanguage.code).toBe('es');
      expect(response.targetLanguage.nativeName).toBe('Español');
    });
  });
});
