/**
 * Apify Client Singleton
 *
 * Wraps ApifyClient with typed actor execution and dataset retrieval.
 *
 * ENVIRONMENT VARIABLES:
 * - APIFY_API_TOKEN: Apify API token (SECRET)
 *
 * Usage:
 *   const posts = await runActor<ScrapedPost>('apify/instagram-scraper', input);
 */

import { ApifyClient } from 'apify-client';
import { logger } from '@/lib/logger';

// Global singleton — prevents multiple client instances in dev (HMR)
const globalForApify = globalThis as unknown as {
  apifyClient: ApifyClient | undefined;
};

function getApifyClient(): ApifyClient {
  if (!globalForApify.apifyClient) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      logger.warn('APIFY_API_TOKEN not configured — Apify scraping will fail');
    }
    globalForApify.apifyClient = new ApifyClient({ token });
  }
  return globalForApify.apifyClient;
}

/**
 * Run an Apify actor and return typed dataset items.
 * Starts the run, waits for completion, then fetches all dataset items.
 */
export async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>
): Promise<T[]> {
  const client = getApifyClient();

  logger.info('Apify: starting actor run', { actorId });

  const run = await client.actor(actorId).call(input, {
    waitSecs: 300, // 5-minute timeout
  });

  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Apify actor ${actorId} failed with status: ${run.status}`);
  }

  logger.info('Apify: actor run complete, fetching dataset', {
    actorId,
    datasetId: run.defaultDatasetId,
  });

  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  logger.info('Apify: dataset fetched', {
    actorId,
    itemCount: dataset.items.length,
  });

  return dataset.items as T[];
}

export { getApifyClient };
