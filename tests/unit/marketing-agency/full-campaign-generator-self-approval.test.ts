/**
 * Gruen Standard v1.1, Phase 0.1 — hard fail `hf-approval`.
 *
 * The campaign generator used to stamp its own output as human-approved:
 *
 *     approval: {
 *       status: 'approved',
 *       humanApproved: true,
 *       approvedBy: 'Codex execution agent',
 *       approvedAt: input.generatedAt,
 *     },
 *     evaluation: { evidenceQuality: 86, accuracy: 86, ... }
 *
 * That handed the authority gate a pre-satisfied token: a human approval that
 * no human gave, plus nine scores the generator awarded itself.
 *
 * These tests exist to go RED if that block is ever restored. They assert on
 * three independent surfaces so a reintroduction cannot slip through by
 * changing shape:
 *
 *   1. the returned object (behaviour),
 *   2. every nested value in the returned object (recursive scan),
 *   3. the generator source file on disk (static scan).
 *
 * Surfaces 2 and 3 each carry their own positive control, so a scanner that
 * silently stopped matching is caught here rather than reported as a pass.
 */

import { readFileSync } from 'fs';
import path from 'path';

import {
  generateFullAuthorityCampaign,
  type AuthorityCampaignInput,
} from '@/lib/marketing-agency/full-campaign-generator';

const GENERATOR_SOURCE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'lib',
  'marketing-agency',
  'full-campaign-generator.ts'
);

/** Keys no generator output may ever carry. */
const FORBIDDEN_APPROVAL_KEYS = [
  'humanApproved',
  'approvedBy',
  'approvedAt',
] as const;

/** Score keys the generator used to award itself. */
const SELF_AWARDED_SCORE_KEYS = [
  'evidenceQuality',
  'accuracy',
  'balance',
  'usefulness',
  'brandFit',
  'seoAeoGeoValue',
  'platformFit',
  'riskLevel',
  'approvalReadiness',
] as const;

const baseInput: AuthorityCampaignInput = {
  campaignId: 'self-approval-fixture',
  generatedAt: '2026-06-11T10:15:00+10:00',
  business: {
    slug: 'fixture-business',
    name: 'Fixture Business',
    websiteUrl: 'https://example.com',
    positioning: 'Evidence-backed service marketing',
    audience: ['business owners', 'operators'],
    offers: ['business profile intake', 'verified campaign generation'],
    voiceRules: ['direct', 'practical'],
    forbiddenClaims: ['No unsupported results claims'],
  },
  objective: 'Generate an evidence-backed authority campaign',
  operatingMandate:
    'Source first, publish owned media first, gate external social.',
  sources: [
    {
      id: 'plaud-systemic-overhaul-mandate',
      label: 'Plaud founder mandate',
      sourceType: 'founder_recording_transcript',
      path: 'Plaud file test-fixture',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-linkedin-posts-api',
      label: 'LinkedIn Posts API',
      sourceType: 'official_platform_documentation',
      url: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-meta-pages-api',
      label: 'Facebook Pages API',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.facebook.com/docs/pages-api/posts/',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-youtube-videos-insert',
      label: 'YouTube videos.insert',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.google.com/youtube/v3/docs/videos/insert',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'platform-reddit-data-api',
      label: 'Reddit Data API',
      sourceType: 'official_platform_documentation',
      url: 'https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
    {
      id: 'internal-consent-evidence-policy',
      label: 'Consent and evidence policy',
      sourceType: 'internal_policy',
      path: 'docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md',
      checkedAt: '2026-06-11T10:15:00+10:00',
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walk an arbitrary value and return every dotted path whose object node
 * carries one of `keys`. Used to prove a forbidden key is absent ANYWHERE in
 * the pack, not merely at the location the defect used to sit.
 */
function findKeyPaths(
  value: unknown,
  keys: readonly string[],
  trail = '$'
): string[] {
  const hits: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findKeyPaths(item, keys, `${trail}[${index}]`));
    });
    return hits;
  }

  if (!isRecord(value)) return hits;

  for (const [key, child] of Object.entries(value)) {
    const nextTrail = `${trail}.${key}`;
    if (keys.includes(key)) hits.push(nextTrail);
    hits.push(...findKeyPaths(child, keys, nextTrail));
  }

  return hits;
}

/** Every dotted path where an `approval.status` is the literal 'approved'. */
function findApprovedStatusPaths(value: unknown, trail = '$'): string[] {
  const hits: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findApprovedStatusPaths(item, `${trail}[${index}]`));
    });
    return hits;
  }

  if (!isRecord(value)) return hits;

  for (const [key, child] of Object.entries(value)) {
    const nextTrail = `${trail}.${key}`;
    if (key === 'approval' && isRecord(child) && child.status === 'approved') {
      hits.push(`${nextTrail}.status`);
    }
    hits.push(...findApprovedStatusPaths(child, nextTrail));
  }

  return hits;
}

/** Literals in generator source that would mean it approves its own output. */
const SELF_APPROVAL_SOURCE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'humanApproved assignment', pattern: /humanApproved\s*:/ },
  { label: 'approvedBy assignment', pattern: /approvedBy\s*:/ },
  { label: 'approvedAt assignment', pattern: /approvedAt\s*:/ },
  {
    label: "status: 'approved' assignment",
    pattern: /status\s*:\s*['"`]approved['"`]/,
  },
];

describe('generateFullAuthorityCampaign — never approves its own output', () => {
  describe('returned object', () => {
    it('is pending_review and carries no approval identity', () => {
      const pack = generateFullAuthorityCampaign({
        ...baseInput,
        horizonDays: 7,
      });

      expect(pack.evidenceManifest.approval.status).toBe('pending_review');
      expect(pack.evidenceManifest.approval.status).not.toBe('approved');

      for (const key of FORBIDDEN_APPROVAL_KEYS) {
        expect(pack.evidenceManifest.approval).not.toHaveProperty(key);
      }

      // The whole approval object is exactly one key. Anything else added later
      // fails here even if it is not on the forbidden list above.
      expect(Object.keys(pack.evidenceManifest.approval)).toEqual(['status']);
    });

    it('carries no self-awarded evaluation scores', () => {
      const pack = generateFullAuthorityCampaign({
        ...baseInput,
        horizonDays: 7,
      });

      expect(pack.evidenceManifest.evaluation).toBeUndefined();
      expect(pack.evidenceManifest).not.toHaveProperty('evaluation');

      const scoreHits = findKeyPaths(
        pack.evidenceManifest,
        SELF_AWARDED_SCORE_KEYS
      );
      expect(scoreHits).toEqual([]);
    });

    it('stays pending_review across every input shape', () => {
      const variants: AuthorityCampaignInput[] = [
        { ...baseInput, horizonDays: 1 },
        { ...baseInput, horizonDays: 14 },
        { ...baseInput, horizonDays: 7, channels: ['blog', 'newsletter'] },
        { ...baseInput, horizonDays: 7, channels: ['reddit'] },
        {
          ...baseInput,
          horizonDays: 3,
          manifestTopic: 'Client authority campaign',
          lessons: ['a lesson'],
          expertNotes: ['an expert note'],
          seoAeoGeoTargets: ['a target'],
          requiredVisuals: ['a visual'],
        },
        { ...baseInput, horizonDays: 2, sources: [] },
      ];

      for (const variant of variants) {
        const pack = generateFullAuthorityCampaign(variant);
        expect(pack.evidenceManifest.approval.status).toBe('pending_review');
        expect(pack.evidenceManifest.approval).not.toHaveProperty(
          'humanApproved'
        );
        expect(pack.evidenceManifest.evaluation).toBeUndefined();
      }
    });
  });

  describe('recursive scan of the whole pack', () => {
    it('contains no humanApproved / approvedBy / approvedAt anywhere', () => {
      const pack = generateFullAuthorityCampaign({
        ...baseInput,
        horizonDays: 7,
      });

      expect(findKeyPaths(pack, FORBIDDEN_APPROVAL_KEYS)).toEqual([]);
    });

    it("contains no approval.status === 'approved' anywhere", () => {
      const pack = generateFullAuthorityCampaign({
        ...baseInput,
        horizonDays: 7,
      });

      expect(findApprovedStatusPaths(pack)).toEqual([]);
    });

    it('POSITIVE CONTROL: the scanners detect the defect when it is present', () => {
      // The exact block that was deleted, replanted in a synthetic pack. If the
      // scanners above cannot see this, their empty results prove nothing.
      const reintroduced = {
        evidenceManifest: {
          approval: {
            status: 'approved',
            humanApproved: true,
            approvedBy: 'Codex execution agent',
            approvedAt: '2026-06-11T10:15:00+10:00',
          },
          evaluation: {
            evidenceQuality: 86,
            accuracy: 86,
            balance: 82,
            usefulness: 88,
            brandFit: 84,
            seoAeoGeoValue: 86,
            platformFit: 82,
            riskLevel: 24,
            approvalReadiness: 82,
          },
        },
      };

      expect(findKeyPaths(reintroduced, FORBIDDEN_APPROVAL_KEYS)).toEqual([
        '$.evidenceManifest.approval.humanApproved',
        '$.evidenceManifest.approval.approvedBy',
        '$.evidenceManifest.approval.approvedAt',
      ]);
      expect(findApprovedStatusPaths(reintroduced)).toEqual([
        '$.evidenceManifest.approval.status',
      ]);
      expect(findKeyPaths(reintroduced, SELF_AWARDED_SCORE_KEYS)).toHaveLength(
        SELF_AWARDED_SCORE_KEYS.length
      );
    });
  });

  describe('generator source file', () => {
    it('contains no self-approval writer', () => {
      const source = readFileSync(GENERATOR_SOURCE_PATH, 'utf8');
      // Strip comments so the explanatory note naming the deleted fields does
      // not itself trip the scan.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      const found = SELF_APPROVAL_SOURCE_PATTERNS.filter(({ pattern }) =>
        pattern.test(code)
      ).map(({ label }) => label);

      expect(found).toEqual([]);
    });

    it('POSITIVE CONTROL: the source scan detects the deleted block', () => {
      const deletedBlock = `
        approval: {
          status: 'approved',
          humanApproved: true,
          approvedBy: 'Codex execution agent',
          approvedAt: input.generatedAt,
        },
      `;

      const found = SELF_APPROVAL_SOURCE_PATTERNS.filter(({ pattern }) =>
        pattern.test(deletedBlock)
      ).map(({ label }) => label);

      expect(found).toEqual([
        'humanApproved assignment',
        'approvedBy assignment',
        'approvedAt assignment',
        "status: 'approved' assignment",
      ]);
    });

    it('POSITIVE CONTROL: the source file is actually being read', () => {
      const source = readFileSync(GENERATOR_SOURCE_PATH, 'utf8');
      // If the path were wrong, readFileSync would throw; if it pointed at the
      // wrong file, this marker would be missing and the scan above would be
      // vacuously green.
      expect(source).toContain('export function generateFullAuthorityCampaign');
      expect(source).toContain("status: 'pending_review'");
    });
  });

  describe('authority gate is no longer handed a pre-satisfied token', () => {
    it('blocks owned-media publishing on missing human approval and missing scores', () => {
      const pack = generateFullAuthorityCampaign({
        ...baseInput,
        horizonDays: 7,
      });

      expect(pack.ownedMediaGate.allowed).toBe(false);
      expect(pack.ownedMediaGate.blockers).toContain(
        'campaign_human_approval_missing'
      );
      expect(pack.ownedMediaGate.blockers).toContain(
        'campaign_evaluation_missing'
      );
    });
  });
});
