/**
 * NRPG → DR pipeline boot wiring.
 *
 * Subscribes the integration handler at server startup. Idempotent —
 * second call is a no-op. Feature-flagged behind
 * DR_NRPG_PIPELINE_ENABLED so deploys can land before the operator
 * provisions credentials.
 *
 * Called from instrumentation.ts (Next.js server-startup hook).
 *
 * @see SYN-834 (epic — Track 2 ship-now)
 */

import { logger } from '@/lib/logger';
import { subscribeNrpgPipeline } from '@/lib/nrpg-pipeline';
import {
  loadCurrentSitemapXmlFromDrRepo,
  saveLandingPageToDrRepo,
  saveSitemapXmlToDrRepo,
} from '@/lib/dr-repo-writer';
import type { BrandIdentity } from '@/lib/landing-page';

const DR_BRAND: BrandIdentity = {
  name: 'Disaster Recovery',
  legalName: 'Disaster Recovery Pty Ltd',
  url: 'https://disasterrecovery.com.au',
  logoUrl: 'https://disasterrecovery.com.au/logo.png',
  // TODO: confirm with Phill — current placeholder is the public DR landline.
  telephone: '+61730000000',
  hq: { lat: -27.4698, lng: 153.0251, addressLocality: 'Brisbane' },
};

let unsubscribe: (() => void) | null = null;

/**
 * Subscribe the NRPG → DR handler. Idempotent.
 */
export function bootstrapNrpgPipeline(): void {
  if (unsubscribe) return;

  if (process.env.DR_NRPG_PIPELINE_ENABLED !== 'true') {
    logger.info('[nrpg-pipeline] disabled (DR_NRPG_PIPELINE_ENABLED !== true)');
    return;
  }

  if (!process.env.DR_GBP_LOCATION_ID || !process.env.DR_BING_PLACES_STORE_ID) {
    logger.warn(
      '[nrpg-pipeline] subscribed with missing GBP/Bing IDs — those stages will fail per-stage (expected pre-cutover)',
      {
        hasGbpLocationId: Boolean(process.env.DR_GBP_LOCATION_ID),
        hasBingStoreId: Boolean(process.env.DR_BING_PLACES_STORE_ID),
      }
    );
  }

  unsubscribe = subscribeNrpgPipeline({
    brand: DR_BRAND,
    gbpLocationId: process.env.DR_GBP_LOCATION_ID ?? 'locations/UNSET',
    bingStoreId: process.env.DR_BING_PLACES_STORE_ID ?? 'store_UNSET',
    loadCurrentSitemapXml: () => loadCurrentSitemapXmlFromDrRepo(),
    saveSitemapXml: xml => saveSitemapXmlToDrRepo(xml).then(() => undefined),
    saveLandingPage: page =>
      saveLandingPageToDrRepo(page).then(() => undefined),
  });
  logger.info('[nrpg-pipeline] subscribed');
}

/** Test-only — unsubscribe + reset module state. */
export function _unsubscribeNrpgPipelineForTests(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
