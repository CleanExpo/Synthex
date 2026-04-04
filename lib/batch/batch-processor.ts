/**
 * Batch Processor
 *
 * @description High-performance batch processing pipeline:
 * - Configurable batch sizes and concurrency
 * - Rate limiting and throttling
 * - Progress tracking and reporting
 * - Error handling with retry logic
 * - Graceful degradation under load
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - None required, uses sensible defaults
 *
 * FAILURE MODE: Continues processing remaining items on individual failures
 */

import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  delayMs?: number;
  retries?: number;
  retryDelayMs?: number;
  continueOnError?: boolean;
  onProgress?: (progress: BatchProgress) => void;
  signal?: AbortSignal;
}

export interface BatchProgress {
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;
}

export interface BatchError<T = unknown> {
  item: T;
  index: number;
  error: Error;
  retryCount: number;
}

export interface BatchResult<T, R> {
  results: R[];
  errors: BatchError<T>[];
  stats: {
    totalItems: number;
    successCount: number;
    errorCount: number;
    totalDuration: number;
    averageItemDuration: number;
    itemsPerSecond: number;
  };
}

// ============================================================================
// BATCH PROCESSOR
// ============================================================================

export class BatchProcessor<T, R> {
  private processor: (items: T[]) => Promise<R[]>;
  private options: Required<Omit<BatchOptions, 'signal' | 'onProgress'>> & Pick<BatchOptions, 'signal' | 'onProgress'>;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    options: BatchOptions = {}
  ) {
    this.processor = processor;
    this.options = {
      batchSize: options.batchSize ?? 100,
      concurrency: options.concurrency ?? 3,
      delayMs: options.delayMs ?? 100,
      retries: options.retries ?? 2,
      retryDelayMs: options.retryDelayMs ?? 1000,
      continueOnError: options.continueOnError ?? true,
      onProgress: options.onProgress,
      signal: options.signal,
    };
  }

  /**
   * Process all items in batches
   */
  async process(items: T[]): Promise<BatchResult<T, R>> {
    const startTime = Date.now();
    const batches = this.chunk(items, this.options.batchSize);
    const results: R[] = [];
    const errors: BatchError<T>[] = [];

    let processed = 0;
    const total = items.length;

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += this.options.concurrency) {
      // Check for abort signal
      if (this.options.signal?.aborted) {
        throw new DOMException('Batch processing aborted', 'AbortError');
      }

      const batchGroup = batches.slice(i, i + this.options.concurrency);
      const batchPromises = batchGroup.map((batch, groupIndex) =>
        this.processBatch(batch, i + groupIndex, items)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const batch = batchGroup[j];

        if (result.status === 'fulfilled') {
          results.push(...result.value.results);
          errors.push(...result.value.errors);
          processed += batch.length;
        } else {
          // Batch-level failure
          const batchStartIndex = (i + j) * this.options.batchSize;
          for (let k = 0; k < batch.length; k++) {
            errors.push({
              item: batch[k],
              index: batchStartIndex + k,
              error: result.reason,
              retryCount: this.options.retries,
            });
          }
          processed += batch.length;

          if (!this.options.continueOnError) {
            throw result.reason;
          }
        }

        // Report progress
        this.reportProgress({
          processed,
          total,
          succeeded: results.length,
          failed: errors.length,
          percentage: Math.round((processed / total) * 100),
          currentBatch: i + j + 1,
          totalBatches: batches.length,
          estimatedTimeRemaining: this.estimateTimeRemaining(
            startTime,
            processed,
            total
          ),
        });
      }

      // Add delay between batch groups (not after last group)
      if (i + this.options.concurrency < batches.length && this.options.delayMs > 0) {
        await this.delay(this.options.delayMs);
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      results,
      errors,
      stats: {
        totalItems: total,
        successCount: results.length,
        errorCount: errors.length,
        totalDuration,
        averageItemDuration: total > 0 ? totalDuration / total : 0,
        itemsPerSecond: total > 0 ? (total / totalDuration) * 1000 : 0,
      },
    };
  }

  /**
   * Process a single batch with retry logic
   */
  private async processBatch(
    batch: T[],
    batchIndex: number,
    allItems: T[]
  ): Promise<{ results: R[]; errors: BatchError<T>[] }> {
    const batchStartIndex = batchIndex * this.options.batchSize;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const results = await this.processor(batch);
        return { results, errors: [] };
      } catch (error) {
        lastError = error as Error;
        logger.warn('Batch processing attempt failed', {
          batchIndex,
          attempt,
          error: lastError.message,
        });

        if (attempt < this.options.retries) {
          await this.delay(this.options.retryDelayMs * (attempt + 1));
        }
      }
    }

    // All retries failed
    const errors: BatchError<T>[] = batch.map((item, index) => ({
      item,
      index: batchStartIndex + index,
      error: lastError!,
      retryCount: this.options.retries,
    }));

    return { results: [], errors };
  }

  /**
   * Split items into batches
   */
  private chunk(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: BatchProgress): void {
    if (this.options.onProgress) {
      try {
        this.options.onProgress(progress);
      } catch (error) {
        logger.warn('Progress callback failed', { error });
      }
    }
  }

  /**
   * Estimate remaining time based on current progress
   */
  private estimateTimeRemaining(
    startTime: number,
    processed: number,
    total: number
  ): number | undefined {
    if (processed === 0) return undefined;

    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;

    return Math.round(remaining / rate);
  }
}

// ============================================================================
// SPECIALIZED BATCH PROCESSORS
// ============================================================================

/**
 * Create a batch processor for database operations
 */
export function createDbBatchProcessor<T, R>(
  operation: (items: T[]) => Promise<R[]>,
  options?: BatchOptions
): BatchProcessor<T, R> {
  return new BatchProcessor(operation, {
    batchSize: 50,
    concurrency: 2,
    delayMs: 50,
    retries: 2,
    continueOnError: true,
    ...options,
  });
}

/**
 * Create a batch processor for API calls
 */
export function createApiBatchProcessor<T, R>(
  operation: (items: T[]) => Promise<R[]>,
  options?: BatchOptions
): BatchProcessor<T, R> {
  return new BatchProcessor(operation, {
    batchSize: 10,
    concurrency: 3,
    delayMs: 200,
    retries: 3,
    continueOnError: true,
    ...options,
  });
}

/**
 * Create a batch processor for file operations
 */
export function createFileBatchProcessor<T, R>(
  operation: (items: T[]) => Promise<R[]>,
  options?: BatchOptions
): BatchProcessor<T, R> {
  return new BatchProcessor(operation, {
    batchSize: 20,
    concurrency: 5,
    delayMs: 0,
    retries: 1,
    continueOnError: true,
    ...options,
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Process items one at a time with batching
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options?: BatchOptions
): Promise<BatchResult<T, R>> {
  const batchProcessor = new BatchProcessor<T, R>(
    async (batch) => Promise.all(batch.map(processor)),
    options
  );

  return batchProcessor.process(items);
}

/**
 * Map items with controlled concurrency
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = new Array(items.length);

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, j) => mapper(item, i + j))
    );

    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }

  return results;
}

/**
 * Filter items with controlled concurrency
 */
export async function filterWithConcurrency<T>(
  items: T[],
  predicate: (item: T, index: number) => Promise<boolean>,
  concurrency: number = 10
): Promise<T[]> {
  const results: Array<{ item: T; include: boolean }> = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item, j) => ({
        item,
        include: await predicate(item, i + j),
      }))
    );

    results.push(...batchResults);
  }

  return results.filter(r => r.include).map(r => r.item);
}

// Export default
export default BatchProcessor;
