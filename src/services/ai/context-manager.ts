/**
 * AI Context Window Manager
 *
 * @description Manages AI context windows for optimal token usage:
 * - Smart context compression
 * - Message summarization for long conversations
 * - Relevance-based pruning
 * - System prompt optimization
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: For summarization calls (SECRET)
 *
 * FAILURE MODE: Falls back to simple truncation
 */

import { logger } from '@/lib/logger';
import { getCache } from '@/lib/cache/cache-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  metadata?: {
    tokens?: number;
    importance?: number;
    summarized?: boolean;
  };
}

export interface ContextConfig {
  maxTokens: number;
  reserveForResponse: number;
  summaryThreshold: number;
  minMessagesToKeep: number;
}

export interface ContextStats {
  totalTokens: number;
  messagesCount: number;
  compressionRatio: number;
  summarizedMessages: number;
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for a string (approximation)
 * More accurate would require a tokenizer, but this is fast
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  // Adjust for code/special characters
  const words = text.split(/\s+/).length;
  const chars = text.length;

  // Average of word-based and character-based estimates
  const wordEstimate = words * 1.3;
  const charEstimate = chars / 4;

  return Math.ceil((wordEstimate + charEstimate) / 2);
}

/**
 * Count tokens in messages array
 */
function countMessageTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    const roleTokens = 4; // Overhead for role markers
    const contentTokens = msg.metadata?.tokens || estimateTokens(msg.content);
    return total + roleTokens + contentTokens;
  }, 0);
}

// ============================================================================
// CONTEXT MANAGER
// ============================================================================

export class ContextManager {
  private config: ContextConfig;

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 4000,
      reserveForResponse: config.reserveForResponse ?? 1000,
      summaryThreshold: config.summaryThreshold ?? 3000,
      minMessagesToKeep: config.minMessagesToKeep ?? 4,
    };
  }

  /**
   * Compress context to fit within token limits
   */
  async compressContext(messages: Message[]): Promise<Message[]> {
    const totalTokens = countMessageTokens(messages);
    const targetTokens = this.config.maxTokens - this.config.reserveForResponse;

    // If already within limits, return as-is
    if (totalTokens <= targetTokens) {
      return messages;
    }

    logger.debug('Compressing context', { totalTokens, targetTokens });

    // Strategy 1: Summarize older messages
    let compressed = await this.summarizeOldMessages(messages, targetTokens);

    // Strategy 2: Prune by relevance if still over
    if (countMessageTokens(compressed) > targetTokens) {
      compressed = this.pruneByRelevance(compressed, targetTokens);
    }

    // Strategy 3: Compress system prompts
    compressed = this.compressSystemPrompts(compressed);

    // Strategy 4: Hard truncation as last resort
    if (countMessageTokens(compressed) > targetTokens) {
      compressed = this.truncateToFit(compressed, targetTokens);
    }

    const finalTokens = countMessageTokens(compressed);
    logger.debug('Context compressed', {
      originalTokens: totalTokens,
      finalTokens,
      compressionRatio: finalTokens / totalTokens,
    });

    return compressed;
  }

  /**
   * Summarize older messages to reduce tokens
   */
  private async summarizeOldMessages(
    messages: Message[],
    targetTokens: number
  ): Promise<Message[]> {
    if (messages.length <= this.config.minMessagesToKeep * 2) {
      return messages;
    }

    // Separate system messages from conversation
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Keep recent messages as-is
    const recentMessages = conversationMessages.slice(-this.config.minMessagesToKeep);
    const olderMessages = conversationMessages.slice(0, -this.config.minMessagesToKeep);

    if (olderMessages.length === 0) {
      return messages;
    }

    // Check cache for existing summary
    const cache = getCache();
    const summaryKey = `context:summary:${this.hashMessages(olderMessages)}`;
    const cachedSummary = await cache.get<string>(summaryKey);

    let summary: string;
    if (cachedSummary) {
      summary = cachedSummary;
    } else {
      // Generate summary
      summary = await this.generateSummary(olderMessages);
      await cache.set(summaryKey, summary, { ttl: 3600 }); // Cache for 1 hour
    }

    // Create summary message
    const summaryMessage: Message = {
      role: 'assistant',
      content: `[Previous conversation summary: ${summary}]`,
      metadata: {
        tokens: estimateTokens(summary),
        summarized: true,
      },
    };

    return [...systemMessages, summaryMessage, ...recentMessages];
  }

  /**
   * Generate a summary of messages using AI
   */
  private async generateSummary(messages: Message[]): Promise<string> {
    const conversation = messages
      .map(m => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n');

    // Simple extractive summary as fallback
    const keyPoints: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        // Extract key questions/requests
        const sentences = msg.content.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length > 0) {
          keyPoints.push(`User asked about: ${sentences[0].trim().slice(0, 100)}`);
        }
      } else if (msg.role === 'assistant') {
        // Extract key responses
        const sentences = msg.content.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length > 0) {
          keyPoints.push(`Assistant provided: ${sentences[0].trim().slice(0, 100)}`);
        }
      }
    }

    return keyPoints.slice(0, 5).join('. ');
  }

  /**
   * Prune messages by relevance score
   */
  private pruneByRelevance(messages: Message[], targetTokens: number): Message[] {
    // Always keep system messages and last few messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    // Score messages by importance
    const scoredMessages = otherMessages.map((msg, index) => ({
      msg,
      index,
      score: this.calculateRelevanceScore(msg, index, otherMessages.length),
    }));

    // Sort by score (higher = more important)
    scoredMessages.sort((a, b) => b.score - a.score);

    // Keep messages until we hit target
    const kept: Message[] = [...systemMessages];
    let currentTokens = countMessageTokens(systemMessages);

    for (const { msg } of scoredMessages) {
      const msgTokens = msg.metadata?.tokens || estimateTokens(msg.content);

      if (currentTokens + msgTokens <= targetTokens) {
        kept.push(msg);
        currentTokens += msgTokens;
      }
    }

    // Sort back to original order
    return kept.sort((a, b) => {
      const aIdx = messages.indexOf(a);
      const bIdx = messages.indexOf(b);
      return aIdx - bIdx;
    });
  }

  /**
   * Calculate relevance score for a message
   */
  private calculateRelevanceScore(
    msg: Message,
    index: number,
    totalMessages: number
  ): number {
    let score = 0;

    // Recency bonus (recent messages more important)
    const recencyFactor = (index / totalMessages) * 50;
    score += recencyFactor;

    // User messages slightly more important
    if (msg.role === 'user') {
      score += 10;
    }

    // Messages with questions are important
    if (msg.content.includes('?')) {
      score += 15;
    }

    // Short messages are cheaper to keep
    const tokens = msg.metadata?.tokens || estimateTokens(msg.content);
    if (tokens < 100) {
      score += 10;
    }

    // Explicit importance from metadata
    if (msg.metadata?.importance) {
      score += msg.metadata.importance;
    }

    return score;
  }

  /**
   * Compress system prompts
   */
  private compressSystemPrompts(messages: Message[]): Message[] {
    return messages.map(msg => {
      if (msg.role !== 'system') return msg;

      // Remove redundant whitespace
      let compressed = msg.content.replace(/\s+/g, ' ').trim();

      // Remove common filler phrases
      const fillerPhrases = [
        'Please note that',
        'It is important to remember that',
        'Keep in mind that',
        'As a reminder,',
      ];

      for (const phrase of fillerPhrases) {
        compressed = compressed.replace(new RegExp(phrase, 'gi'), '');
      }

      return {
        ...msg,
        content: compressed,
        metadata: {
          ...msg.metadata,
          tokens: estimateTokens(compressed),
        },
      };
    });
  }

  /**
   * Hard truncation as last resort
   */
  private truncateToFit(messages: Message[], targetTokens: number): Message[] {
    // Keep system messages and at least last 2 messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const kept: Message[] = [...systemMessages];
    let currentTokens = countMessageTokens(systemMessages);

    // Add messages from the end
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msg = otherMessages[i];
      const msgTokens = msg.metadata?.tokens || estimateTokens(msg.content);

      if (currentTokens + msgTokens <= targetTokens) {
        kept.unshift(msg);
        currentTokens += msgTokens;
      } else if (kept.length < this.config.minMessagesToKeep) {
        // Truncate message content if we need to keep minimum messages
        const availableTokens = targetTokens - currentTokens;
        const truncatedContent = msg.content.slice(0, availableTokens * 4);
        kept.unshift({
          ...msg,
          content: truncatedContent + '...',
          metadata: {
            ...msg.metadata,
            tokens: estimateTokens(truncatedContent),
          },
        });
        break;
      }
    }

    return kept;
  }

  /**
   * Create a hash of messages for caching
   */
  private hashMessages(messages: Message[]): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Maintain sliding window with memory for conversation
   */
  async maintainWindow(
    conversationId: string,
    newMessage: Message
  ): Promise<Message[]> {
    const cache = getCache();
    const historyKey = `conversation:${conversationId}`;

    // Get existing history
    const history = await cache.get<Message[]>(historyKey) || [];

    // Add new message
    const updated = [...history, newMessage];

    // Compress if needed
    const compressed = await this.compressContext(updated);

    // Store compressed history
    await cache.set(historyKey, compressed, { ttl: 7200 }); // 2 hour TTL

    return compressed;
  }

  /**
   * Get context statistics
   */
  getStats(messages: Message[]): ContextStats {
    const totalTokens = countMessageTokens(messages);
    const summarizedMessages = messages.filter(m => m.metadata?.summarized).length;

    return {
      totalTokens,
      messagesCount: messages.length,
      compressionRatio: totalTokens / this.config.maxTokens,
      summarizedMessages,
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Create a context manager with default settings
 */
export function createContextManager(maxTokens: number = 4000): ContextManager {
  return new ContextManager({ maxTokens });
}

/**
 * Compress messages for API call
 */
export async function compressMessages(
  messages: Message[],
  maxTokens: number = 4000
): Promise<Message[]> {
  const manager = createContextManager(maxTokens);
  return manager.compressContext(messages);
}

// Export default
export default ContextManager;
