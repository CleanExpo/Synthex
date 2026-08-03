import { z } from 'zod';
import type { ContextSignal } from './contracts';

export const ClientLabelDimensionSchema = z.enum([
  'source',
  'workflow',
  'audience',
  'offer',
  'evidence',
  'goal',
  'channel',
  'risk',
]);

export const ClientAutoLabelSchema = z
  .object({
    labelId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9_-]+$/),
    label: z.string().trim().min(1).max(120),
    dimension: ClientLabelDimensionSchema,
    confidence: z.number().min(0).max(1),
    status: z.enum(['applied', 'check']),
    reason: z.string().trim().min(1).max(240),
    policyName: z.string().trim().min(1).max(120),
    policyVersion: z.number().int().positive(),
    routeTo: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();

export type ClientAutoLabel = z.infer<typeof ClientAutoLabelSchema>;

const SignalKinds = z.enum([
  'website',
  'social-page',
  'product-page',
  'competitor-page',
  'document',
  'note',
  'constraint',
  'capability',
  'prior-attempt',
]);

const ClientLabelDefinitionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().trim().min(1).max(120),
    dimension: ClientLabelDimensionSchema,
    description: z.string().trim().max(240).optional(),
    matchAny: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
    sourceKinds: z.array(SignalKinds).max(10).default([]),
    routeTo: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    requiresReview: z.boolean().default(false),
  })
  .strict()
  .refine(label => label.matchAny.length > 0 || label.sourceKinds.length > 0, {
    message: 'A client label needs match text or a source kind.',
  });

export const ClientLabelPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    version: z.number().int().positive(),
    autoApplyThreshold: z.number().min(0.5).max(1).default(0.8),
    suggestThreshold: z.number().min(0.2).max(0.95).default(0.55),
    labels: z.array(ClientLabelDefinitionSchema).min(1).max(100),
  })
  .strict()
  .refine(policy => policy.suggestThreshold < policy.autoApplyThreshold, {
    message: 'The suggestion threshold must be below the auto-apply threshold.',
  });

export type ClientLabelPolicy = z.infer<typeof ClientLabelPolicySchema>;

interface ClientLabelPolicyInput {
  organizationId: string;
  clientName: string;
  industry?: string | null;
  organizationSettings?: unknown;
  clientProfile?: {
    icp?: unknown;
    offers?: unknown;
    proofPoints?: unknown;
    competitors?: unknown;
    goals?: unknown;
    channels?: unknown;
    constraints?: unknown;
  } | null;
  operatingSystem?: {
    method?: string | null;
    version?: number | null;
    outputStructure?: unknown;
  } | null;
}

type LabelDefinition = z.infer<typeof ClientLabelDefinitionSchema>;
type LabelSignal = Pick<
  ContextSignal,
  'kind' | 'label' | 'content' | 'sourceUrl'
>;

const SOURCE_LABELS: LabelDefinition[] = [
  {
    id: 'source-website',
    name: 'Website',
    dimension: 'source',
    matchAny: [],
    sourceKinds: ['website', 'product-page'],
    requiresReview: false,
    routeTo: 'source-review',
  },
  {
    id: 'source-social',
    name: 'Social channel',
    dimension: 'source',
    matchAny: [],
    sourceKinds: ['social-page'],
    requiresReview: false,
    routeTo: 'channel-review',
  },
  {
    id: 'source-reference',
    name: 'Reference',
    dimension: 'source',
    matchAny: [],
    sourceKinds: ['document'],
    requiresReview: false,
    routeTo: 'evidence-review',
  },
  {
    id: 'source-context',
    name: 'Client context',
    dimension: 'source',
    matchAny: [],
    sourceKinds: ['note', 'prior-attempt'],
    requiresReview: false,
    routeTo: 'context-review',
  },
  {
    id: 'source-constraint',
    name: 'Constraint',
    dimension: 'risk',
    matchAny: [],
    sourceKinds: ['constraint'],
    requiresReview: true,
    routeTo: 'risk-review',
  },
];

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function nestedStrings(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(stringArray);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 72) || 'label'
  );
}

function shortLabel(prefix: string, value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  const available = 116 - prefix.length;
  return `${prefix}${compact.slice(0, available)}`;
}

function definitions(
  dimension: ClientAutoLabel['dimension'],
  prefix: string,
  values: string[],
  options: { routeTo?: string; requiresReview?: boolean } = {}
): LabelDefinition[] {
  const slugCounts = new Map<string, number>();
  return values.slice(0, 20).map(value => {
    const baseId = `${dimension}-${slug(value)}`;
    const collisionIndex = slugCounts.get(baseId) ?? 0;
    slugCounts.set(baseId, collisionIndex + 1);
    return {
      id: collisionIndex === 0 ? baseId : `${baseId}-${collisionIndex}`,
      name: shortLabel(prefix, value),
      dimension,
      matchAny: [value],
      sourceKinds: [],
      routeTo: options.routeTo,
      requiresReview: options.requiresReview ?? false,
    };
  });
}

function configuredPolicy(settings: unknown): ClientLabelPolicy | null {
  if (!settings || typeof settings !== 'object') return null;
  const candidate = (settings as Record<string, unknown>).autoLabelPipeline;
  const parsed = ClientLabelPolicySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function buildClientLabelPolicy(
  input: ClientLabelPolicyInput
): ClientLabelPolicy {
  const custom = configuredPolicy(input.organizationSettings);
  if (custom) {
    return ClientLabelPolicySchema.parse({
      ...custom,
      labels: [...SOURCE_LABELS, ...custom.labels]
        .filter(
          (label, index, labels) =>
            labels.findIndex(candidate => candidate.id === label.id) === index
        )
        .slice(0, 100),
    });
  }

  const icp =
    input.clientProfile?.icp && typeof input.clientProfile.icp === 'object'
      ? (input.clientProfile.icp as Record<string, unknown>)
      : {};
  const outputStructure =
    input.operatingSystem?.outputStructure &&
    typeof input.operatingSystem.outputStructure === 'object'
      ? (input.operatingSystem.outputStructure as Record<string, unknown>)
      : {};
  const method = input.operatingSystem?.method?.trim();
  const clientName = input.clientName.trim() || 'Client';
  const policyName = (
    method ? `${clientName} · ${method}` : `${clientName} workflow`
  ).slice(0, 120);
  const labels = [
    ...SOURCE_LABELS,
    ...definitions('audience', 'Audience · ', stringArray(icp.segments), {
      routeTo: 'audience-review',
    }),
    ...definitions('audience', 'Client need · ', stringArray(icp.painPoints), {
      routeTo: 'customer-insight',
    }),
    ...definitions(
      'offer',
      'Offer · ',
      stringArray(input.clientProfile?.offers),
      { routeTo: 'offer-review' }
    ),
    ...definitions(
      'evidence',
      'Proof · ',
      stringArray(input.clientProfile?.proofPoints),
      { routeTo: 'proof-review' }
    ),
    ...definitions(
      'evidence',
      'Competitor · ',
      stringArray(input.clientProfile?.competitors),
      { routeTo: 'market-review' }
    ),
    ...definitions('goal', 'Goal · ', stringArray(input.clientProfile?.goals), {
      routeTo: 'goal-review',
      requiresReview: true,
    }),
    ...definitions(
      'channel',
      'Channel · ',
      stringArray(input.clientProfile?.channels),
      { routeTo: 'channel-review' }
    ),
    ...definitions(
      'risk',
      'Rule · ',
      nestedStrings(input.clientProfile?.constraints),
      { routeTo: 'risk-review', requiresReview: true }
    ),
    ...definitions(
      'workflow',
      'Stage · ',
      stringArray(outputStructure.sections),
      { routeTo: 'workflow-stage' }
    ),
    ...(input.industry
      ? definitions('workflow', 'Industry · ', [input.industry], {
          routeTo: 'industry-review',
        })
      : []),
  ].filter(
    (label, index, candidates) =>
      candidates.findIndex(candidate => candidate.id === label.id) === index
  );

  return ClientLabelPolicySchema.parse({
    name: policyName,
    version: Math.max(1, input.operatingSystem?.version ?? 1),
    autoApplyThreshold: 0.8,
    suggestThreshold: 0.55,
    labels,
  });
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize('NFKD')
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2)
  );
}

function phraseScore(haystack: string, phrase: string): number {
  const normalisedPhrase = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalisedPhrase) return 0;
  if (haystack.includes(normalisedPhrase)) return 0.94;
  const phraseTokens = tokens(normalisedPhrase);
  if (!phraseTokens.size) return 0;
  const inputTokens = tokens(haystack);
  const matched = [...phraseTokens].filter(token => inputTokens.has(token));
  const overlap = matched.length / phraseTokens.size;
  if (overlap >= 0.75) return 0.84;
  if (overlap >= 0.5) return 0.68;
  if (overlap >= 0.34 && matched.length >= 2) return 0.56;
  return 0;
}

function scoreLabel(
  signal: LabelSignal,
  definition: LabelDefinition
): { score: number; reason: string } {
  if (definition.sourceKinds.some(kind => kind === signal.kind)) {
    return {
      score: 0.99,
      reason: `Matched source type “${signal.kind.replace('-', ' ')}”.`,
    };
  }
  const searchable = [signal.label, signal.content, signal.sourceUrl]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  let best = { score: 0, phrase: '' };
  for (const phrase of definition.matchAny) {
    const score = phraseScore(searchable, phrase);
    if (score > best.score) best = { score, phrase };
  }
  return {
    score: best.score,
    reason: best.phrase
      ? `Matched client workflow term “${best.phrase.slice(0, 120)}”.`
      : 'No client workflow term matched.',
  };
}

export function applyClientAutoLabels(
  signal: LabelSignal,
  rawPolicy: ClientLabelPolicy
): ClientAutoLabel[] {
  const policy = ClientLabelPolicySchema.parse(rawPolicy);
  const candidates = policy.labels
    .map(definition => ({ definition, ...scoreLabel(signal, definition) }))
    .filter(candidate => candidate.score >= policy.suggestThreshold)
    .sort((a, b) => b.score - a.score);
  const bestPerDimension = new Map<
    ClientAutoLabel['dimension'],
    (typeof candidates)[number]
  >();
  for (const candidate of candidates) {
    if (!bestPerDimension.has(candidate.definition.dimension)) {
      bestPerDimension.set(candidate.definition.dimension, candidate);
    }
  }
  return [...bestPerDimension.values()].slice(0, 5).map(candidate =>
    ClientAutoLabelSchema.parse({
      labelId: candidate.definition.id,
      label: candidate.definition.name,
      dimension: candidate.definition.dimension,
      confidence: Number(candidate.score.toFixed(2)),
      status:
        candidate.score >= policy.autoApplyThreshold &&
        !candidate.definition.requiresReview
          ? 'applied'
          : 'check',
      reason: candidate.reason,
      policyName: policy.name,
      policyVersion: policy.version,
      routeTo: candidate.definition.routeTo,
    })
  );
}
