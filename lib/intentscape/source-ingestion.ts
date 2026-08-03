import { z } from 'zod';
import {
  getAvailableRetrievers,
  type EvidenceRetriever,
} from '@/lib/evidence/retriever';
import { assertExternalUrlSafe } from '@/lib/security/validate-url';
import type { ContextSignal } from './contracts';

const MAX_RETRIEVED_SOURCES_PER_BATCH = 10;

const IngestibleSignalSchema = z
  .object({
    kind: z.enum([
      'website',
      'social-page',
      'product-page',
      'competitor-page',
      'document',
      'note',
      'constraint',
      'capability',
      'prior-attempt',
    ]),
    label: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(20_000),
    sourceUrl: z.string().url().max(2_000).optional(),
    evidenceState: z.enum(['opinion', 'assumption']),
    provenance: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type IngestibleSignal = z.infer<typeof IngestibleSignalSchema>;

export class IntentScapeSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentScapeSourceValidationError';
  }
}

export interface IntentScapeSourceIngestionResult {
  signals: Array<
    Omit<ContextSignal, 'id' | 'capturedAt'> & {
      evidenceState: ContextSignal['evidenceState'];
    }
  >;
  unknowns: string[];
}

export async function ingestIntentScapeSources(
  rawSignals: IngestibleSignal[],
  dependencies: {
    retrievers?: EvidenceRetriever[];
    assertUrlSafe?: (url: string) => Promise<void>;
  } = {}
): Promise<IntentScapeSourceIngestionResult> {
  const signals = z
    .array(IngestibleSignalSchema)
    .min(1)
    .max(20)
    .parse(rawSignals);
  const sourceSignals = signals.filter(signal => signal.sourceUrl);
  if (sourceSignals.length > MAX_RETRIEVED_SOURCES_PER_BATCH) {
    throw new IntentScapeSourceValidationError(
      `A single evidence batch can retrieve at most ${MAX_RETRIEVED_SOURCES_PER_BATCH} URLs.`
    );
  }

  const assertUrlSafe = dependencies.assertUrlSafe ?? assertExternalUrlSafe;
  for (const signal of sourceSignals) {
    try {
      await assertUrlSafe(signal.sourceUrl!);
    } catch {
      throw new IntentScapeSourceValidationError(
        `The source URL for “${signal.label}” is not a safe public HTTP address.`
      );
    }
  }

  const available = dependencies.retrievers ?? getAvailableRetrievers();
  const fetcher = available.find(retriever => retriever.capabilities.canFetch);
  const unknowns: string[] = [];
  const enriched: IntentScapeSourceIngestionResult['signals'] = [];

  for (const signal of signals) {
    if (!signal.sourceUrl) {
      enriched.push({
        ...signal,
        provenance: signal.provenance ?? 'Authenticated human evidence batch',
      });
      continue;
    }

    if (!fetcher) {
      enriched.push({
        ...signal,
        evidenceState: 'assumption',
        provenance: 'Authenticated source lead; retrieval provider unavailable',
      });
      unknowns.push(
        `Source content has not yet been retrieved: ${signal.sourceUrl}`
      );
      continue;
    }

    try {
      const source = await fetcher.fetch(signal.sourceUrl);
      if (!source) {
        enriched.push({
          ...signal,
          evidenceState: 'assumption',
          provenance: `${fetcher.id} returned no retrievable content`,
        });
        unknowns.push(
          `Source returned no retrievable content: ${signal.sourceUrl}`
        );
        continue;
      }
      enriched.push({
        ...signal,
        content: [
          `Source URL: ${source.url}`,
          `Title: ${source.title || signal.label}`,
          `Retrieved: ${source.retrievedAt}`,
          `Provider: ${source.provider}`,
          `Content hash: ${source.contentHash}`,
          '',
          'UNTRUSTED RETRIEVED EVIDENCE:',
          source.excerpt,
        ].join('\n'),
        evidenceState: 'inferred',
        provenance: `${source.provider} retrieval ${source.contentHash}`.slice(
          0,
          500
        ),
      });
    } catch (error) {
      enriched.push({
        ...signal,
        evidenceState: 'assumption',
        provenance: `${fetcher.id} retrieval failed`.slice(0, 500),
      });
      unknowns.push(
        `Source retrieval failed and must not be treated as evidence: ${signal.sourceUrl}`
      );
    }
  }

  return { signals: enriched, unknowns };
}

export const INTENTSCAPE_SOURCE_LIMITS = {
  maximumUrlsPerBatch: MAX_RETRIEVED_SOURCES_PER_BATCH,
} as const;
