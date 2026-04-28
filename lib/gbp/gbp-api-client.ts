/**
 * Default GBP API client.
 *
 * Lazy-imports `googleapis` so test contexts that inject their own
 * client don't pay the bundle cost. If GBP credentials aren't set,
 * every method throws — callers should always inject a fake in tests
 * and feature-flag the real wiring behind a `DR_GBP_ENABLED` env.
 *
 * NOTE: We deliberately do NOT install `googleapis` as part of SYN-837.
 * That requires CEO sign-off (bundle size + new dep). Instead this
 * module shells out to the GBP REST API via plain `fetch` using an
 * OAuth bearer token from env. Wiring the OAuth refresh-token flow
 * is the live-cutover follow-up.
 *
 * @see SYN-837 (parent: SYN-834 epic)
 */

import { logger } from '@/lib/logger';
import type { GbpApiClient, GbpPlace, GbpServiceAreaSnapshot } from './types';

const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';

function requireBearerToken(): string {
  const token = process.env.DR_GBP_OAUTH_BEARER;
  if (!token) {
    throw new Error(
      '[gbp.client] DR_GBP_OAUTH_BEARER missing — inject a fake client in tests, or feature-flag the worker behind DR_GBP_ENABLED'
    );
  }
  return token;
}

interface GbpServiceAreaApiResponse {
  serviceArea?: {
    places?: {
      placeInfos?: Array<{ placeName: string; placeId?: string }>;
    };
  };
}

export const gbpApiClient: GbpApiClient = {
  async getServiceArea(locationId: string): Promise<GbpServiceAreaSnapshot> {
    const token = requireBearerToken();
    const url = `${GBP_API_BASE}/${encodeURIComponent(locationId)}?readMask=serviceArea`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `[gbp.client] getServiceArea ${res.status} ${res.statusText}`
      );
    }
    const body = (await res.json()) as GbpServiceAreaApiResponse;
    const placeInfos = body.serviceArea?.places?.placeInfos ?? [];
    return {
      locationId,
      readAt: new Date().toISOString(),
      places: placeInfos.map(p => ({
        placeName: p.placeName,
        placeId: p.placeId,
      })),
    };
  },

  async patchServiceArea(locationId: string, nextPlaces: GbpPlace[]) {
    const token = requireBearerToken();
    const url = `${GBP_API_BASE}/${encodeURIComponent(locationId)}?updateMask=serviceArea`;
    const body = {
      serviceArea: {
        places: {
          placeInfos: nextPlaces.map(p => ({
            placeName: p.placeName,
            ...(p.placeId ? { placeId: p.placeId } : {}),
          })),
        },
      },
    };
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `[gbp.client] patchServiceArea ${res.status} ${res.statusText}`
      );
    }
    logger.info('[gbp.client] PATCH ok', {
      locationId,
      placeCount: nextPlaces.length,
      status: res.status,
    });
    return { status: res.status };
  },
};

/**
 * No-op audit sink — used when caller doesn't need persistent audit
 * (e.g. tests). Production callers should pass a real sink that
 * writes to the foundation-keeper audit log.
 */
export const noopGbpAuditSink = async (): Promise<void> => {
  /* intentional no-op */
};
