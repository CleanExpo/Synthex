/**
 * NLP Analyzer Unit Tests
 *
 * @description Tests for the AI-powered NLP analyzer
 */

import { NLPAnalyzer, NLPAnalysisResult, SentimentAnalysis } from '@/lib/ai/nlp-analyzer';

// Mock OpenRouter API
jest.mock('@/lib/ai/openrouter', () => ({
  callOpenRouter: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { callOpenRouter } from '@/lib/ai/openrouter';

describe('NLPAnalyzer', () => {
  let analyzer: NLPAnalyzer;

  beforeEach(() => {
    analyzer = new NLPAnalyzer();
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should throw error for content shorter than 10 characters', async () => {
      await expect(analyzer.analyze('short')).rejects.toThrow(
        'Content too short for analysis'
      );
    });

    it('should throw error for empty content', async () => {
      await expect(analyzer.analyze('')).rejects.toThrow(
        'Content too short for analysis'
      );
    });

    it('should throw error for whitespace-only content', async () => {
      await expect(analyzer.analyze('         ')).rejects.toThrow(
        'Content too short for analysis'
      );
    });

    it('should call OpenRouter with correct prompt structure', async () => {
      const mockResponse = JSON.stringify({
        tone: {
          primary: 'professional',
          secondary: ['informative'],
          formality: 80,
          energy: 60,
          warmth: 50,
          humor: 10,
          explanation: 'Professional business content',
        },
        vocabulary: {
          complexity: 'standard',
          jargonLevel: 30,
          preferredWords: ['business', 'growth'],
          uniquePhrases: [],
          readingLevel: '8th grade',
        },
        structure: {
          averageSentenceLength: 15,
          usesLists: false,
          usesQuestions: true,
          usesCTA: true,
          emojiUsage: 'minimal',
          hashtagUsage: 2,
          paragraphStyle: 'concise',
        },
        patterns: {
          hookPatterns: ['Question opening'],
          closingPatterns: ['Call to action'],
          transitionPhrases: ['however', 'therefore'],
          callToActions: ['Click here'],
          signatureElements: [],
          recurringThemes: ['growth', 'success'],
        },
        topics: ['business', 'marketing'],
        sentiment: {
          overall: 'positive',
          score: 75,
          emotions: ['optimistic', 'confident'],
          confidence: 85,
        },
        confidence: 90,
      });

      (callOpenRouter as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await analyzer.analyze(
        'This is a test content that is long enough for analysis purposes.'
      );

      expect(callOpenRouter).toHaveBeenCalled();
      expect(result.tone.primary).toBe('professional');
      expect(result.confidence).toBe(90);
    });

    it('should fall back to rule-based analysis on API failure', async () => {
      (callOpenRouter as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzer.analyze(
        'This is a positive and wonderful piece of content for testing!'
      );

      // Should return a valid result even when API fails
      expect(result).toBeDefined();
      expect(result.tone).toBeDefined();
      expect(result.vocabulary).toBeDefined();
      expect(result.sentiment).toBeDefined();
    });

    it('should handle markdown-wrapped JSON responses', async () => {
      const markdownResponse = `\`\`\`json
{
  "tone": {"primary": "casual", "secondary": [], "formality": 30, "energy": 70, "warmth": 80, "humor": 50, "explanation": "Casual tone"},
  "vocabulary": {"complexity": "simple", "jargonLevel": 10, "preferredWords": [], "uniquePhrases": [], "readingLevel": "6th grade"},
  "structure": {"averageSentenceLength": 10, "usesLists": false, "usesQuestions": false, "usesCTA": false, "emojiUsage": "moderate", "hashtagUsage": 0, "paragraphStyle": "short"},
  "patterns": {"hookPatterns": [], "closingPatterns": [], "transitionPhrases": [], "callToActions": [], "signatureElements": [], "recurringThemes": []},
  "topics": ["casual conversation"],
  "sentiment": {"overall": "positive", "score": 60, "emotions": ["happy"], "confidence": 75},
  "confidence": 80
}
\`\`\``;

      (callOpenRouter as jest.Mock).mockResolvedValueOnce(markdownResponse);

      const result = await analyzer.analyze(
        'Hey everyone! Just sharing some thoughts today 😊'
      );

      expect(result.tone.primary).toBe('casual');
    });

    it('should include raw analysis in response', async () => {
      const mockResponse = JSON.stringify({
        tone: { primary: 'professional', secondary: [], formality: 70, energy: 50, warmth: 50, humor: 10, explanation: '' },
        vocabulary: { complexity: 'standard', jargonLevel: 20, preferredWords: [], uniquePhrases: [], readingLevel: '8th grade' },
        structure: { averageSentenceLength: 15, usesLists: false, usesQuestions: false, usesCTA: false, emojiUsage: 'none', hashtagUsage: 0, paragraphStyle: 'standard' },
        patterns: { hookPatterns: [], closingPatterns: [], transitionPhrases: [], callToActions: [], signatureElements: [], recurringThemes: [] },
        topics: [],
        sentiment: { overall: 'neutral', score: 0, emotions: [], confidence: 70 },
        confidence: 75,
      });

      (callOpenRouter as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await analyzer.analyze(
        'This is test content for the NLP analysis module.'
      );

      expect(result.rawAnalysis).toBe(mockResponse);
    });
  });

  describe('batchAnalyze', () => {
    it('should analyze multiple content pieces', async () => {
      const mockResponse = JSON.stringify({
        tone: { primary: 'professional', secondary: [], formality: 70, energy: 50, warmth: 50, humor: 10, explanation: '' },
        vocabulary: { complexity: 'standard', jargonLevel: 20, preferredWords: [], uniquePhrases: [], readingLevel: '8th grade' },
        structure: { averageSentenceLength: 15, usesLists: false, usesQuestions: false, usesCTA: false, emojiUsage: 'none', hashtagUsage: 0, paragraphStyle: 'standard' },
        patterns: { hookPatterns: [], closingPatterns: [], transitionPhrases: [], callToActions: [], signatureElements: [], recurringThemes: [] },
        topics: [],
        sentiment: { overall: 'neutral', score: 0, emotions: [], confidence: 70 },
        confidence: 75,
      });

      (callOpenRouter as jest.Mock).mockResolvedValue(mockResponse);

      const contents = [
        'First piece of content for analysis testing.',
        'Second piece of content for batch processing.',
        'Third piece of content to verify batching.',
      ];

      const results = await analyzer.batchAnalyze(contents);

      expect(results).toHaveLength(3);
      expect(callOpenRouter).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch', async () => {
      const mockResponse = JSON.stringify({
        tone: { primary: 'casual', secondary: [], formality: 30, energy: 60, warmth: 70, humor: 40, explanation: '' },
        vocabulary: { complexity: 'simple', jargonLevel: 10, preferredWords: [], uniquePhrases: [], readingLevel: '6th grade' },
        structure: { averageSentenceLength: 10, usesLists: false, usesQuestions: false, usesCTA: false, emojiUsage: 'none', hashtagUsage: 0, paragraphStyle: 'short' },
        patterns: { hookPatterns: [], closingPatterns: [], transitionPhrases: [], callToActions: [], signatureElements: [], recurringThemes: [] },
        topics: [],
        sentiment: { overall: 'positive', score: 50, emotions: [], confidence: 60 },
        confidence: 65,
      });

      // First call succeeds, second fails, third succeeds
      (callOpenRouter as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(mockResponse);

      const contents = [
        'First piece of content is fine.',
        'Second piece will fail during analysis.',
        'Third piece of content is also fine.',
      ];

      const results = await analyzer.batchAnalyze(contents);

      // Should return 3 results (including fallback for failed one)
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.tone).toBeDefined();
      });
    });
  });

  describe('extractTopics', () => {
    it('should extract topics from content', async () => {
      const mockTopics = ['technology', 'innovation', 'AI'];
      (callOpenRouter as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockTopics)
      );

      const topics = await analyzer.extractTopics(
        'This article discusses new technology and innovation in the AI space.'
      );

      expect(topics).toEqual(mockTopics);
    });

    it('should return empty array for invalid response', async () => {
      (callOpenRouter as jest.Mock).mockResolvedValueOnce('not valid json');

      const topics = await analyzer.extractTopics('Some test content here.');

      expect(Array.isArray(topics)).toBe(true);
    });

    it('should fall back on API failure', async () => {
      (callOpenRouter as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const topics = await analyzer.extractTopics(
        'Technology and business are the main topics here.'
      );

      // Should return fallback topics (word frequency based)
      expect(Array.isArray(topics)).toBe(true);
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment correctly', async () => {
      const mockSentiment: SentimentAnalysis = {
        overall: 'positive',
        score: 80,
        emotions: ['happy', 'excited'],
        confidence: 90,
      };

      (callOpenRouter as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockSentiment)
      );

      const result = await analyzer.analyzeSentiment(
        'I am so happy and excited about this amazing opportunity!'
      );

      expect(result.overall).toBe('positive');
      expect(result.score).toBe(80);
      expect(result.emotions).toContain('happy');
    });

    it('should fall back on API failure', async () => {
      (callOpenRouter as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzer.analyzeSentiment(
        'This is wonderful and amazing content!'
      );

      // Should return fallback sentiment
      expect(result).toBeDefined();
      expect(['positive', 'neutral', 'negative']).toContain(result.overall);
    });
  });

  describe('compareContent', () => {
    it('should compare two content pieces', async () => {
      const mockComparison = {
        similarity: 75,
        sharedPatterns: ['formal tone', 'short sentences'],
        differences: ['different topics', 'vocabulary complexity'],
      };

      (callOpenRouter as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockComparison)
      );

      const result = await analyzer.compareContent(
        'First piece of professional content.',
        'Second piece of professional content.'
      );

      expect(result.similarity).toBe(75);
      expect(result.sharedPatterns).toContain('formal tone');
    });

    it('should return default values on failure', async () => {
      (callOpenRouter as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzer.compareContent(
        'Content one here.',
        'Content two here.'
      );

      expect(result.similarity).toBe(50);
      expect(result.sharedPatterns).toEqual([]);
      expect(result.differences).toEqual([]);
    });
  });
});

describe('NLPAnalysisResult types', () => {
  it('should have correct structure for ToneAnalysis', () => {
    const tone = {
      primary: 'professional',
      secondary: ['informative'],
      formality: 80,
      energy: 60,
      warmth: 50,
      humor: 10,
      confidence: 85,
      explanation: 'Test',
    };

    expect(tone.formality).toBeGreaterThanOrEqual(0);
    expect(tone.formality).toBeLessThanOrEqual(100);
  });

  it('should have correct structure for SentimentAnalysis', () => {
    const sentiment: SentimentAnalysis = {
      overall: 'positive',
      score: 75,
      emotions: ['happy'],
      confidence: 90,
    };

    expect(['positive', 'neutral', 'negative']).toContain(sentiment.overall);
    expect(sentiment.score).toBeGreaterThanOrEqual(-100);
    expect(sentiment.score).toBeLessThanOrEqual(100);
  });
});
