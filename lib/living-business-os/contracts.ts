/**
 * SYN-1316 Living Business OS: internal contracts, not a second database.
 * Boundaries: Unite Group owns order/billing; Synthex owns authorised
 * fulfilment and drafts. These shapes are intentionally provider-neutral.
 */
import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);
const evidenceKinds = [
  'owned_analytics',
  'crm',
  'card',
  'phone',
  'search_console',
  'competitor_estimate',
  'owner_answer',
  'research',
] as const;
const dataClasses = [
  'public',
  'owned',
  'client_approved',
  'estimated',
] as const;
type EvidenceKind = (typeof evidenceKinds)[number];
type DataClass = (typeof dataClasses)[number];

/**
 * Provenance: which data classes each evidence kind may honestly carry. A
 * competitor estimate is always an estimate and research is never the
 * tenant's own data, so a label cannot promote either past the estimate gate.
 */
export const ALLOWED_DATA_CLASSES: Readonly<
  Record<EvidenceKind, readonly DataClass[]>
> = {
  owned_analytics: ['owned'],
  crm: ['owned', 'client_approved'],
  card: ['owned'],
  phone: ['owned', 'client_approved'],
  search_console: ['owned'],
  competitor_estimate: ['estimated'],
  owner_answer: ['client_approved', 'owned'],
  research: ['public', 'estimated'],
};
const PRIVATE_DATA_CLASSES: readonly DataClass[] = ['owned', 'client_approved'];

const sourceRef = z
  .object({
    id: nonEmpty,
    kind: z.enum(evidenceKinds),
    capturedAt: z.string().datetime({ offset: true }),
    dataClass: z.enum(dataClasses),
    /** Required for private (owned / client_approved) evidence; tenant-scoped. */
    organizationId: nonEmpty.optional(),
    sourceUrl: z.string().url().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!ALLOWED_DATA_CLASSES[v.kind].includes(v.dataClass)) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataClass'],
        message: `Evidence kind ${v.kind} cannot carry data class ${v.dataClass} (provenance mismatch)`,
      });
    }
    if (PRIVATE_DATA_CLASSES.includes(v.dataClass) && !v.organizationId) {
      ctx.addIssue({
        code: 'custom',
        path: ['organizationId'],
        message:
          'Private evidence (owned or client_approved) must name its organisation',
      });
    }
  });
type SourceRef = z.infer<typeof sourceRef>;

/** Every evidence reference that names an organisation must name this one. */
function refuseForeignEvidence(
  organizationId: string,
  refs: { ref: SourceRef; path: (string | number)[] }[],
  ctx: z.RefinementCtx
): void {
  for (const { ref, path } of refs) {
    if (
      ref.organizationId !== undefined &&
      ref.organizationId !== organizationId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'organizationId'],
        message:
          'Evidence belongs to another tenant; cross-tenant references are refused',
      });
    }
  }
}

export const businessIntentSchema = z
  .object({
    organizationId: nonEmpty,
    businessName: nonEmpty,
    goals: z.array(nonEmpty).min(1).max(10),
    serviceIds: z.array(nonEmpty).min(1),
    capacity: z
      .object({
        availableJobsPerWeek: z.number().int().nonnegative().nullable(),
        bookedJobsPerWeek: z.number().int().nonnegative().nullable(),
        updatedAt: z.string().datetime({ offset: true }).nullable(),
      })
      .strict(),
    constraints: z
      .object({
        preferredServices: z.array(nonEmpty).default([]),
        excludedClaims: z.array(nonEmpty).default([]),
        maximumMonthlyAutomationCostAud: z.number().finite().nonnegative(),
        publishing: z.literal('approval_required'),
        customerDataReuse: z.literal('tenant_only'),
      })
      .strict(),
  })
  .strict();
export type BusinessIntent = z.infer<typeof businessIntentSchema>;

export const opportunitySignalSchema = z
  .object({
    id: nonEmpty,
    organizationId: nonEmpty,
    serviceId: nonEmpty,
    title: nonEmpty,
    evidence: z.array(sourceRef).min(1),
    confidence: z.number().finite().min(0).max(1),
    risk: z.number().finite().min(0).max(1),
    expectedGrossProfitAud: z.number().finite().nonnegative(),
    estimatedInterventionCostAud: z.number().finite().nonnegative(),
    expectedAdditionalJobsPerWeek: z.number().finite().nonnegative(),
    outcomeMetric: nonEmpty,
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((v, ctx) =>
    refuseForeignEvidence(
      v.organizationId,
      v.evidence.map((ref, i) => ({ ref, path: ['evidence', i] })),
      ctx
    )
  );
export type OpportunitySignal = z.infer<typeof opportunitySignalSchema>;

export const fulfilmentRequestSchema = z
  .object({
    sourceSystem: z.literal('unite_group'),
    schemaVersion: z.literal(1),
    externalOrderId: nonEmpty,
    organizationId: nonEmpty,
    approvedPackageId: nonEmpty,
    /** Created by server-side order verification; never trust browser claims. */
    authorisationReceiptId: nonEmpty,
    requestedAssets: z
      .array(z.enum(['website', 'crm', 'living_card', 'owner_dashboard']))
      .min(1),
    issuedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type FulfilmentRequest = z.infer<typeof fulfilmentRequestSchema>;
/** Deterministic idempotency scope: prevent cross-client order collisions. */
export function fulfilmentIdempotencyKey(request: FulfilmentRequest): string {
  const parsed = fulfilmentRequestSchema.parse(request);
  return [parsed.sourceSystem, parsed.organizationId, parsed.externalOrderId]
    .map(encodeURIComponent)
    .join(':');
}

/**
 * Customer enquiries require separate consent and identity checks.
 * Anonymous card attention is NOT a CRM contact nor marketing consent.
 */
export const customerInteractionSchema = z
  .object({
    organizationId: nonEmpty,
    interactionId: nonEmpty,
    channel: z.enum(['website', 'living_card', 'phone', 'crm']),
    eventType: z.enum([
      'service_interest',
      'enquiry',
      'booking',
      'sale',
      'repeat_sale',
    ]),
    serviceId: nonEmpty,
    happenedAt: z.string().datetime({ offset: true }),
    pseudonymousSessionId: nonEmpty.optional(),
    crmContactId: nonEmpty.optional(),
    marketingConsent: z.boolean().default(false),
    marketingConsentReceiptId: nonEmpty.optional(),
    source: sourceRef,
  })
  .strict()
  .superRefine((v, ctx) => {
    refuseForeignEvidence(
      v.organizationId,
      [{ ref: v.source, path: ['source'] }],
      ctx
    );
    if (v.eventType !== 'service_interest' && !v.crmContactId) {
      ctx.addIssue({
        code: 'custom',
        path: ['crmContactId'],
        message:
          'Personalised lifecycle actions need a linked, authorised CRM contact',
      });
    }
    if (
      v.marketingConsent &&
      (!v.crmContactId || !v.marketingConsentReceiptId)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingConsent'],
        message:
          'Direct marketing requires a verified contact and a separate consent receipt; event data alone is not proof',
      });
    }
    if (!v.marketingConsent && v.marketingConsentReceiptId) {
      ctx.addIssue({
        code: 'custom',
        path: ['marketingConsentReceiptId'],
        message:
          'Consent receipt cannot be attached to a non-consenting interaction',
      });
    }
  });
export type CustomerInteraction = z.infer<typeof customerInteractionSchema>;
