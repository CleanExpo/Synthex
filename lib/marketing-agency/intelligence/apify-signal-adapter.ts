import type {
  ApifyCreativeRecord,
  ApifyResearchPlatform,
} from '../research/apify-intelligence';
import type { GovernedSignal, SignalSourceKind } from './signal-ledger';

export interface ApifySignalContext {
  business: string;
  client: string;
  product: string;
  audienceSegment: string;
  narrative: string;
  capturedAt: string;
  evidenceRefs: string[];
}

const PLATFORM_SOURCE_KIND: Record<ApifyResearchPlatform, SignalSourceKind> = {
  google: 'search',
  linkedin: 'social',
  facebook: 'social',
  instagram: 'social',
  tiktok: 'social',
};

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

function metricStrength(record: ApifyCreativeRecord): number {
  const metrics = [
    record.impressions,
    record.views,
    record.averageWatchTimeSec,
    record.durationSec,
    record.likes,
    record.comments,
    record.shares,
    record.saves,
    record.engagement,
  ].filter((value): value is number => typeof value === 'number' && value > 0);

  return clamp(metrics.length / 5);
}

function contentStrength(record: ApifyCreativeRecord): number {
  const contentLength = record.content.trim().length;
  if (contentLength >= 80) return 1;
  if (contentLength >= 32) return 0.75;
  if (contentLength > 0) return 0.45;
  return 0.1;
}

function freshnessFromPostedAt(postedAt?: string): number {
  if (!postedAt) return 0.65;

  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp)) return 0.65;

  const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.85;
  if (ageDays <= 180) return 0.65;
  if (ageDays <= 365) return 0.45;
  return 0.25;
}

function creativePotential(record: ApifyCreativeRecord): number {
  const engagementSignal = record.engagement > 0 ? 0.25 : 0;
  const watchSignal =
    record.averageWatchTimeSec !== undefined || record.durationSec !== undefined ? 0.2 : 0;
  const metricSignal = metricStrength(record) * 0.35;
  const contentSignal = contentStrength(record) * 0.2;

  return clamp(engagementSignal + watchSignal + metricSignal + contentSignal);
}

function confidence(record: ApifyCreativeRecord): number {
  const sourceSignal = record.sourceUrl ? 0.25 : 0;
  const contentSignal = contentStrength(record) * 0.3;
  const metricSignal = metricStrength(record) * 0.3;
  const authorSignal = record.author ? 0.1 : 0;
  const dateSignal = record.postedAt ? 0.05 : 0;

  return clamp(sourceSignal + contentSignal + metricSignal + authorSignal + dateSignal);
}

function risk(record: ApifyCreativeRecord): number {
  const missingSourceRisk = record.sourceUrl ? 0 : 0.35;
  const missingContentRisk = record.content.trim() ? 0 : 0.25;
  const weakMetricRisk = metricStrength(record) >= 0.2 ? 0 : 0.15;
  const platformRisk = record.platform === 'google' ? 0.05 : 0.12;

  return clamp(missingSourceRisk + missingContentRisk + weakMetricRisk + platformRisk);
}

function recordDiscriminator(record: ApifyCreativeRecord, index: number): string {
  const recordStem = slug([record.sourceUrl, record.author, record.postedAt].filter(Boolean).join('-'));
  return recordStem ? `${recordStem}-${index}` : String(index);
}

export function mapApifyRecordToGovernedSignal(
  record: ApifyCreativeRecord,
  context: ApifySignalContext,
  index = 0
): GovernedSignal {
  const discriminator = recordDiscriminator(record, index);
  const sourceBase = slug(record.sourceUrl ?? record.author ?? 'record') || 'record';
  const signalBase = slug(record.content || record.sourceUrl || record.author || 'record') || 'record';
  const sourceId = `source-apify-${record.platform}-${sourceBase}-${discriminator}`;
  const signalId = `signal-apify-${record.platform}-${signalBase}-${discriminator}`;

  return {
    id: signalId,
    source: {
      id: sourceId,
      kind: PLATFORM_SOURCE_KIND[record.platform],
      label: `Apify ${record.platform} intelligence`,
      sourceUrl: record.sourceUrl,
      capturedAt: context.capturedAt,
      permissionContext: 'public',
    },
    capturedAt: context.capturedAt,
    business: context.business,
    client: context.client,
    product: context.product,
    audienceSegment: context.audienceSegment,
    narrative: context.narrative,
    content: record.content || `${record.platform} signal with metrics but no extracted post text.`,
    freshness: freshnessFromPostedAt(record.postedAt),
    confidence: confidence(record),
    commercialImpact: clamp(metricStrength(record) * 0.5 + confidence(record) * 0.5),
    creativePotential: creativePotential(record),
    risk: risk(record),
    status: 'captured',
    evidenceRefs: context.evidenceRefs,
  };
}

export function mapApifyRecordsToGovernedSignals(
  records: ApifyCreativeRecord[],
  context: ApifySignalContext
): GovernedSignal[] {
  return records.map((record, index) =>
    mapApifyRecordToGovernedSignal(record, context, index)
  );
}
