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

const BING_PLACES_API_BASE = 'https://api.bingplaces.microsoft.com/v1';

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
    const url = `${BING_PLACES_API_BASE}/stores/${encodeURIComponent(storeId)}/service-area`;
    const body = {
      serviceArea: {
        localities: next.map(l => ({ name: l.name })),
      },
    };
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `[bing-places.client] putServiceArea ${res.status} ${res.statusText}`
      );
    }
    logger.info('[bing-places.client] PUT ok', {
      storeId,
      localityCount: next.length,
      status: res.status,
    });
    return { status: res.status };
  },
};

/** No-op audit sink for tests / when caller doesn't need audit. */
export const noopBingPlacesAuditSink = async (): Promise<void> => {
  /* intentional no-op */
};
