/**
 * Algorithm Sentinel — Algorithm Feed
 *
 * Google ranking updates as recorded on the official Google Search Status Dashboard.
 * - Live: syncLiveAlgorithmUpdates() reads the dashboard's public incidents.json and
 *   upserts each incident. Throttled per process; a failed read is reported as
 *   'unavailable', never as an empty success.
 * - Fallback: KNOWN_ALGORITHM_UPDATES, transcribed from the dashboard's Ranking
 *   history so a cold database is correct even when the feed cannot be reached.
 *
 * ENVIRONMENT VARIABLES: None required (uses Prisma and a public JSON feed)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { AlgorithmUpdate } from '@prisma/client';
import type { AlgorithmUpdateInfo } from './types';

// ============================================================================
// VERIFIED FALLBACK FEED
// Every named update on the dashboard's Ranking history from March 2024, with
// begin/end converted from US/Pacific to UTC. Verified 2026-10-16 against
// https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history
// ============================================================================

export const KNOWN_ALGORITHM_UPDATES: AlgorithmUpdateInfo[] = [
  {
    name: 'September 2026 spam update',
    updateType: 'spam',
    announcedAt: new Date('2026-09-24T16:15:00Z'),
    rolloutStart: new Date('2026-09-24T16:15:00Z'),
    rolloutEnd: new Date('2026-10-08T08:00:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of October 8, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu',
  },
  {
    name: 'August 2026 spam update',
    updateType: 'spam',
    announcedAt: new Date('2026-08-18T16:27:00Z'),
    rolloutStart: new Date('2026-08-18T16:27:00Z'),
    rolloutEnd: new Date('2026-08-21T08:49:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of August 21, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/LEubPCm2octf2uMqCFKE',
  },
  {
    name: 'June 2026 spam update',
    updateType: 'spam',
    announcedAt: new Date('2026-06-24T16:00:00Z'),
    rolloutStart: new Date('2026-06-24T16:00:00Z'),
    rolloutEnd: new Date('2026-06-26T17:00:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of June 26, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/YUX1peHev5a4fkxLDiUQ',
  },
  {
    name: 'May 2026 core update',
    updateType: 'core',
    announcedAt: new Date('2026-05-21T15:40:00Z'),
    rolloutStart: new Date('2026-05-21T15:40:00Z'),
    rolloutEnd: new Date('2026-06-02T12:40:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of June 2, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/wdAXJk6LRRihEjpzEeWE',
  },
  {
    name: 'March 2026 core update',
    updateType: 'core',
    announcedAt: new Date('2026-03-27T09:00:00Z'),
    rolloutStart: new Date('2026-03-27T09:00:00Z'),
    rolloutEnd: new Date('2026-04-08T13:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of April 8, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/7eTbAa2jWdToLkraZj5y',
  },
  {
    name: 'March 2026 spam update',
    updateType: 'spam',
    announcedAt: new Date('2026-03-24T19:00:00Z'),
    rolloutStart: new Date('2026-03-24T19:00:00Z'),
    rolloutEnd: new Date('2026-03-25T14:30:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of March 25, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/VbnSXAH4SmEcxPtx4YSD',
  },
  {
    name: 'February 2026 Discover update',
    updateType: 'other',
    announcedAt: new Date('2026-02-05T17:00:00Z'),
    rolloutStart: new Date('2026-02-05T17:00:00Z'),
    rolloutEnd: new Date('2026-02-27T10:00:00Z'),
    impactLevel: 'low',
    description: 'The rollout was complete as of February 27, 2026.',
    sourceUrl:
      'https://status.search.google.com/incidents/mYbNTqV1ytDc2fA8hUz4',
  },
  {
    name: 'December 2025 core update',
    updateType: 'core',
    announcedAt: new Date('2025-12-11T17:25:00Z'),
    rolloutStart: new Date('2025-12-11T17:25:00Z'),
    rolloutEnd: new Date('2025-12-29T19:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of December 29, 2025.',
    sourceUrl:
      'https://status.search.google.com/incidents/DsirqJ1gpPRgVQeccPRv',
  },
  {
    name: 'August 2025 spam update',
    updateType: 'spam',
    announcedAt: new Date('2025-08-26T16:00:00Z'),
    rolloutStart: new Date('2025-08-26T16:00:00Z'),
    rolloutEnd: new Date('2025-09-22T07:00:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of September 22, 2025.',
    sourceUrl:
      'https://status.search.google.com/incidents/a7Aainy6E9rZsmfq82xt',
  },
  {
    name: 'June 2025 core update',
    updateType: 'core',
    announcedAt: new Date('2025-06-30T14:30:00Z'),
    rolloutStart: new Date('2025-06-30T14:30:00Z'),
    rolloutEnd: new Date('2025-07-17T08:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of July 17, 2025.',
    sourceUrl:
      'https://status.search.google.com/incidents/riq1AuqETW46NfBCe5NT',
  },
  {
    name: 'March 2025 core update',
    updateType: 'core',
    announcedAt: new Date('2025-03-13T16:00:00Z'),
    rolloutStart: new Date('2025-03-13T16:00:00Z'),
    rolloutEnd: new Date('2025-03-27T12:35:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of March 27, 2025.',
    sourceUrl:
      'https://status.search.google.com/incidents/zpmwuSwifjDjfrVdaZUx',
  },
  {
    name: 'December 2024 spam update',
    updateType: 'spam',
    announcedAt: new Date('2024-12-19T17:00:00Z'),
    rolloutStart: new Date('2024-12-19T17:00:00Z'),
    rolloutEnd: new Date('2024-12-26T19:00:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of December 26, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/UUq2WSouY7PhSm8zvtD1',
  },
  {
    name: 'December 2024 core update',
    updateType: 'core',
    announcedAt: new Date('2024-12-12T15:30:00Z'),
    rolloutStart: new Date('2024-12-12T15:30:00Z'),
    rolloutEnd: new Date('2024-12-18T19:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of December 18, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/V9nDKuo6nWKh2ThBALgA',
  },
  {
    name: 'November 2024 core update',
    updateType: 'core',
    announcedAt: new Date('2024-11-11T19:00:00Z'),
    rolloutStart: new Date('2024-11-11T19:00:00Z'),
    rolloutEnd: new Date('2024-12-05T08:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of December 5, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/G7rp11wqTaTGn6JjiPF3',
  },
  {
    name: 'August 2024 core update',
    updateType: 'core',
    announcedAt: new Date('2024-08-15T14:58:00Z'),
    rolloutStart: new Date('2024-08-15T14:58:00Z'),
    rolloutEnd: new Date('2024-09-03T19:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of September 3, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/gVx6b2o78zke7GrMidGy',
  },
  {
    name: 'June 2024 spam update',
    updateType: 'spam',
    announcedAt: new Date('2024-06-20T15:12:00Z'),
    rolloutStart: new Date('2024-06-20T15:12:00Z'),
    rolloutEnd: new Date('2024-06-27T16:11:00Z'),
    impactLevel: 'medium',
    description: 'The rollout was complete as of June 27, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/QdUeCQx3LRVbzQ3E7FiD',
  },
  {
    name: 'March 2024 spam update',
    updateType: 'spam',
    announcedAt: new Date('2024-03-05T17:03:00Z'),
    rolloutStart: new Date('2024-03-05T17:03:00Z'),
    rolloutEnd: new Date('2024-03-20T14:09:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of March 20, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/iXz2PJfodvyjaVUeqxZE',
  },
  {
    name: 'March 2024 core update',
    updateType: 'core',
    announcedAt: new Date('2024-03-05T17:02:00Z'),
    rolloutStart: new Date('2024-03-05T17:02:00Z'),
    rolloutEnd: new Date('2024-04-19T17:00:00Z'),
    impactLevel: 'high',
    description: 'The rollout was complete as of April 19, 2024.',
    sourceUrl:
      'https://status.search.google.com/incidents/1jW2F89qC2NxJBWGiKxE',
  },
];

/**
 * Ids written by an earlier hand-made seed list for updates that do not exist on
 * Google's dashboard under those names or dates. Rows already stored with these ids
 * are hidden from every query; they are not deleted.
 */
export const RETRACTED_SEED_IDS = [
  'seed-june-2025-spam-update',
  'seed-august-2025-core-update',
  'seed-november-2025-core-update',
  'seed-december-2025-link-spam-update',
  'seed-february-2026-helpful-content-update',
];

function seedId(name: string): string {
  return `seed-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Upsert one update. A matching row gets Google's name, dates, text and source;
 * its impact level and Sentinel review columns are left as they are.
 */
async function upsertUpdate(
  id: string,
  update: AlgorithmUpdateInfo
): Promise<void> {
  const facts = {
    name: update.name,
    updateType: update.updateType,
    announcedAt: update.announcedAt,
    rolloutStart: update.rolloutStart ?? null,
    rolloutEnd: update.rolloutEnd ?? null,
    description: update.description,
    sourceUrl: update.sourceUrl ?? null,
  };
  await prisma.algorithmUpdate.upsert({
    where: { id },
    update: facts,
    create: { id, ...facts, impactLevel: update.impactLevel },
  });
}

// ============================================================================
// LIVE FEED — Google Search Status Dashboard
// ============================================================================

export const SEARCH_STATUS_FEED_URL =
  'https://status.search.google.com/incidents.json';
const LIVE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LIVE_FETCH_TIMEOUT_MS = 8_000;

export interface AlgorithmFeedStatus {
  source: string;
  /** Result of the most recent attempt in this process. */
  status: 'live' | 'unavailable' | 'not-checked';
  checkedAt: string | null;
  /** Last time the feed was read and stored successfully in this process. */
  lastLiveAt: string | null;
  incidents: number;
  error?: string;
}

interface StatusIncident {
  id?: string;
  begin?: string;
  end?: string | null;
  external_desc?: string;
  service_name?: string;
  uri?: string;
  most_recent_update?: { text?: string };
}

let feedStatus: AlgorithmFeedStatus = {
  source: SEARCH_STATUS_FEED_URL,
  status: 'not-checked',
  checkedAt: null,
  lastLiveAt: null,
  incidents: 0,
};
let lastLiveAttemptMs = 0;

function classifyUpdate(name: string): AlgorithmUpdateInfo['updateType'] {
  const n = name.toLowerCase();
  if (n.includes('link spam')) return 'link-spam';
  if (n.includes('spam')) return 'spam';
  if (n.includes('core')) return 'core';
  if (n.includes('helpful content')) return 'helpful-content';
  if (n.includes('reviews')) return 'product-reviews';
  return 'other';
}

/**
 * Map one dashboard incident to a row. Named ranking updates keep the `seed-<name>`
 * id so they merge with rows written by earlier releases; other incidents
 * (crawling, indexing, serving issues) are keyed by the dashboard's incident id.
 */
export function mapStatusIncident(
  incident: StatusIncident
): { id: string; update: AlgorithmUpdateInfo } | null {
  const name = incident.external_desc?.trim();
  const begin = incident.begin ? new Date(incident.begin) : null;
  if (!incident.id || !name || !begin || Number.isNaN(begin.getTime()))
    return null;

  const end = incident.end ? new Date(incident.end) : null;
  const isNamedRankingUpdate =
    incident.service_name === 'Ranking' && /\bupdate$/i.test(name);
  const updateType =
    incident.service_name === 'Ranking' ? classifyUpdate(name) : 'other';
  const impactLevel =
    updateType === 'core'
      ? 'high'
      : updateType === 'spam' || updateType === 'link-spam'
        ? 'medium'
        : 'low';

  return {
    id: isNamedRankingUpdate ? seedId(name) : `gssd-${incident.id}`,
    update: {
      name,
      updateType,
      announcedAt: begin,
      rolloutStart: begin,
      rolloutEnd: end && !Number.isNaN(end.getTime()) ? end : null,
      impactLevel,
      description: incident.most_recent_update?.text?.trim() || name,
      sourceUrl: `https://status.search.google.com/${incident.uri ?? `incidents/${incident.id}`}`,
    },
  };
}

/**
 * Read the dashboard feed and upsert every incident. Runs at most once per
 * LIVE_SYNC_INTERVAL_MS per process unless forced. Never throws: a failed read
 * returns status 'unavailable' with the error and leaves stored rows untouched.
 */
export async function syncLiveAlgorithmUpdates(
  options: { force?: boolean; fetchImpl?: typeof fetch } = {}
): Promise<AlgorithmFeedStatus> {
  const now = Date.now();
  if (!options.force && now - lastLiveAttemptMs < LIVE_SYNC_INTERVAL_MS) {
    return { ...feedStatus };
  }
  lastLiveAttemptMs = now;
  const checkedAt = new Date(now).toISOString();

  try {
    const res = await (options.fetchImpl ?? fetch)(SEARCH_STATUS_FEED_URL, {
      signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload: unknown = await res.json();
    if (!Array.isArray(payload))
      throw new Error('feed payload is not an array');

    const rows = payload
      .map(incident => mapStatusIncident(incident as StatusIncident))
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (rows.length === 0) throw new Error('feed returned no usable incidents');

    for (const row of rows) {
      await upsertUpdate(row.id, row.update);
    }
    feedStatus = {
      source: SEARCH_STATUS_FEED_URL,
      status: 'live',
      checkedAt,
      lastLiveAt: checkedAt,
      incidents: rows.length,
    };
    logger.info('[AlgorithmFeed] Synced Google Search Status Dashboard', {
      incidents: rows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    feedStatus = {
      ...feedStatus,
      status: 'unavailable',
      checkedAt,
      incidents: 0,
      error: message,
    };
    logger.warn(
      '[AlgorithmFeed] Live feed unavailable — serving stored updates',
      { error: message }
    );
  }
  return { ...feedStatus };
}

export function getAlgorithmFeedStatus(): AlgorithmFeedStatus {
  return { ...feedStatus };
}

// ============================================================================
// SEED FUNCTION
// Writes the verified fallback list once per process, then refreshes from the
// live feed (throttled). Safe to call repeatedly.
// ============================================================================

let seeded = false;

export async function seedAlgorithmUpdates(): Promise<void> {
  if (!seeded) {
    try {
      for (const update of KNOWN_ALGORITHM_UPDATES) {
        await upsertUpdate(seedId(update.name), update);
      }
      seeded = true;
      logger.info('[AlgorithmFeed] Seeded algorithm updates to DB');
    } catch (error) {
      logger.error('[AlgorithmFeed] Failed to seed algorithm updates:', error);
      // Non-fatal — proceed with whatever is in DB
    }
  }
  await syncLiveAlgorithmUpdates();
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Fetch algorithm updates announced within the last N days.
 */
export async function getRecentUpdates(
  days: number = 90
): Promise<AlgorithmUpdate[]> {
  await seedAlgorithmUpdates();

  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.algorithmUpdate.findMany({
    where: {
      id: { notIn: RETRACTED_SEED_IDS },
      announcedAt: { gte: since },
    },
    orderBy: { announcedAt: 'desc' },
  });
}

/**
 * Fetch updates that are currently in active rollout (rolloutEnd null or in the future).
 */
export async function getActiveRollouts(): Promise<AlgorithmUpdate[]> {
  await seedAlgorithmUpdates();
  const now = new Date();

  return prisma.algorithmUpdate.findMany({
    where: {
      id: { notIn: RETRACTED_SEED_IDS },
      rolloutStart: { not: null, lte: now },
      OR: [{ rolloutEnd: null }, { rolloutEnd: { gte: now } }],
    },
    orderBy: { announcedAt: 'desc' },
  });
}

/**
 * Get all algorithm updates (for full timeline view).
 */
export async function getAllUpdates(): Promise<AlgorithmUpdate[]> {
  await seedAlgorithmUpdates();
  return prisma.algorithmUpdate.findMany({
    where: { id: { notIn: RETRACTED_SEED_IDS } },
    orderBy: { announcedAt: 'desc' },
  });
}
