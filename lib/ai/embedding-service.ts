/**
 * Embedding Service
 *
 * Generates text embeddings for semantic similarity and search.
 * Uses OpenRouter to access embedding models.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 * - OPENAI_API_KEY: OpenAI API key for embeddings (optional, SECRET)
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

export interface SimilarityResult {
  contentId: string;
  similarity: number;
  content?: string;
}

// ============================================================================
// EMBEDDING SERVICE CLASS
// ============================================================================

export class EmbeddingService {
  private readonly openaiApiKey = process.env.OPENAI_API_KEY;
  private readonly embeddingModel = 'text-embedding-3-small'; // OpenAI's efficient embedding model
  private readonly dimensions = 1536; // Default dimensions for text-embedding-3-small

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    // Clean and truncate text if needed (8191 tokens max for OpenAI)
    const cleanedText = this.preprocessText(text);

    // Try OpenAI embeddings first (most reliable)
    if (this.openaiApiKey) {
      try {
        return await this.embedWithOpenAI(cleanedText);
      } catch (error) {
        logger.warn('OpenAI embedding failed, using fallback', { error });
      }
    }

    // Fallback: Generate simple hash-based embedding (not semantic, but functional)
    return this.generateFallbackEmbedding(cleanedText);
  }

  /**
   * Batch embed multiple texts
   */
  async batchEmbed(texts: string[]): Promise<EmbeddingResult[]> {
    // OpenAI supports batch embedding
    if (this.openaiApiKey && texts.length <= 100) {
      try {
        return await this.batchEmbedWithOpenAI(texts);
      } catch (error) {
        logger.warn('Batch embedding failed, falling back to individual', { error });
      }
    }

    // Fallback: embed individually
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Find most similar items from a list
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidates: Array<{ id: string; embedding: number[]; content?: string }>,
    topK: number = 5
  ): SimilarityResult[] {
    const similarities = candidates.map((candidate) => ({
      contentId: candidate.id,
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding),
      content: candidate.content,
    }));

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Check if an embedding is semantically similar enough
   */
  isSimilar(embedding1: number[], embedding2: number[], threshold: number = 0.8): boolean {
    return this.cosineSimilarity(embedding1, embedding2) >= threshold;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private preprocessText(text: string): string {
    // Remove excessive whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim();

    // Truncate to roughly 8000 tokens (assuming ~4 chars per token)
    const maxChars = 32000;
    if (cleaned.length > maxChars) {
      cleaned = cleaned.substring(0, maxChars);
    }

    return cleaned;
  }

  private async embedWithOpenAI(text: string): Promise<EmbeddingResult> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding failed: ${error}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    return {
      embedding,
      model: this.embeddingModel,
      tokenCount: data.usage?.total_tokens || Math.ceil(text.length / 4),
    };
  }

  private async batchEmbedWithOpenAI(texts: string[]): Promise<EmbeddingResult[]> {
    const cleanedTexts = texts.map((t) => this.preprocessText(t));

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: cleanedTexts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI batch embedding failed: ${error}`);
    }

    const data = await response.json();

    return data.data.map(
      (item: { embedding: number[]; index: number }, index: number) => ({
        embedding: item.embedding,
        model: this.embeddingModel,
        tokenCount: Math.ceil(cleanedTexts[index].length / 4),
      })
    );
  }

  /**
   * Generate a deterministic fallback embedding when AI is unavailable
   * This uses a simple hash-based approach - NOT semantically meaningful
   * but allows the system to function without API keys
   */
  private generateFallbackEmbedding(text: string): EmbeddingResult {
    const embedding = new Array(this.dimensions).fill(0);

    // Simple character-based embedding (not semantic)
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const position = (i * 100 + j * 10 + charCode) % this.dimensions;
        embedding[position] += 0.01;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    logger.info('Using fallback embedding (no OPENAI_API_KEY configured)');

    return {
      embedding,
      model: 'fallback-hash',
      tokenCount: words.length,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const embeddingService = new EmbeddingService();
export default embeddingService;
