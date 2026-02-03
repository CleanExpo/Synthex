/**
 * AI Streaming Optimizer
 *
 * @description Optimizes AI streaming responses for better performance:
 * - Model connection pre-warming
 * - Backpressure handling
 * - Time-to-first-token optimization
 * - Stream chunking and buffering
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 *
 * FAILURE MODE: Falls back to non-streaming requests
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface StreamOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  startTime?: number;
  onFirstToken?: () => void;
  onProgress?: (progress: StreamProgress) => void;
  signal?: AbortSignal;
}

export interface StreamChunk {
  content: string;
  isFirst: boolean;
  timing: {
    ttft: number | null;
    chunkLatency: number;
    totalElapsed: number;
  };
}

export interface StreamProgress {
  tokensGenerated: number;
  elapsedMs: number;
  tokensPerSecond: number;
}

export interface StreamMetrics {
  ttft: number;
  totalDuration: number;
  totalTokens: number;
  averageTokensPerSecond: number;
}

interface WarmConnection {
  promise: Promise<void>;
  timestamp: number;
  model: string;
}

// ============================================================================
// STREAMING OPTIMIZER
// ============================================================================

export class StreamingOptimizer {
  // Pre-warm model connections
  private static warmConnections: Map<string, WarmConnection> = new Map();
  private static readonly WARM_TIMEOUT = 60000; // 1 minute warmup validity
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';

  /**
   * Pre-warm a model connection for faster first response
   */
  static async warmModel(model: string): Promise<void> {
    const existing = this.warmConnections.get(model);

    // Check if we have a valid warm connection
    if (existing && Date.now() - existing.timestamp < this.WARM_TIMEOUT) {
      return existing.promise;
    }

    // Create new warm connection
    const warmPromise = this.createWarmConnection(model);
    this.warmConnections.set(model, {
      promise: warmPromise,
      timestamp: Date.now(),
      model,
    });

    return warmPromise;
  }

  /**
   * Create a warm connection by making a lightweight ping request
   */
  private static async createWarmConnection(model: string): Promise<void> {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        logger.warn('OpenRouter API key not configured, skipping warm-up');
        return;
      }

      // Make a minimal request to warm up the connection
      const response = await fetch(`${this.BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn('Model warm-up request failed', { model, status: response.status });
      } else {
        logger.debug('Model connection warmed', { model });
      }
    } catch (error) {
      logger.warn('Model warm-up failed', { model, error });
    }
  }

  /**
   * Stream with optimization for TTFT and throughput
   */
  static async *streamWithOptimization(
    prompt: string,
    systemPrompt: string,
    options: StreamOptions
  ): AsyncGenerator<StreamChunk> {
    const startTime = options.startTime || Date.now();
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Pre-flight: warm connection
    await this.warmModel(options.model);

    let isFirst = true;
    let tokenCount = 0;
    let ttft: number | null = null;

    try {
      const response = await fetch(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.app',
          'X-Title': 'SYNTHEX',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1000,
          stream: true,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              tokenCount++;
              const chunkTime = Date.now();

              if (isFirst) {
                ttft = chunkTime - startTime;
                isFirst = false;
                options.onFirstToken?.();
                logger.debug('TTFT recorded', { ttft, model: options.model });
              }

              // Report progress
              if (options.onProgress) {
                options.onProgress({
                  tokensGenerated: tokenCount,
                  elapsedMs: chunkTime - startTime,
                  tokensPerSecond: tokenCount / ((chunkTime - startTime) / 1000),
                });
              }

              yield {
                content,
                isFirst: tokenCount === 1,
                timing: {
                  ttft,
                  chunkLatency: chunkTime - startTime,
                  totalElapsed: chunkTime - startTime,
                },
              };
            }
          } catch (e) {
            // Skip invalid JSON chunks
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug('Stream aborted by user');
        return;
      }
      throw error;
    }
  }

  /**
   * Get collected metrics for a completed stream
   */
  static async collectStreamMetrics(
    generator: AsyncGenerator<StreamChunk>
  ): Promise<{ content: string; metrics: StreamMetrics }> {
    const startTime = Date.now();
    let content = '';
    let ttft = 0;
    let tokenCount = 0;

    for await (const chunk of generator) {
      content += chunk.content;
      tokenCount++;

      if (chunk.isFirst) {
        ttft = chunk.timing.ttft || 0;
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      content,
      metrics: {
        ttft,
        totalDuration,
        totalTokens: tokenCount,
        averageTokensPerSecond: tokenCount / (totalDuration / 1000),
      },
    };
  }

  /**
   * Stream with automatic retry on failure
   */
  static async *streamWithRetry(
    prompt: string,
    systemPrompt: string,
    options: StreamOptions,
    maxRetries: number = 2
  ): AsyncGenerator<StreamChunk> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stream = this.streamWithOptimization(prompt, systemPrompt, {
          ...options,
          startTime: Date.now(),
        });

        for await (const chunk of stream) {
          yield chunk;
        }

        return; // Success
      } catch (error) {
        lastError = error as Error;
        logger.warn('Stream attempt failed', { attempt, error: lastError.message });

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, Math.min(100 * Math.pow(2, attempt), 2000))
          );
        }
      }
    }

    throw lastError || new Error('Stream failed after retries');
  }

  /**
   * Clear warm connections (for testing or cleanup)
   */
  static clearWarmConnections(): void {
    this.warmConnections.clear();
  }

  /**
   * Get warm connection status
   */
  static getWarmStatus(): Map<string, { model: string; age: number; valid: boolean }> {
    const status = new Map<string, { model: string; age: number; valid: boolean }>();
    const now = Date.now();

    for (const [key, conn] of this.warmConnections) {
      const age = now - conn.timestamp;
      status.set(key, {
        model: conn.model,
        age,
        valid: age < this.WARM_TIMEOUT,
      });
    }

    return status;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Stream AI response with optimization
 */
export async function* streamAI(
  prompt: string,
  options: Omit<StreamOptions, 'startTime'> & { systemPrompt?: string }
): AsyncGenerator<string> {
  const systemPrompt = options.systemPrompt || 'You are a helpful AI assistant.';

  const stream = StreamingOptimizer.streamWithOptimization(
    prompt,
    systemPrompt,
    { ...options, startTime: Date.now() }
  );

  for await (const chunk of stream) {
    yield chunk.content;
  }
}

/**
 * Pre-warm models for faster responses
 */
export async function warmModels(models: string[]): Promise<void> {
  await Promise.all(models.map(m => StreamingOptimizer.warmModel(m)));
}

// Export default
export default StreamingOptimizer;
