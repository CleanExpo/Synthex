/**
 * Default Bing Places API client.
 *
 * Plain `fetch` against the Bing Places Bulk Update endpoint. Reads
 * `BING_PLACES_API_KEY` from env. If missing, every method throws —
 * callers should always inject a fake in tests and feature-flag the
 * real wiring behind a `DR_BING_PLACES_ENABLED` env var.
 *
 * NOTE: Bing Places does not have a public REST endpoint for partial
 * service-area updates — production wiring uses the Bulk Upload XML
 * format. This client uses a simplified JSON wrapper that the SYN-841
 * follow-up will swap for the real Bulk Upload pipeline (separate
 * ticket, requires auth review).
 *
 * @see SYN-841 (parent: SYN-834 epic)
 */

import { logger } from '@/lib/logger';
import type {
  BingLocality,
  BingPlacesApiClient,
  BingServiceAreaSnapshot,
} from './types';
import {
  serializeBulkUploadXml,
  parseBulkUploadJobId,
  parseBulkUploadJobStatus,
} from './bulk-upload-xml';

const BING_PLACES_API_BASE = 'https://api.bingplaces.microsoft.com/v1';

// Bulk-upload jobs are asynchronous: submit returns a JobId, then we poll for a
// terminal status. Bounded so a stuck job can never hang the worker.
const BULK_UPLOAD_POLL_ATTEMPTS = 10;
const BULK_UPLOAD_POLL_INTERVAL_MS = 3000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function requireApiKey(): string {
  const key = process.env.BING_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      '[bing-places.client] BING_PLACES_API_KEY missing — inject a fake client in tests, or feature-flag the worker behind DR_BING_PLACES_ENABLED'
    );
  }
  return key;
}

interface BingApiResponse {
  serviceArea?: {
    localities?: Array<{ name: string }>;
  };
}

export const bingPlacesApiClient: BingPlacesApiClient = {
  async getServiceArea(storeId: string): Promise<BingServiceAreaSnapshot> {
    const key = requireApiKey();
    const url = `${BING_PLACES_API_BASE}/stores/${encodeURIComponent(storeId)}/service-area`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });
    if (!res.ok) {
      throw new Error(
        `[bing-places.client] getServiceArea ${res.status} ${res.statusText}`
      );
    }
    const body = (await res.json()) as BingApiResponse;
    const localities = body.serviceArea?.localities ?? [];
    return {
      storeId,
      readAt: new Date().toISOString(),
      localities: localities.map(l => ({ name: l.name })),
    };
  },

  async putServiceArea(storeId: string, next: BingLocality[]) {
    const key = requireApiKey();

    // 1. Submit the Bulk Upload XML document. Bing returns a JobId; the upload
    //    is applied asynchronously (not a synchronous PUT).
    const xml = serializeBulkUploadXml(storeId, next);
    const submitRes = await fetch(`${BING_PLACES_API_BASE}/bulkupload`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/xml',
      },
      body: xml,
    });
    if (!submitRes.ok) {
      throw new Error(
        `[bing-places.client] bulk upload submit ${submitRes.status} ${submitRes.statusText}`
      );
    }
    const jobId = parseBulkUploadJobId(await submitRes.text());
    if (!jobId) {
      throw new Error(
        '[bing-places.client] bulk upload submit returned no JobId'
      );
    }

    // 2. Poll the job until it reaches a terminal status (bounded).
    for (let attempt = 1; attempt <= BULK_UPLOAD_POLL_ATTEMPTS; attempt++) {
      const statusRes = await fetch(
        `${BING_PLACES_API_BASE}/bulkupload/${encodeURIComponent(jobId)}/status`,
        { method: 'GET', headers: { 'Ocp-Apim-Subscription-Key': key } }
      );
      if (!statusRes.ok) {
        throw new Error(
          `[bing-places.client] bulk upload status ${statusRes.status} ${statusRes.statusText}`
        );
      }
      const status = parseBulkUploadJobStatus(await statusRes.text());
      if (status === 'Completed') {
        logger.info('[bing-places.client] bulk upload completed', {
          storeId,
          jobId,
          localityCount: next.length,
          attempts: attempt,
        });
        return { status: 200 };
      }
      if (status === 'Failed') {
        throw new Error(
          `[bing-places.client] bulk upload job ${jobId} failed`
        );
      }
      if (attempt < BULK_UPLOAD_POLL_ATTEMPTS) {
        await sleep(BULK_UPLOAD_POLL_INTERVAL_MS);
      }
    }

    throw new Error(
      `[bing-places.client] bulk upload job ${jobId} did not complete within ${BULK_UPLOAD_POLL_ATTEMPTS} polls`
    );
  },
};

/** No-op audit sink for tests / when caller doesn't need audit. */
export const noopBingPlacesAuditSink = async (): Promise<void> => {
  /* intentional no-op */
};
