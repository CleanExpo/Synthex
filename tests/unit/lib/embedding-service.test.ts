/**
 * Embedding Service Unit Tests
 *
 * @description Tests for the vector embedding service
 */

import { EmbeddingService, EmbeddingResult } from '@/lib/ai/embedding-service';

// Mock fetch for OpenAI API
global.fetch = jest.fn();

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService();
    jest.clearAllMocks();
    // Reset environment
    delete process.env.OPENAI_API_KEY;
  });

  describe('embed', () => {
    it('should throw error for empty text', async () => {
      await expect(embeddingService.embed('')).rejects.toThrow(
        'Cannot embed empty text'
      );
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(embeddingService.embed('   ')).rejects.toThrow(
        'Cannot embed empty text'
      );
    });

    it('should generate fallback embedding when no API key', async () => {
      const result = await embeddingService.embed('Test text for embedding');

      expect(result).toBeDefined();
      expect(result.embedding).toHaveLength(1536);
      expect(result.model).toBe('fallback-hash');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should return normalized fallback embedding', async () => {
      const result = await embeddingService.embed('Test text');

      // Check that embedding is normalized (magnitude approximately 1)
      const magnitude = Math.sqrt(
        result.embedding.reduce((sum, val) => sum + val * val, 0)
      );

      // Should be close to 1 (normalized)
      expect(magnitude).toBeGreaterThan(0.99);
      expect(magnitude).toBeLessThan(1.01);
    });

    it('should use OpenAI when API key is present', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const mockEmbedding = new Array(1536).fill(0.1);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 },
        }),
      });

      const service = new EmbeddingService();
      const result = await service.embed('Test text');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      expect(result.model).toBe('text-embedding-3-small');
    });

    it('should fall back to hash embedding on API failure', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      const service = new EmbeddingService();
      const result = await service.embed('Test text');

      expect(result.model).toBe('fallback-hash');
    });
  });

  describe('batchEmbed', () => {
    it('should embed multiple texts', async () => {
      const texts = ['First text', 'Second text', 'Third text'];
      const results = await embeddingService.batchEmbed(texts);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.embedding).toHaveLength(1536);
      });
    });

    it('should handle empty array', async () => {
      const results = await embeddingService.batchEmbed([]);
      expect(results).toHaveLength(0);
    });

    it('should use batch API when available', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const mockEmbeddings = [
        { embedding: new Array(1536).fill(0.1), index: 0 },
        { embedding: new Array(1536).fill(0.2), index: 1 },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockEmbeddings,
        }),
      });

      const service = new EmbeddingService();
      const results = await service.batchEmbed(['Text 1', 'Text 2']);

      expect(results).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Single batch call
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical embeddings', () => {
      const embedding = [0.5, 0.5, 0.5, 0.5];
      const similarity = embeddingService.cosineSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal embeddings', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [0, 1, 0, 0];
      const similarity = embeddingService.cosineSimilarity(embedding1, embedding2);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite embeddings', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [-1, 0, 0, 0];
      const similarity = embeddingService.cosineSimilarity(embedding1, embedding2);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0, 0];

      expect(() => {
        embeddingService.cosineSimilarity(embedding1, embedding2);
      }).toThrow('Embeddings must have same dimensions');
    });

    it('should return 0 for zero vectors', () => {
      const zeroVector = [0, 0, 0, 0];
      const otherVector = [1, 2, 3, 4];
      const similarity = embeddingService.cosineSimilarity(zeroVector, otherVector);

      expect(similarity).toBe(0);
    });
  });

  describe('findMostSimilar', () => {
    it('should return top K most similar items', () => {
      const queryEmbedding = [1, 0, 0, 0];
      const candidates = [
        { id: 'a', embedding: [1, 0, 0, 0], content: 'Exact match' },
        { id: 'b', embedding: [0.9, 0.1, 0, 0], content: 'Close match' },
        { id: 'c', embedding: [0, 1, 0, 0], content: 'Orthogonal' },
        { id: 'd', embedding: [-1, 0, 0, 0], content: 'Opposite' },
      ];

      const results = embeddingService.findMostSimilar(
        queryEmbedding,
        candidates,
        2
      );

      expect(results).toHaveLength(2);
      expect(results[0].contentId).toBe('a');
      expect(results[1].contentId).toBe('b');
    });

    it('should return all items when K exceeds candidate count', () => {
      const queryEmbedding = [1, 0];
      const candidates = [
        { id: 'a', embedding: [1, 0] },
        { id: 'b', embedding: [0, 1] },
      ];

      const results = embeddingService.findMostSimilar(
        queryEmbedding,
        candidates,
        10
      );

      expect(results).toHaveLength(2);
    });

    it('should include similarity scores', () => {
      const queryEmbedding = [1, 0];
      const candidates = [{ id: 'a', embedding: [1, 0] }];

      const results = embeddingService.findMostSimilar(
        queryEmbedding,
        candidates
      );

      expect(results[0].similarity).toBeCloseTo(1, 5);
    });

    it('should include content when provided', () => {
      const queryEmbedding = [1, 0];
      const candidates = [
        { id: 'a', embedding: [1, 0], content: 'Test content' },
      ];

      const results = embeddingService.findMostSimilar(
        queryEmbedding,
        candidates
      );

      expect(results[0].content).toBe('Test content');
    });
  });

  describe('isSimilar', () => {
    it('should return true when above threshold', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [0.95, 0.05, 0, 0];

      const result = embeddingService.isSimilar(embedding1, embedding2, 0.9);

      expect(result).toBe(true);
    });

    it('should return false when below threshold', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [0, 1, 0, 0];

      const result = embeddingService.isSimilar(embedding1, embedding2, 0.5);

      expect(result).toBe(false);
    });

    it('should use default threshold of 0.8', () => {
      const embedding1 = [1, 0, 0, 0];
      const embedding2 = [0.85, 0.15, 0, 0];

      // Cosine similarity would be around 0.85, above 0.8 threshold
      const result = embeddingService.isSimilar(embedding1, embedding2);

      expect(result).toBe(true);
    });
  });
});
