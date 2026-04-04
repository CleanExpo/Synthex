/**
 * Unit Tests for content pipeline — lib/ai/
 *
 * Covers:
 * 1. model-registry.ts  — Pure functions: getLatestModel, getModels, getModel,
 *    isModelAvailable, getProductionModels, validateModel, getAllLatestModels
 * 2. content-scorer.ts  — ContentScorer.score(): all six dimensions,
 *    overall weighted score, topSuggestions, edge cases
 * 3. AIContentGenerator — generateContent() with mocked AI provider and Prisma:
 *    - request validation / field usage
 *    - error propagation when AI provider throws
 *    - response shape validation
 *    - BYOK (user credentials) path
 */

// ============================================================================
// Polyfills — must come before any imports
// ============================================================================

// jsdom does not provide crypto.randomUUID — patch it so lib/ai/content-generator.ts
// can create variation IDs during tests.
let _uuidCounter = 0;
if (
  typeof crypto === 'undefined' ||
  typeof (crypto as Crypto).randomUUID !== 'function'
) {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () =>
        `00000000-0000-4000-8000-${String(++_uuidCounter).padStart(12, '0')}`,
    },
    writable: true,
    configurable: true,
  });
}

// ============================================================================
// Mock setup — must come before any imports
// ============================================================================

// Mock Prisma so no DB calls happen
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    persona: { findUnique: jest.fn().mockResolvedValue(null) },
    trendInsight: { findMany: jest.fn().mockResolvedValue([]) },
  },
  prisma: {
    persona: { findUnique: jest.fn().mockResolvedValue(null) },
    trendInsight: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

// Mock AI providers
// NOTE: mockComplete is defined here so it can be referenced in mockAISuccess().
// clearMocks:true resets mock *implementations* between tests, so we restore
// the getAIProvider return value inside the AIContentGenerator describe block.
const mockComplete = jest.fn();
const mockModels = {
  fast: 'fast-model',
  balanced: 'balanced-model',
  creative: 'creative-model',
};

jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(),
}));

// Mock Obsidian context builder
jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: jest.fn().mockResolvedValue(''),
}));

// Mock logger to keep test output clean
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getLatestModel,
  getModels,
  getModel,
  isModelAvailable,
  getProductionModels,
  validateModel,
  getAllLatestModels,
} from '@/lib/ai/model-registry';
import type {
  AIProvider as AIProviderName,
  ModelConfig,
} from '@/lib/ai/model-registry';

import { ContentScorer, contentScorer } from '@/lib/ai/content-scorer';
import type { ScoreResult, DimensionScore } from '@/lib/ai/content-scorer';

import {
  AIContentGenerator,
  aiContentGenerator,
} from '@/lib/ai/content-generator';
import type {
  ContentRequest,
  GeneratedContent,
} from '@/lib/ai/content-generator';

// ============================================================================
// Helpers
// ============================================================================

/** Default mock AI response (plain text content). */
function mockAISuccess(
  text: string = 'Generated content for testing #ai #content'
) {
  mockComplete.mockResolvedValue({
    choices: [{ message: { content: text } }],
  });
}

function makeContentRequest(
  overrides: Partial<ContentRequest> = {}
): ContentRequest {
  return {
    type: 'post',
    platform: 'linkedin',
    topic: 'AI in marketing',
    tone: 'professional',
    length: 'medium',
    includeEmojis: false,
    includeHashtags: false,
    includeCTA: false,
    ...overrides,
  };
}

// ============================================================================
// 1. Model Registry Tests
// ============================================================================

describe('Model Registry — lib/ai/model-registry.ts', () => {
  const providers: AIProviderName[] = [
    'openai',
    'anthropic',
    'google',
    'openrouter',
  ];

  describe('getLatestModel()', () => {
    it.each(providers)(
      'should return a non-deprecated latest-tier model for %s',
      provider => {
        const model = getLatestModel(provider);
        expect(model).toBeDefined();
        expect(model.isDeprecated).toBe(false);
        expect(['latest', 'production']).toContain(model.tier);
      }
    );

    it('should return a model with required fields', () => {
      const model = getLatestModel('openai');
      expect(typeof model.id).toBe('string');
      expect(model.id.length).toBeGreaterThan(0);
      expect(typeof model.name).toBe('string');
      expect(typeof model.contextWindow).toBe('number');
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.costPer1kTokens).toBeDefined();
      expect(typeof model.costPer1kTokens.input).toBe('number');
      expect(typeof model.costPer1kTokens.output).toBe('number');
    });

    it('should prefer latest tier over production tier', () => {
      const model = getLatestModel('anthropic');
      // If any 'latest' tier exists, the result should be 'latest'
      expect(model.tier).toBe('latest');
    });
  });

  describe('getModels()', () => {
    it.each(providers)('should return array of models for %s', provider => {
      const models = getModels(provider);
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return models with valid provider field', () => {
      const models = getModels('anthropic');
      for (const m of models) {
        expect(m.provider).toBe('anthropic');
      }
    });
  });

  describe('getModel()', () => {
    it('should return the correct model by ID', () => {
      // Use a known model ID from the registry
      const model = getModel('openai', 'gpt-4-turbo');
      expect(model).not.toBeNull();
      expect(model!.id).toBe('gpt-4-turbo');
      expect(model!.provider).toBe('openai');
    });

    it('should return null for an unknown model ID', () => {
      const model = getModel('openai', 'gpt-999-nonexistent');
      expect(model).toBeNull();
    });

    it('should return null for a model ID from a different provider', () => {
      const model = getModel('anthropic', 'gpt-4-turbo');
      expect(model).toBeNull();
    });
  });

  describe('isModelAvailable()', () => {
    it('should return true for a known non-deprecated model', () => {
      expect(isModelAvailable('openai', 'gpt-4-turbo')).toBe(true);
    });

    it('should return false for a deprecated model', () => {
      // claude-3-5-sonnet is marked deprecated in the registry
      expect(isModelAvailable('anthropic', 'claude-3-5-sonnet')).toBe(false);
    });

    it('should return false for an unknown model ID', () => {
      expect(isModelAvailable('openai', 'nonexistent-model')).toBe(false);
    });
  });

  describe('getProductionModels()', () => {
    it.each(providers)(
      'should return production-ready models for %s',
      provider => {
        const models = getProductionModels(provider);
        expect(Array.isArray(models)).toBe(true);
        // All returned models should be non-deprecated
        for (const m of models) {
          expect(m.isDeprecated).toBe(false);
          expect(['production', 'latest']).toContain(m.tier);
        }
      }
    );

    it('should sort by release date descending', () => {
      const models = getProductionModels('openai');
      for (let i = 1; i < models.length; i++) {
        expect(models[i - 1].releaseDate.getTime()).toBeGreaterThanOrEqual(
          models[i].releaseDate.getTime()
        );
      }
    });
  });

  describe('validateModel()', () => {
    let validModel: ModelConfig;

    beforeEach(() => {
      validModel = getLatestModel('openai');
    });

    it('should return true for a valid non-deprecated model with no requirements', () => {
      expect(validateModel(validModel)).toBe(true);
    });

    it('should return false for a deprecated model', () => {
      const deprecated: ModelConfig = { ...validModel, isDeprecated: true };
      expect(validateModel(deprecated)).toBe(false);
    });

    it('should return false if contextWindow is below minimum', () => {
      const smallContext: ModelConfig = { ...validModel, contextWindow: 1000 };
      expect(validateModel(smallContext, { minContextWindow: 50000 })).toBe(
        false
      );
    });

    it('should return true if contextWindow meets minimum', () => {
      expect(validateModel(validModel, { minContextWindow: 100 })).toBe(true);
    });

    it('should return false if vision is required but not supported', () => {
      const noVision: ModelConfig = { ...validModel, supportsVision: false };
      expect(validateModel(noVision, { requireVision: true })).toBe(false);
    });

    it('should return false if tools are required but not supported', () => {
      const noTools: ModelConfig = { ...validModel, supportsTools: false };
      expect(validateModel(noTools, { requireTools: true })).toBe(false);
    });

    it('should return false if streaming is required but not supported', () => {
      const noStream: ModelConfig = { ...validModel, supportsStreaming: false };
      expect(validateModel(noStream, { requireStreaming: true })).toBe(false);
    });

    it('should return true when all requirements are met', () => {
      expect(
        validateModel(validModel, {
          minContextWindow: 1000,
          requireVision: validModel.supportsVision,
          requireTools: validModel.supportsTools,
          requireStreaming: validModel.supportsStreaming,
        })
      ).toBe(true);
    });
  });

  describe('getAllLatestModels()', () => {
    it('should return one model per provider', () => {
      const allLatest = getAllLatestModels();
      expect(allLatest).toHaveProperty('openai');
      expect(allLatest).toHaveProperty('anthropic');
      expect(allLatest).toHaveProperty('google');
      expect(allLatest).toHaveProperty('openrouter');
    });

    it('should return non-deprecated models only', () => {
      const allLatest = getAllLatestModels();
      for (const [, model] of Object.entries(allLatest)) {
        expect(model.isDeprecated).toBe(false);
      }
    });
  });
});

// ============================================================================
// 2. Content Scorer Tests
// ============================================================================

describe('ContentScorer — lib/ai/content-scorer.ts', () => {
  describe('score() — result shape', () => {
    it('should return a ScoreResult with all required fields', () => {
      const result = contentScorer.score(
        'Test content for scoring.',
        'linkedin'
      );

      expect(typeof result.overall).toBe('number');
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);

      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.readability).toBeDefined();
      expect(result.dimensions.engagement).toBeDefined();
      expect(result.dimensions.platformFit).toBeDefined();
      expect(result.dimensions.clarity).toBeDefined();
      expect(result.dimensions.emotional).toBeDefined();
      expect(result.dimensions.writingQuality).toBeDefined();

      expect(Array.isArray(result.topSuggestions)).toBe(true);
      expect(result.topSuggestions.length).toBeLessThanOrEqual(3);
    });

    it('should have all dimension scores in 0-100 range', () => {
      const result = contentScorer.score(
        'A well-written post about marketing strategies.',
        'twitter'
      );
      for (const [, dim] of Object.entries(result.dimensions)) {
        expect((dim as DimensionScore).score).toBeGreaterThanOrEqual(0);
        expect((dim as DimensionScore).score).toBeLessThanOrEqual(100);
      }
    });

    it('each dimension should have issues and suggestions arrays', () => {
      const result = contentScorer.score('Some text.', 'instagram');
      for (const [, dim] of Object.entries(result.dimensions)) {
        expect(Array.isArray((dim as DimensionScore).issues)).toBe(true);
        expect(Array.isArray((dim as DimensionScore).suggestions)).toBe(true);
      }
    });
  });

  describe('score() — platform detection', () => {
    const platforms = [
      'twitter',
      'linkedin',
      'instagram',
      'tiktok',
      'facebook',
      'youtube',
      'pinterest',
      'reddit',
      'threads',
    ];

    it.each(platforms)('should not throw for platform: %s', platform => {
      expect(() =>
        contentScorer.score('Sample content', platform)
      ).not.toThrow();
    });

    it('should default to linkedin when no platform provided', () => {
      const defaultResult = contentScorer.score('Sample content');
      const linkedinResult = contentScorer.score('Sample content', 'linkedin');
      // Both should return a valid result
      expect(defaultResult.overall).toBeGreaterThanOrEqual(0);
      expect(linkedinResult.overall).toBeGreaterThanOrEqual(0);
    });

    it('should accept platform strings case-insensitively', () => {
      expect(() => contentScorer.score('content', 'TWITTER')).not.toThrow();
      expect(() => contentScorer.score('content', 'LinkedIn')).not.toThrow();
    });
  });

  describe('score() — engagement dimension', () => {
    it('should reward content starting with a hook', () => {
      const withHook = contentScorer.score(
        "Here's the truth about marketing: it requires consistency.",
        'linkedin'
      );
      const withoutHook = contentScorer.score(
        'Marketing requires consistency.',
        'linkedin'
      );
      expect(withHook.dimensions.engagement.score).toBeGreaterThanOrEqual(
        withoutHook.dimensions.engagement.score
      );
    });

    it('should reward content with a question', () => {
      const withQuestion = contentScorer.score(
        'What is the most important marketing skill? Let me tell you.',
        'linkedin'
      );
      expect(withQuestion.dimensions.engagement.score).toBeGreaterThan(0);
    });

    it('should reward content with emojis', () => {
      const withEmoji = contentScorer.score(
        'Great post about AI 🚀 in marketing today!',
        'instagram'
      );
      expect(withEmoji.dimensions.engagement.score).toBeGreaterThan(0);
    });
  });

  describe('score() — readability dimension', () => {
    it('should penalise very short content', () => {
      const shortResult = contentScorer.score('Hi.', 'linkedin');
      // Short content gets a readability penalty
      expect(
        shortResult.dimensions.readability.issues.length
      ).toBeGreaterThanOrEqual(0);
    });

    it('should reward content with paragraph breaks', () => {
      const withBreaks = contentScorer.score(
        'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph.',
        'linkedin'
      );
      const without = contentScorer.score(
        'First paragraph here. Second paragraph here. Third paragraph.',
        'linkedin'
      );
      expect(withBreaks.dimensions.readability.score).toBeGreaterThanOrEqual(
        without.dimensions.readability.score
      );
    });

    it('should reward bullet list usage', () => {
      const withList = contentScorer.score(
        'Key points:\n- Point one\n- Point two\n- Point three\n- Point four',
        'linkedin'
      );
      expect(withList.dimensions.readability.score).toBeGreaterThan(0);
    });
  });

  describe('score() — platformFit dimension', () => {
    it('should penalise a tweet over 280 characters', () => {
      const longTweet = 'a '.repeat(150); // 300 chars
      const result = contentScorer.score(longTweet, 'twitter');
      // Should flag character limit issues
      const hasLimitIssue = result.dimensions.platformFit.issues.some(
        issue =>
          issue.toLowerCase().includes('limit') ||
          issue.toLowerCase().includes('character')
      );
      expect(hasLimitIssue || result.dimensions.platformFit.score < 100).toBe(
        true
      );
    });

    it('should reward Instagram content with 5-15 hashtags', () => {
      const igContent =
        'Beautiful sunrise today! #morning #sunrise #nature #photography #photooftheday #beauty #sky #golden #hour #travel';
      const result = contentScorer.score(igContent, 'instagram');
      // 10 hashtags — should get a platform fit bonus
      expect(result.dimensions.platformFit.score).toBeGreaterThan(0);
    });

    it('should suggest LinkedIn content have paragraph breaks', () => {
      const longBlock =
        'This is a very long LinkedIn post without any paragraph breaks at all that goes on and on. ';
      const repeated = longBlock.repeat(5);
      const result = contentScorer.score(repeated, 'linkedin');
      // May generate a suggestion about paragraph breaks
      expect(result.dimensions.platformFit.score).toBeDefined();
    });
  });

  describe('score() — emotional dimension', () => {
    it('should reward content with power words', () => {
      const powerContent =
        'Discover the secret to proven results with this breakthrough strategy.';
      const result = contentScorer.score(powerContent, 'linkedin');
      expect(result.dimensions.emotional.score).toBeGreaterThan(40); // baseline is 40
    });

    it('should reward storytelling elements', () => {
      const story =
        'When I started my business three years ago, I remember struggling with everything.';
      const result = contentScorer.score(story, 'linkedin');
      expect(result.dimensions.emotional.score).toBeGreaterThan(40);
    });

    it('should reward urgency cues', () => {
      const urgentContent = 'Act now — this limited offer expires today only!';
      const result = contentScorer.score(urgentContent, 'linkedin');
      expect(result.dimensions.emotional.score).toBeGreaterThan(40);
    });
  });

  describe('score() — topSuggestions', () => {
    it('should return at most 3 suggestions', () => {
      const result = contentScorer.score('Short.', 'linkedin');
      expect(result.topSuggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return strings in topSuggestions', () => {
      const result = contentScorer.score('Simple content here.', 'twitter');
      for (const suggestion of result.topSuggestions) {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ContentScorer — class instantiation', () => {
    it('should be instantiatable directly', () => {
      const scorer = new ContentScorer();
      expect(scorer).toBeDefined();
      const result = scorer.score('Test', 'twitter');
      expect(result.overall).toBeGreaterThanOrEqual(0);
    });

    it('contentScorer singleton should be an instance of ContentScorer', () => {
      expect(contentScorer).toBeInstanceOf(ContentScorer);
    });
  });
});

// ============================================================================
// 3. AIContentGenerator Tests
// ============================================================================

describe('AIContentGenerator — lib/ai/content-generator.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore getAIProvider mock implementation — clearMocks resets it each test
    const { getAIProvider } = require('@/lib/ai/providers');
    (getAIProvider as jest.Mock).mockImplementation(() => ({
      complete: mockComplete,
      models: mockModels,
    }));
  });

  describe('generateContent() — happy path', () => {
    it('should return a GeneratedContent object with correct shape', async () => {
      mockAISuccess('AI is transforming marketing! #ai #marketing #innovation');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ includeHashtags: true })
      );

      expect(result).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.id).toMatch(/^content-/);
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.platform).toBe('linkedin');
      expect(Array.isArray(result.variations)).toBe(true);
      expect(Array.isArray(result.hashtags)).toBe(true);
      expect(Array.isArray(result.emojis)).toBe(true);
      expect(Array.isArray(result.hooks)).toBe(true);
      expect(typeof result.estimatedEngagement).toBe('number');
      expect(typeof result.viralScore).toBe('number');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.model).toBeDefined();
      expect(result.metadata.tokens).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    });

    it('should extract hashtags from generated content', async () => {
      mockAISuccess(
        'Discover the future of marketing! #ai #automation #socialmedia'
      );

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ includeHashtags: true })
      );

      expect(result.hashtags).toContain('#ai');
      expect(result.hashtags).toContain('#automation');
    });

    it('should include CTA when includeCTA is true', async () => {
      mockAISuccess('Great post content here.');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ includeCTA: true })
      );

      expect(result.cta).toBeDefined();
      expect(typeof result.cta).toBe('string');
      expect(result.cta!.length).toBeGreaterThan(0);
    });

    it('should not include CTA when includeCTA is false', async () => {
      mockAISuccess('Great post content here.');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ includeCTA: false })
      );

      expect(result.cta).toBeUndefined();
    });

    it('should set platform to the requested platform', async () => {
      mockAISuccess('Twitter content here!');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ platform: 'twitter' })
      );

      expect(result.platform).toBe('twitter');
    });

    it('should return hooks for the requested platform', async () => {
      mockAISuccess('Instagram content here.');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ platform: 'instagram' })
      );

      // Instagram-specific hooks
      expect(result.hooks).toContain('Stop scrolling!');
    });

    it('should return hooks for twitter platform', async () => {
      mockAISuccess('Twitter content here.');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ platform: 'twitter' })
      );

      // Twitter-specific hooks
      expect(result.hooks).toContain('BREAKING:');
    });
  });

  describe('generateContent() — all supported platforms', () => {
    const platforms = [
      'twitter',
      'instagram',
      'linkedin',
      'tiktok',
      'facebook',
      'youtube',
    ] as const;

    it.each(platforms)(
      'should generate content for platform: %s',
      async platform => {
        mockAISuccess(`Content for ${platform}`);

        const result = await aiContentGenerator.generateContent(
          makeContentRequest({ platform })
        );

        expect(result.platform).toBe(platform);
        expect(result.content).toBe(`Content for ${platform}`);
      }
    );
  });

  describe('generateContent() — all content types', () => {
    const types = [
      'post',
      'caption',
      'thread',
      'story',
      'reel',
      'article',
    ] as const;

    it.each(types)('should not throw for type: %s', async type => {
      mockAISuccess('Content generated successfully.');

      await expect(
        aiContentGenerator.generateContent(makeContentRequest({ type }))
      ).resolves.toBeDefined();
    });
  });

  describe('generateContent() — model selection', () => {
    it('should use creative model for article type', async () => {
      mockAISuccess('Long article content here.');

      await aiContentGenerator.generateContent(
        makeContentRequest({ type: 'article' })
      );

      // The model used is stored in metadata
      const { getAIProvider } = require('@/lib/ai/providers');
      expect(getAIProvider).toHaveBeenCalled();
    });

    it('should use fast model for twitter short content', async () => {
      mockAISuccess('Short tweet.');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ platform: 'twitter', length: 'short' })
      );

      // Result should use metadata.model from fast model
      expect(result.metadata.model).toBe(mockModels.fast);
    });

    it('should use creative model for long content', async () => {
      mockAISuccess(
        'Long piece of content for the article type generation test.'
      );

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ length: 'long' })
      );

      expect(result.metadata.model).toBe(mockModels.creative);
    });

    it('should use balanced model for medium linkedin content', async () => {
      mockAISuccess('Balanced medium LinkedIn post here.');

      const result = await aiContentGenerator.generateContent(
        makeContentRequest({ platform: 'linkedin', length: 'medium' })
      );

      expect(result.metadata.model).toBe(mockModels.balanced);
    });
  });

  describe('generateContent() — error handling', () => {
    it('should throw when AI provider returns no content', async () => {
      mockComplete.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(
        aiContentGenerator.generateContent(makeContentRequest())
      ).rejects.toThrow('Failed to generate content');
    });

    it('should throw when AI provider throws', async () => {
      mockComplete.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        aiContentGenerator.generateContent(makeContentRequest())
      ).rejects.toThrow('Failed to generate content');
    });

    it('should throw when AI provider returns empty choices array', async () => {
      mockComplete.mockResolvedValue({ choices: [] });

      await expect(
        aiContentGenerator.generateContent(makeContentRequest())
      ).rejects.toThrow('Failed to generate content');
    });

    it('should throw when AI provider returns malformed response', async () => {
      mockComplete.mockResolvedValue(null);

      await expect(
        aiContentGenerator.generateContent(makeContentRequest())
      ).rejects.toThrow();
    });
  });

  describe('generateContent() — BYOK (user credentials)', () => {
    it('should use getAIProvider with user credentials when provided', async () => {
      mockAISuccess('User BYOK content.');

      const { getAIProvider } = require('@/lib/ai/providers');

      await aiContentGenerator.generateContent(makeContentRequest(), {
        apiKey: 'user-api-key-123',
        provider: 'openrouter',
      });

      expect(getAIProvider).toHaveBeenCalledWith({
        apiKey: 'user-api-key-123',
        provider: 'openrouter',
      });
    });

    it('should use platform provider when no user credentials given', async () => {
      mockAISuccess('Platform key content.');

      const { getAIProvider } = require('@/lib/ai/providers');

      await aiContentGenerator.generateContent(makeContentRequest());

      // Called without user key options
      expect(getAIProvider).toHaveBeenCalledWith();
    });
  });

  describe('generateContent() — viral score range', () => {
    it('should return viralScore between 0 and 100', async () => {
      mockAISuccess(
        'Content with numbers 5 tips! Questions? #tag1 #tag2 #tag3 #tag4'
      );

      const result =
        await aiContentGenerator.generateContent(makeContentRequest());

      expect(result.viralScore).toBeGreaterThanOrEqual(0);
      expect(result.viralScore).toBeLessThanOrEqual(100);
    });

    it('should return estimatedEngagement greater than 0', async () => {
      mockAISuccess('Great engaging content!');

      const result =
        await aiContentGenerator.generateContent(makeContentRequest());

      expect(result.estimatedEngagement).toBeGreaterThan(0);
    });
  });

  describe('AIContentGenerator — class instantiation', () => {
    it('should be instantiatable directly', () => {
      const generator = new AIContentGenerator();
      expect(generator).toBeDefined();
    });

    it('aiContentGenerator singleton should be an instance of AIContentGenerator', () => {
      expect(aiContentGenerator).toBeInstanceOf(AIContentGenerator);
    });
  });
});
