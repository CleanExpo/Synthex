/**
 * Query Batching Utilities
 * Prevents N+1 query problems using DataLoader pattern
 *
 * @task UNI-435 - Scalability & Performance Epic
 *
 * Usage:
 * ```typescript
 * const userLoader = createLoader(async (ids) => {
 *   const users = await prisma.user.findMany({ where: { id: { in: ids } } });
 *   return ids.map(id => users.find(u => u.id === id) || null);
 * });
 *
 * // These are batched into a single query
 * const [user1, user2] = await Promise.all([
 *   userLoader.load('id1'),
 *   userLoader.load('id2'),
 * ]);
 * ```
 */

type BatchFunction<K, V> = (keys: K[]) => Promise<(V | Error | null)[]>;

interface LoaderOptions {
  maxBatchSize?: number;
  batchScheduleFn?: (callback: () => void) => void;
  cacheKeyFn?: <K>(key: K) => string;
  cache?: boolean;
}

/**
 * Simple DataLoader implementation for query batching
 */
export class DataLoader<K, V> {
  private batchFn: BatchFunction<K, V>;
  private options: Required<LoaderOptions>;
  private cache: Map<string, Promise<V | null>> = new Map();
  private batch: { key: K; resolve: (value: V | null) => void; reject: (error: Error) => void }[] = [];
  private batchScheduled = false;

  constructor(batchFn: BatchFunction<K, V>, options: LoaderOptions = {}) {
    this.batchFn = batchFn;
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 100,
      batchScheduleFn: options.batchScheduleFn ?? ((cb) => process.nextTick(cb)),
      cacheKeyFn: options.cacheKeyFn ?? ((key) => String(key)),
      cache: options.cache ?? true,
    };
  }

  /**
   * Load a single value by key
   */
  async load(key: K): Promise<V | null> {
    const cacheKey = this.options.cacheKeyFn(key);

    // Check cache
    if (this.options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Create promise and add to batch
    const promise = new Promise<V | null>((resolve, reject) => {
      this.batch.push({ key, resolve, reject });
    });

    // Store in cache
    if (this.options.cache) {
      this.cache.set(cacheKey, promise);
    }

    // Schedule batch execution
    if (!this.batchScheduled) {
      this.batchScheduled = true;
      this.options.batchScheduleFn(() => this.executeBatch());
    }

    return promise;
  }

  /**
   * Load multiple values by keys
   */
  async loadMany(keys: K[]): Promise<(V | null)[]> {
    return Promise.all(keys.map((key) => this.load(key)));
  }

  /**
   * Clear cached value for key
   */
  clear(key: K): this {
    const cacheKey = this.options.cacheKeyFn(key);
    this.cache.delete(cacheKey);
    return this;
  }

  /**
   * Clear all cached values
   */
  clearAll(): this {
    this.cache.clear();
    return this;
  }

  /**
   * Prime the cache with a value
   */
  prime(key: K, value: V | null): this {
    const cacheKey = this.options.cacheKeyFn(key);
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, Promise.resolve(value));
    }
    return this;
  }

  /**
   * Execute the current batch
   */
  private async executeBatch(): Promise<void> {
    const batch = this.batch;
    this.batch = [];
    this.batchScheduled = false;

    if (batch.length === 0) return;

    // Split into chunks if exceeding max batch size
    const chunks: typeof batch[] = [];
    for (let i = 0; i < batch.length; i += this.options.maxBatchSize) {
      chunks.push(batch.slice(i, i + this.options.maxBatchSize));
    }

    for (const chunk of chunks) {
      const keys = chunk.map((item) => item.key);

      try {
        const values = await this.batchFn(keys);

        if (values.length !== keys.length) {
          throw new Error(
            `DataLoader batch function returned ${values.length} values for ${keys.length} keys`
          );
        }

        chunk.forEach((item, index) => {
          const value = values[index];
          if (value instanceof Error) {
            item.reject(value);
          } else {
            item.resolve(value);
          }
        });
      } catch (error) {
        chunk.forEach((item) => {
          item.reject(error instanceof Error ? error : new Error(String(error)));
        });
      }
    }
  }
}

/**
 * Factory function to create a DataLoader
 */
export function createLoader<K, V>(
  batchFn: BatchFunction<K, V>,
  options?: LoaderOptions
): DataLoader<K, V> {
  return new DataLoader(batchFn, options);
}

/**
 * Create a request-scoped loader cache
 * Use this to ensure loaders are reused within a single request
 */
export class LoaderContext {
   
  private loaders: Map<string, DataLoader<any, any>> = new Map();

  /**
   * Get or create a loader for the given key
   */
  getLoader<K, V>(
    name: string,
    batchFn: BatchFunction<K, V>,
    options?: LoaderOptions
  ): DataLoader<K, V> {
    if (!this.loaders.has(name)) {
      this.loaders.set(name, createLoader(batchFn, options));
    }
    return this.loaders.get(name) as DataLoader<K, V>;
  }

  /**
   * Clear all loaders (call at end of request)
   */
  clearAll(): void {
    this.loaders.forEach((loader) => loader.clearAll());
    this.loaders.clear();
  }
}

/** Common entity with id field */
interface EntityWithId {
  id: string;
  [key: string]: unknown;
}

/** Prisma-like client interface for loader factories */
interface PrismaLikeClient {
  user: {
    findMany: (args: { where: { id: { in: string[] } } }) => Promise<EntityWithId[]>;
  };
  campaign: {
    findMany: (args: { where: { id: { in: string[] } } }) => Promise<EntityWithId[]>;
  };
  project: {
    findMany: (args: { where: { id: { in: string[] } } }) => Promise<EntityWithId[]>;
  };
}

/**
 * Pre-built loader factories for common SYNTHEX entities
 */
export const loaderFactories = {
  /**
   * Create a user loader
   */
  users: (prisma: PrismaLikeClient) =>
    createLoader(async (ids: string[]) => {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => userMap.get(id) || null);
    }),

  /**
   * Create a campaign loader
   */
  campaigns: (prisma: PrismaLikeClient) =>
    createLoader(async (ids: string[]) => {
      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: ids } },
      });
      const map = new Map(campaigns.map((c) => [c.id, c]));
      return ids.map((id) => map.get(id) || null);
    }),

  /**
   * Create a project loader
   */
  projects: (prisma: PrismaLikeClient) =>
    createLoader(async (ids: string[]) => {
      const projects = await prisma.project.findMany({
        where: { id: { in: ids } },
      });
      const map = new Map(projects.map((p) => [p.id, p]));
      return ids.map((id) => map.get(id) || null);
    }),
};

export default DataLoader;
