/**
 * J12 golden regressions — content, publishing, workflow and agency gates.
 */
import { db } from './db';
import { load, throws, verdict, withEnv, type GoldenCase } from './harness';

type Fn<A extends unknown[] = unknown[], R = unknown> = (...a: A) => R;

/** Swap global.fetch for an external-API stand-in for the duration of fn. */
async function withFetch<T>(
  impl: typeof fetch,
  fn: () => Promise<T>
): Promise<T> {
  const saved = global.fetch;
  global.fetch = impl;
  try {
    return await fn();
  } finally {
    global.fetch = saved;
  }
}

export const contentCases: GoldenCase[] = [
  {
    slug: 'banned-phrases-stripped',
    sha: 'e535d44b',
    property:
      'stripBannedPhrases rewrites clichés (leverage → use) and leaves clean copy untouched',
    target: 'lib/content/banned-phrases.ts',
    run: () => {
      const m = load<{
        stripBannedPhrases: Fn<[string], string>;
        containsBannedPhrase: Fn<[string], boolean>;
      }>('@/lib/content/banned-phrases');
      const clean = 'We cleaned 40 carpets in Brisbane this week.';
      return verdict([
        ['leverage', m.stripBannedPhrases('we leverage data'), 'we use data'],
        [
          'Leverage capitalised',
          m.stripBannedPhrases('Leverage data'),
          'Use data',
        ],
        ['clean untouched', m.stripBannedPhrases(clean), clean],
        [
          'revolutionary detected',
          m.containsBannedPhrase('our revolutionary tool'),
          true,
        ],
        [
          'stripped has none',
          m.containsBannedPhrase(
            m.stripBannedPhrases('our revolutionary game-changing tool')
          ),
          false,
        ],
      ]);
    },
  },
  {
    slug: 'industry-classifier-colour-property',
    sha: '86f65052',
    property:
      'detectIndustry: "colour" is not beauty salon, "property damage" is not real estate (SYN-853)',
    target: 'lib/demo/industry-classifier.ts',
    run: () => {
      const { detectIndustry } = load<{ detectIndustry: Fn<[string], string> }>(
        '@/lib/demo/industry-classifier'
      );
      return verdict([
        [
          'training copy',
          detectIndustry(
            'Org-A delivers online IICRC continuing education credits (CEC) and CPD courses for restoration professionals. Our certification program covers colour restoration.'
          ),
          'education & training',
        ],
        [
          'colour page not salon',
          detectIndustry(
            'We match the colour of your new carpet to the existing room, across Australia.'
          ) === 'beauty salon',
          false,
        ],
        [
          'B2B SaaS',
          detectIndustry(
            'Org-B is the B2B SaaS platform purpose-built for property restoration companies. Manage claims, jobs, and operations from one dashboard.'
          ),
          'B2B SaaS',
        ],
      ]);
    },
  },
  {
    slug: 'obsidian-h1-wikilink-title',
    sha: 'f38a78e4',
    property:
      'parseObsidianNote strips a WikiLink from an H1 title ([[a|Title]] → Title)',
    target: 'lib/markdown/obsidian-parser.ts',
    run: () => {
      const { parseObsidianNote } = load<{
        parseObsidianNote: Fn<[string], { title: string; content: string }>;
      }>('@/lib/markdown/obsidian-parser');
      return verdict([
        [
          'alias title',
          parseObsidianNote('# [[Project Name|Title]]\n\nBody content.').title,
          'Title',
        ],
        ['empty note', parseObsidianNote('').title, 'Untitled'],
        [
          'link in body stripped',
          parseObsidianNote('See [[project-x|Project X]].').content.includes(
            '[['
          ),
          false,
        ],
      ]);
    },
  },
  {
    slug: 'client-accent-not-synthex-orange',
    sha: '98b3e233',
    property:
      "resolveClientAccent uses the client's hex and never falls back to Synthex orange (SYN-1131)",
    target: 'lib/brand/client-accent.ts',
    run: () => {
      const { resolveClientAccent } = load<{
        resolveClientAccent: Fn<[unknown], Record<string, string>>;
      }>('@/lib/brand/client-accent');
      const fallback = resolveClientAccent(null);
      const orange = Object.values(fallback).some(c =>
        ['#ff6b35', '#f97316'].includes(c.toLowerCase())
      );
      return verdict([
        ['client hex', resolveClientAccent('#1D4ED8').accent, '#1d4ed8'],
        ['invalid → neutral', resolveClientAccent('#gggggg').accent, '#334155'],
        ['fallback never orange', orange, false],
      ]);
    },
  },
  {
    slug: 'serialize-error-survives-json',
    sha: '0273eed2',
    property:
      'serializeError keeps name/message through JSON.stringify and handles non-Error throws (SYN-999)',
    target: 'lib/observability/serialize-error.ts',
    run: () => {
      const { serializeError } = load<{
        serializeError: Fn<[unknown, number?], Record<string, unknown>>;
      }>('@/lib/observability/serialize-error');
      const long = new Error('x');
      long.stack = 'S'.repeat(5000);
      return verdict([
        [
          'message survives',
          JSON.stringify(serializeError(new TypeError('boom'))).includes(
            'boom'
          ),
          true,
        ],
        ['name', serializeError(new TypeError('boom')).name, 'TypeError'],
        [
          'string throw',
          serializeError('plain string').message,
          'plain string',
        ],
        ['object throw', serializeError({ code: 42 }).message, '{"code":42}'],
        [
          'stack truncated',
          (serializeError(long, 100).stack as string).length,
          100,
        ],
      ]);
    },
  },
  {
    slug: 'publishing-scope-facebook',
    sha: '90572591',
    property:
      'checkPublishingScopes refuses a Facebook connection missing pages_manage_posts',
    target: 'lib/social/publishing-scope-policy.ts',
    run: () => {
      const m = load<{
        checkPublishingScopes: Fn<
          [string, string],
          { ok: boolean; missing: string[] }
        >;
        parseOAuthScope: Fn<[string], string[]>;
      }>('@/lib/social/publishing-scope-policy');
      const fb = m.checkPublishingScopes(
        'facebook',
        'public_profile,email,pages_show_list,pages_read_engagement'
      );
      return verdict([
        ['fb ok', fb.ok, false],
        ['fb missing', fb.missing, ['pages_manage_posts']],
        [
          'parse',
          m.parseOAuthScope('pages_show_list,pages_manage_posts email'),
          ['pages_show_list', 'pages_manage_posts', 'email'],
        ],
      ]);
    },
  },
  {
    slug: 'owned-page-youtube-allowlisted',
    sha: '443a86ee',
    property:
      'the RestoreAssist owned-page config allowlists its YouTube channel id (matching the channel handle)',
    target: 'lib/social/owned-page-policy.ts',
    run: () => {
      const { getOwnedSocialClientConfig } = load<{
        getOwnedSocialClientConfig: Fn<
          [string],
          | {
              socialHandles: Record<string, string>;
              allowedProfileIds: Record<string, string[]>;
            }
          | undefined
        >;
      }>('@/lib/social/owned-page-policy');
      const c = getOwnedSocialClientConfig('restoreassist');
      const ids = c?.allowedProfileIds.youtube ?? [];
      return verdict([
        ['has youtube id', ids.length > 0, true],
        [
          'handle names the id',
          ids.length > 0 && String(c?.socialHandles.youtube).endsWith(ids[0]),
          true,
        ],
      ]);
    },
  },
  {
    slug: 'scheduler-rejects-past-date',
    sha: '5e425a58',
    property:
      'isFutureScheduledAt rejects past instants beyond 60s skew and unparseable dates [SYN-SCHED]',
    target: 'app/api/scheduler/posts/route.ts',
    run: () => {
      const { isFutureScheduledAt } = load<{
        isFutureScheduledAt: Fn<[string, number], boolean>;
      }>('@/app/api/scheduler/posts/route');
      const NOW = Date.parse('2026-06-15T12:00:00.000Z');
      const iso = (ms: number) => new Date(NOW + ms).toISOString();
      return verdict([
        ['yesterday', isFutureScheduledAt(iso(-86_400_000), NOW), false],
        ['2 min ago', isFutureScheduledAt(iso(-120_000), NOW), false],
        ['30s ago (skew)', isFutureScheduledAt(iso(-30_000), NOW), true],
        ['tomorrow', isFutureScheduledAt(iso(86_400_000), NOW), true],
        ['garbage', isFutureScheduledAt('not-a-date', NOW), false],
      ]);
    },
  },
  {
    slug: 'action-publish-no-fabricated-post',
    sha: 'd874d3c8',
    property:
      'workflow action-publish records intent (awaiting_publish) without a fabricated post id or publishedAt (SYN-972)',
    target: 'lib/workflow/step-types/action-publish.ts',
    run: async () => {
      const { execute } = load<{
        execute: Fn<
          [object, object],
          Promise<{ success: boolean; output?: Record<string, unknown> }>
        >;
      }>('@/lib/workflow/step-types/action-publish');
      const r = await execute(
        {
          name: 'Publish to platform',
          type: 'action',
          config: { platform: 'linkedin' },
        },
        {
          stepDefinition: {},
          priorOutputs: [{ stepType: 'ai', output: { content: 'final copy' } }],
          stepIndex: 6,
          totalSteps: 7,
        }
      );
      const out = r.output ?? {};
      return verdict([
        ['status', out.status, 'awaiting_publish'],
        ['no platformPostId', 'platformPostId' in out, false],
        ['no publishedAt', 'publishedAt' in out, false],
      ]);
    },
  },
  {
    slug: 'workflow-reject-requires-waiting',
    sha: 'f1f2c76c',
    property:
      'rejectCurrentStep throws and writes nothing unless the execution is waiting_approval (SYN-972)',
    target: 'lib/workflow/orchestrator.ts',
    run: async () => {
      const { rejectCurrentStep } = load<{
        rejectCurrentStep: Fn<[string, string, string], Promise<unknown>>;
      }>('@/lib/workflow/orchestrator');
      db.reset({
        'workflowExecution.findUniqueOrThrow': () => ({
          currentStepIndex: 2,
          status: 'running',
        }),
      });
      const err = await throws(() =>
        rejectCurrentStep('exec-org-A', 'user-A', 'reason')
      );
      const writes = db.calls.filter(c =>
        /update|create|delete/i.test(c.method)
      );
      return verdict([
        [
          'throws not-waiting',
          err !== null && /not waiting for approval/i.test(err),
          true,
        ],
        ['no writes', writes.length, 0],
      ]);
    },
  },
  {
    slug: 'search-console-no-demo-rows',
    sha: '424f3c73',
    property:
      'getSearchAnalytics returns configured:false with empty rows, not demo ranking data, when unconfigured',
    target: 'lib/google/search-console.ts',
    run: () =>
      withEnv({ GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: undefined }, async () => {
        const { getSearchAnalytics } = load<{
          getSearchAnalytics: Fn<
            [string, object],
            Promise<{
              configured: boolean;
              rows: unknown[];
              totals: { clicks: number };
            }>
          >;
        }>('@/lib/google/search-console');
        const r = await getSearchAnalytics('https://org-a.example', {
          dimensions: ['query'],
        });
        return verdict([
          ['configured', r.configured, false],
          ['rows', r.rows, []],
          ['clicks', r.totals.clicks, 0],
        ]);
      }),
  },
  {
    slug: 'pagespeed-no-fabricated-scores',
    sha: '27d646f2',
    property:
      'runPageSpeedAnalysis reports available:false and null scores when the API fails, never demo scores',
    target: 'lib/seo/pagespeed-service.ts',
    run: async () => {
      const { runPageSpeedAnalysis } = load<{
        runPageSpeedAnalysis: Fn<
          [string, string],
          Promise<{ available: boolean; scores: unknown }>
        >;
      }>('@/lib/seo/pagespeed-service');
      const failing = (async () => ({
        ok: false,
        status: 429,
      })) as unknown as typeof fetch;
      const r = await withFetch(failing, () =>
        runPageSpeedAnalysis('https://org-a.example', 'desktop')
      );
      return verdict([
        ['available', r.available, false],
        ['scores', r.scores, null],
      ]);
    },
  },
  {
    slug: 'publish-claim-atomic',
    sha: 'f5d914d5',
    property:
      'claimPostForPublish is a conditional updateMany on scheduled+unpublished and returns false when 0 rows claimed',
    target: 'lib/publish/postPublishClaim.ts',
    run: async () => {
      const { claimPostForPublish } = load<{
        claimPostForPublish: Fn<[string], Promise<boolean>>;
      }>('@/lib/publish/postPublishClaim');
      db.reset({
        'post.updateMany': () => ({ count: 0 }),
        'post.findUnique': () => ({ metadata: {} }),
      });
      const lost = await claimPostForPublish('post-org-A');
      const where =
        (
          db.callsTo('post', 'updateMany')[0]?.args as {
            where?: Record<string, unknown>;
          }
        )?.where ?? {};
      db.reset({
        'post.updateMany': () => ({ count: 1 }),
        'post.findUnique': () => ({ metadata: {} }),
      });
      const won = await claimPostForPublish('post-org-A');
      return verdict([
        ['lost race → false', lost, false],
        ['won → true', won, true],
        ['gated on scheduled', where.status, 'scheduled'],
        ['gated on unpublished', where.publishedAt, null],
      ]);
    },
  },
  {
    slug: 'publish-queue-stranded-reclaim',
    sha: '30166f8f',
    property:
      "reclaimStalePublishingQueueItems releases only stale 'publishing' queue items back to a retryable status",
    target: 'lib/publish/postPublishClaim.ts',
    run: async () => {
      const { reclaimStalePublishingQueueItems } = load<{
        reclaimStalePublishingQueueItems: Fn<[Date?], Promise<number>>;
      }>('@/lib/publish/postPublishClaim');
      db.reset({ 'publishQueueItem.updateMany': () => ({ count: 2 }) });
      const n = await reclaimStalePublishingQueueItems(
        new Date('2030-06-01T12:00:00.000Z')
      );
      const call = db.calls.find(c => c.method === 'updateMany')?.args as
        | { where?: Record<string, unknown>; data?: Record<string, unknown> }
        | undefined;
      return verdict([
        ['count', n, 2],
        ['where publishing', call?.where?.status, 'publishing'],
        [
          'has staleness cutoff',
          JSON.stringify(call?.where ?? {}).includes('"lt"'),
          true,
        ],
        [
          'moves out of publishing',
          call?.data?.status !== undefined &&
            call?.data?.status !== 'publishing',
          true,
        ],
      ]);
    },
  },
  {
    slug: 'pr-export-gate-approved-only',
    sha: '0256a7b6',
    property:
      'isPrExportCleared clears only approved/published press releases (AT-014 fail-closed export)',
    target: 'lib/pr/export-gate.ts',
    run: () => {
      const { isPrExportCleared } = load<{
        isPrExportCleared: Fn<[string], boolean>;
      }>('@/lib/pr/export-gate');
      return verdict([
        ['approved', isPrExportCleared('approved'), true],
        ['published', isPrExportCleared('published'), true],
        ['draft', isPrExportCleared('draft'), false],
        ['empty', isPrExportCleared(''), false],
      ]);
    },
  },
  {
    slug: 'nl-execute-brand-voice-gate',
    sha: '412766ae',
    property:
      'ensureBrandVoiceGate inserts the brand-voice gate before the first publish action (AT-027)',
    target: 'lib/autonomous/ensure-brand-voice-gate.ts',
    run: () => {
      const m = load<{
        ensureBrandVoiceGate: Fn<[object[]], object[]>;
        BRAND_VOICE_GATE_STEP: object;
      }>('@/lib/autonomous/ensure-brand-voice-gate');
      const draft = { name: 'Draft', type: 'ai', promptTemplate: 'Write' };
      const publish = {
        name: 'Publish',
        type: 'action',
        actionType: 'publish',
      };
      return verdict([
        [
          'gate before publish',
          m.ensureBrandVoiceGate([draft, publish]),
          [draft, m.BRAND_VOICE_GATE_STEP, publish],
        ],
      ]);
    },
  },
  {
    slug: 'strategist-gate-needs-brand-voice-pass',
    sha: '9a0038e6',
    property:
      'priorBrandVoicePassed is true only after a passing brand-voice-enforce output (AT-004)',
    target: 'lib/agency/strategist-gate.ts',
    run: () => {
      const { priorBrandVoicePassed } = load<{
        priorBrandVoicePassed: Fn<[object[]], boolean>;
      }>('@/lib/agency/strategist-gate');
      return verdict([
        ['empty', priorBrandVoicePassed([]), false],
        [
          'failed',
          priorBrandVoicePassed([
            { output: { gate: 'brand-voice-enforce', pass: false } },
          ]),
          false,
        ],
        [
          'passed',
          priorBrandVoicePassed([
            { output: { gate: 'brand-voice-enforce', pass: true } },
          ]),
          true,
        ],
      ]);
    },
  },
  {
    slug: 'brand-voice-gate-r1-forbidden',
    sha: '42addf15',
    property:
      'runBrandVoiceGate fails copy containing an R1 forbidden word via the full enforce engine (AT-003)',
    target: 'lib/agency/brand-voice-gate.ts',
    run: async () => {
      const { runBrandVoiceGate } = load<{
        runBrandVoiceGate: Fn<
          [object, object],
          Promise<{ pass: boolean; violations: string[] }>
        >;
      }>('@/lib/agency/brand-voice-gate');
      const bad = await runBrandVoiceGate(
        {
          brand: 'ra',
          content:
            'The platform helps teams leverage existing reports. Quick note.',
        },
        { trackingEnabled: false }
      );
      return verdict([
        ['fails', bad.pass, false],
        ['R1 violation', bad.violations.some(v => v.startsWith('R1:')), true],
      ]);
    },
  },
  {
    slug: 'hypercare-snapshot-breach',
    sha: '060a06aa',
    property:
      'buildHyperCareSnapshot surfaces a breach and counts failure reasons over 24h (AT-006)',
    target: 'lib/agency/hypercare-snapshot.ts',
    run: () => {
      const { buildHyperCareSnapshot } = load<{
        buildHyperCareSnapshot: Fn<[object[], Date], Record<string, unknown>>;
      }>('@/lib/agency/hypercare-snapshot');
      const s = buildHyperCareSnapshot(
        [
          { pass: true, reasons: [] },
          { pass: false, reasons: ['missing source', 'stale citation'] },
          { pass: false, reasons: ['missing source'] },
        ],
        new Date('2026-08-05T06:00:00.000Z')
      );
      return verdict([
        ['breach', s.breachSurfaced, true],
        ['failed', s.failedRuns, 2],
        [
          'reasons',
          s.failureReasons,
          [
            { reason: 'missing source', count: 2 },
            { reason: 'stale citation', count: 1 },
          ],
        ],
      ]);
    },
  },
  {
    slug: 'tier2-snapshot-guard',
    sha: 'eb3e580e',
    property:
      'isTier2Snapshot rejects a partial stored snapshot; buildTier2Snapshot counts failures (AT-007)',
    target: 'lib/agency/tier2-snapshot.ts',
    run: () => {
      const m = load<{
        isTier2Snapshot: Fn<[unknown], boolean>;
        buildTier2Snapshot: Fn<[object[], Date], Record<string, unknown>>;
      }>('@/lib/agency/tier2-snapshot');
      const s = m.buildTier2Snapshot(
        [{ pass: false, reasons: ['missing source'] }],
        new Date('2026-08-01T07:00:00.000Z')
      );
      return verdict([
        ['partial rejected', m.isTier2Snapshot({ totalRuns: 1 }), false],
        ['failed counted', s.failedRuns, 1],
        ['month', s.monthEnding, '2026-08-01'],
      ]);
    },
  },
  {
    slug: 'incident-severity-floor',
    sha: '2062064e',
    property:
      'classifyIncident floors privacy/security incidents with a canary signal at severity 1 (AT-025)',
    target: 'lib/agency/incident-classifier.ts',
    run: () => {
      const { classifyIncident } = load<{
        classifyIncident: Fn<
          [object],
          { severity: number; storeForReviewOnly: boolean }
        >;
      }>('@/lib/agency/incident-classifier');
      const p = classifyIncident({
        type: 'privacy-breach',
        canarySignal: 'AMBER',
      });
      return verdict([
        ['privacy amber', p.severity, 1],
        ['store for review', p.storeForReviewOnly, true],
        [
          'security red',
          classifyIncident({ type: 'security', canarySignal: 'RED' }).severity,
          1,
        ],
      ]);
    },
  },
  {
    slug: 'churn-tier-mapping',
    sha: 'f4c804fc',
    property:
      'riskLevelToChurnTier maps health risk levels to churn tiers and unknown to medium (AT-023)',
    target: 'lib/retention/churn-scorer.ts',
    run: () => {
      const m = load<{
        riskLevelToChurnTier: Fn<[string | null], string>;
        deriveChurnProbabilities: Fn<
          [number, number, string],
          { churnProbability30d: number }
        >;
      }>('@/lib/retention/churn-scorer');
      return verdict([
        ['healthy', m.riskLevelToChurnTier('healthy'), 'low'],
        ['critical', m.riskLevelToChurnTier('critical'), 'critical'],
        ['null', m.riskLevelToChurnTier(null), 'medium'],
        [
          'critical riskier',
          m.deriveChurnProbabilities(20, -12, 'critical').churnProbability30d >
            m.deriveChurnProbabilities(85, 2, 'healthy').churnProbability30d,
          true,
        ],
      ]);
    },
  },
];
