/**
 * Kit library schemas (spec: docs/superpowers/specs/2026-10-22-kit-library-design.md).
 *
 * A Kit is one repeatable client job done once properly. A ClientManifest holds
 * the per-client facts every kit reads. Both are validated here so the
 * catalogue and the manifests cannot silently rot
 * (tests/unit/kits/catalogue.test.ts).
 *
 * Honest-status rule: a manifest fact the repo does not hold is `null` and is
 * named in `unknown`; it is never guessed.
 */
import { z } from 'zod';

const text = z.string().trim().min(1);

/**
 * Repo-relative path: no leading slash, no backslash, no `..` segment (either
 * would let the existence check pass on a file outside the checkout), no glob,
 * no `:line` suffix.
 */
const repoPath = text.refine(
  p =>
    !p.startsWith('/') &&
    !p.includes('\\') &&
    !p.split('/').includes('..') &&
    !p.includes('*') &&
    !/:\d/.test(p),
  {
    message:
      'path must be repo-relative, without globs, backslashes, ".." segments or :line suffixes',
  }
);

/** DD/MM/YYYY (AU date convention). */
const auDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/);

export const CLIENT_METRICS = [
  'carsi_enrolments',
  'ra_trial_signups',
  'both',
  'none: internal plumbing',
] as const;
export const ClientMetric = z.enum(CLIENT_METRICS);

export const ARTEFACT_KINDS = ['in-repo', 'in-skills', 'missing'] as const;

/** Built and tracked in this repo. `testPath` names a test that exercises it, or null when none was established. */
export const InRepoArtefact = z.strictObject({
  kind: z.literal('in-repo'),
  path: repoPath,
  what: text,
  wired: z.boolean(),
  testPath: repoPath.nullable(),
  note: text.optional(),
});

/** Built as a Claude Code skill under ~/.claude/skills/; must be ported to serve the product. */
export const InSkillsArtefact = z.strictObject({
  kind: z.literal('in-skills'),
  path: repoPath,
  what: text,
  port: text,
});

export const MissingSource = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('open-source'),
    repo: text,
    licence: text,
  }),
  z.strictObject({
    type: z.literal('build-in-house'),
    reason: text,
  }),
]);

/** Not built anywhere yet. */
export const MissingArtefact = z.strictObject({
  kind: z.literal('missing'),
  what: text,
  source: MissingSource,
});

export const Artefact = z.discriminatedUnion('kind', [
  InRepoArtefact,
  InSkillsArtefact,
  MissingArtefact,
]);

export const Verifier = z.strictObject({
  status: z.enum(['exists', 'to-build']),
  description: text,
  path: repoPath.nullable(),
});

export const Estimate = z
  .strictObject({
    low: z.number().nonnegative(),
    high: z.number().nonnegative(),
    basis: z.enum(['estimate', 'measured']),
    note: text,
  })
  .refine(e => e.low <= e.high, { message: 'low must not exceed high' });

/** Founder rule 22/10/2026: at most US$12 direct spend per client build. */
export const BUILD_COST_CEILING_USD = 12;

export const CostEstimate = z.strictObject({
  usd: z.number().nonnegative().max(BUILD_COST_CEILING_USD),
  basis: z.enum(['estimate', 'measured']),
  note: text,
});

const MANIFEST_FIELDS = [
  'slug',
  'displayName',
  'legalName',
  'brandConfigSlug',
  'clientMetric',
  'domains',
  'gbpLocationId',
  'bingPlacesId',
  'nap',
  'connectedPlatforms',
  'claimsFile',
  'compliance',
  'onboardingAuthority',
  'hosting',
  'costCeilingUsd',
] as const;
export const ManifestField = z.enum(MANIFEST_FIELDS);

export const Kit = z.strictObject({
  id: z.string().regex(/^(K\d{1,2}|M)$/),
  name: text,
  outcome: text,
  clientMetric: ClientMetric,
  inputs: z.array(ManifestField).min(1),
  artefacts: z.array(Artefact).min(1),
  verifier: Verifier,
  compliance: z.array(text).min(1),
  founderGates: z.array(text).min(1),
  minutesSavedPerJob: Estimate,
  maxDirectCostUsd: CostEstimate,
  readiness: z.enum(['ready', 'partial', 'missing']),
});
export type Kit = z.infer<typeof Kit>;

/** A fact plus where in the repo (or which decision) it came from. */
const sourced = <T extends z.ZodTypeAny>(value: T) =>
  z.strictObject({ value, source: text });

export const ComplianceFlag = z.strictObject({
  id: text,
  value: z.union([z.boolean(), text]).nullable(),
  source: text.nullable(),
  note: text,
});

export const OAuthGrant = z.strictObject({
  provider: text,
  scope: text,
  grantedBy: text,
  grantedOn: auDate,
});

export const HOSTING_PROVIDERS = ['digitalocean', 'vercel', 'other'] as const;

export const ClientManifest = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    displayName: sourced(text),
    legalName: sourced(text).nullable(),
    brandConfigSlug: sourced(text).nullable(),
    clientMetric: ClientMetric,
    domains: sourced(z.array(z.url()).min(1)).nullable(),
    gbpLocationId: sourced(text).nullable(),
    bingPlacesId: sourced(text).nullable(),
    nap: sourced(
      z.strictObject({ name: text, address: text, phone: text })
    ).nullable(),
    connectedPlatforms: sourced(z.array(text)).nullable(),
    claimsFile: sourced(repoPath).nullable(),
    compliance: z.array(ComplianceFlag),
    /** Scopes the client must grant at onboarding (founder decision 22/10/2026); grants stay null until given. */
    onboardingAuthority: z.strictObject({
      scopesRequired: z.array(text).min(1),
      grants: z.array(OAuthGrant).nullable(),
    }),
    /** Where the client site runs. Synthex never writes to the host; it opens a PR on sourceRepo and the host builds deployBranch on merge. */
    hosting: z.strictObject({
      provider: z.enum(HOSTING_PROVIDERS).nullable(),
      appName: text.nullable(),
      appId: text.nullable(),
      region: text.nullable(),
      domains: z.array(text).nullable(),
      sourceRepo: z
        .string()
        .regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/)
        .nullable(),
      deployBranch: text.nullable(),
      source: text.nullable(),
    }),
    costCeilingUsd: z.number().positive().max(BUILD_COST_CEILING_USD),
    unknown: z.array(text),
  })
  .superRefine((m, ctx) => {
    // Every null fact must be declared unknown, and every unknown must name a real gap.
    const nulls = new Set<string>();
    for (const [k, v] of Object.entries(m)) if (v === null) nulls.add(k);
    if (m.onboardingAuthority.grants === null)
      nulls.add('onboardingAuthority.grants');
    for (const [k, v] of Object.entries(m.hosting))
      if (v === null) nulls.add(`hosting.${k}`);
    for (const f of m.compliance)
      if (f.value === null) nulls.add(`compliance.${f.id}`);
    for (const n of nulls)
      if (!m.unknown.includes(n))
        ctx.addIssue({
          code: 'custom',
          message: `${n} is null but not listed in unknown`,
        });
    for (const u of m.unknown)
      if (!nulls.has(u))
        ctx.addIssue({
          code: 'custom',
          message: `unknown lists ${u} but it is not null`,
        });
  });
export type ClientManifest = z.infer<typeof ClientManifest>;
