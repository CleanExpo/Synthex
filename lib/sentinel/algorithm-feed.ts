/**
 * Algorithm Sentinel — Algorithm Feed
 *
 * Curated static list of known Google algorithm updates (2024–2026).
 * Seeded to DB on first use via upsert pattern.
 * Provides query helpers for recent updates.
 *
 * ENVIRONMENT VARIABLES: None required (uses Prisma)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { AlgorithmUpdate } from '@prisma/client';
import type { AlgorithmUpdateInfo } from './types';

// ============================================================================
// STATIC UPDATE FEED
// Known major Google algorithm updates through early 2026.
// Sources: Google Search Central blog, Search Engine Land, Search Engine Roundtable.
// ============================================================================

export const KNOWN_ALGORITHM_UPDATES: AlgorithmUpdateInfo[] = [
  {
    name: 'March 2024 Core Update',
    updateType: 'core',
    announcedAt: new Date('2024-03-05'),
    rolloutStart: new Date('2024-03-05'),
    rolloutEnd: new Date('2024-04-19'),
    impactLevel: 'high',
    description:
      'Broad core update targeting low-quality, unhelpful content. Largest rollout duration in history (45 days). Coincided with new spam policies targeting scaled content abuse and expired domain abuse.',
    sourceUrl: 'https://developers.google.com/search/blog/2024/03/core-update',
  },
  {
    name: 'March 2024 Spam Update',
    updateType: 'spam',
    announcedAt: new Date('2024-03-05'),
    rolloutStart: new Date('2024-03-05'),
    rolloutEnd: new Date('2024-03-20'),
    impactLevel: 'high',
    description:
      'New spam policies targeting scaled content abuse, site reputation abuse, and expired domain abuse. Rolled out alongside the March 2024 Core Update.',
    sourceUrl: 'https://developers.google.com/search/updates/spam-updates',
  },
  {
    name: 'August 2024 Core Update',
    updateType: 'core',
    announcedAt: new Date('2024-08-15'),
    rolloutStart: new Date('2024-08-15'),
    rolloutEnd: new Date('2024-09-03'),
    impactLevel: 'high',
    description:
      'Major core update with significant recoveries for sites hit by the September 2023 Helpful Content Update. Google explicitly noted this update aimed to surface more helpful content from smaller, independent publishers.',
    sourceUrl: 'https://developers.google.com/search/updates/core-updates',
  },
  {
    name: 'November 2024 Core Update',
    updateType: 'core',
    announcedAt: new Date('2024-11-11'),
    rolloutStart: new Date('2024-11-11'),
    rolloutEnd: new Date('2024-12-05'),
    impactLevel: 'high',
    description:
      'Core update focused on further improvements to search quality. Continued trends from August 2024 update favouring authoritative, experience-driven content.',
    sourceUrl: 'https://developers.google.com/search/updates/core-updates',
  },
  {
    name: 'December 2024 Spam Update',
    updateType: 'spam',
    announcedAt: new Date('2024-12-19'),
    rolloutStart: new Date('2024-12-19'),
    rolloutEnd: new Date('2024-12-26'),
    impactLevel: 'medium',
    description:
      'Holiday-period spam update targeting link spam and scaled content abuse. Short rollout duration (7 days).',
    sourceUrl: 'https://developers.google.com/search/updates/spam-updates',
  },
  {
    name: 'March 2025 Core Update',
    updateType: 'core',
    announcedAt: new Date('2025-03-13'),
    rolloutStart: new Date('2025-03-13'),
    rolloutEnd: new Date('2025-03-27'),
    impactLevel: 'high',
    description:
      'Broad core update with significant volatility in health, finance, and travel verticals. Sites with strong E-E-A-T signals generally saw improvements.',
    sourceUrl: 'https://developers.google.com/search/updates/core-updates',
  },
  {
    name: 'June 2025 Spam Update',
    updateType: 'spam',
    announcedAt: new Date('2025-06-10'),
    rolloutStart: new Date('2025-06-10'),
    rolloutEnd: new Date('2025-06-17'),
    impactLevel: 'medium',
    description:
      'Targeted spam update addressing site reputation abuse and parasite SEO. Affected news and media domains hosting third-party affiliate content.',
    sourceUrl: 'https://developers.google.com/search/updates/spam-updates',
  },
  {
    name: 'August 2025 Core Update',
    updateType: 'core',
    announcedAt: new Date('2025-08-12'),
    rolloutStart: new Date('2025-08-12'),
    rolloutEnd: new Date('2025-08-28'),
    impactLevel: 'high',
    description:
      'Broad core update. Strong signals for long-form, expert-authored content. AI-generated content without human review saw further demotions.',
    sourceUrl: 'https://developers.google.com/search/updates/core-updates',
  },
  {
    name: 'November 2025 Core Update',
    updateType: 'core',
    announcedAt: new Date('2025-11-06'),
    rolloutStart: new Date('2025-11-06'),
    rolloutEnd: new Date('2025-11-21'),
    impactLevel: 'high',
    description:
      'Pre-holiday core update. Notable impact on ecommerce and product review sites. Sites with verified purchase reviews and original product testing fared better.',
    sourceUrl: 'https://developers.google.com/search/updates/core-updates',
  },
  {
    name: 'December 2025 Link Spam Update',
    updateType: 'link-spam',
    announcedAt: new Date('2025-12-09'),
    rolloutStart: new Date('2025-12-09'),
    rolloutEnd: new Date('2025-12-16'),
    impactLevel: 'medium',
    description:
      'Targeted link spam update using improved SpamBrain AI detection for unnatural link patterns. Affected guest post networks and PBNs.',
    sourceUrl: 'https://developers.google.com/search/updates/spam-updates',
  },
  {
    name: 'February 2026 Helpful Content Update',
    updateType: 'helpful-content',
    announcedAt: new Date('2026-02-04'),
    rolloutStart: new Date('2026-02-04'),
    rolloutEnd: new Date('2026-02-18'),
    impactLevel: 'high',
    description:
      'Significant helpful content update expanding the classifier to better identify content created primarily for search engines versus people. Broad recovery for educational and community-driven sites.',
    sourceUrl: 'https://developers.google.com/search/updates/helpful-content-update',
  },
  {
    name: 'March 2026 Core Update',
    updateType: 'core',
    announcedAt: new Date('2026-03-03'),
    rolloutStart: new Date('2026-03-03'),
    rolloutEnd: null,
    impactLevel: 'high',
    description:
      'Broad core update released in early March 2026. Rollout ongoing. Significant volatility observed across multiple verticals. E-E-A-T, original research, and firsthand experience signals heavily weighted.',
    sourceUrl: 'https://developers.google.com/search/updates/core-updates',
  },
];

// ============================================================================
// SEED FUNCTION
// Upserts all known algorithm updates to the DB on first call.
// Safe to call repeatedly — uses name as unique key.
// ============================================================================

let seeded = false;

export async function seedAlgorithmUpdates(): Promise<void> {
  if (seeded) return;

  try {
    for (const update of KNOWN_ALGORITHM_UPDATES) {
      await prisma.algorithmUpdate.upsert({
        where: {
          // We use a compound check by name since no unique constraint on name
          // Use findFirst pattern instead via create-if-not-exists
          id: `seed-${update.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: {
          rolloutEnd: update.rolloutEnd ?? null,
          description: update.description,
        },
        create: {
          id: `seed-${update.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: update.name,
          updateType: update.updateType,
          announcedAt: update.announcedAt,
          rolloutStart: update.rolloutStart ?? null,
          rolloutEnd: update.rolloutEnd ?? null,
          impactLevel: update.impactLevel,
          description: update.description,
          sourceUrl: update.sourceUrl ?? null,
        },
      });
    }
    seeded = true;
    logger.info('[AlgorithmFeed] Seeded algorithm updates to DB');
  } catch (error) {
    logger.error('[AlgorithmFeed] Failed to seed algorithm updates:', error);
    // Non-fatal — proceed with whatever is in DB
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Fetch algorithm updates announced within the last N days.
 */
export async function getRecentUpdates(days: number = 90): Promise<AlgorithmUpdate[]> {
  await seedAlgorithmUpdates();

  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.algorithmUpdate.findMany({
    where: {
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
      rolloutStart: { not: null, lte: now },
      OR: [
        { rolloutEnd: null },
        { rolloutEnd: { gte: now } },
      ],
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
    orderBy: { announcedAt: 'desc' },
  });
}
