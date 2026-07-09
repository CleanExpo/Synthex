/**
 * publish-social.ts — SYN-500 Phase 4b/4c.
 *
 * Builds per-platform social copy from a board-session script and publishes it
 * through the GOVERNED Synthex endpoint `/api/social/post` (the same campaign
 * authority + owned-page + OAuth-scope gates every human post passes). It does
 * NOT talk to Meta / LinkedIn / X directly and it NEVER fabricates a success
 * or a post URL.
 *
 * Live multi-platform publishing is GATED on Meta OAuth (SYN-1054) plus a
 * configured service endpoint + token. Absent either, each platform resolves to
 * an honest `gated` status with a reason — no fake "published". Every platform
 * is attempted and logged independently so one failure never blocks the others
 * (SYN-500 error-handling criterion).
 *
 * Usage:
 *   tsx board-cron/scripts/publish-social.ts \
 *     --script board-cron/video-scripts/session-23-client-journey.json \
 *     --youtube-url https://youtu.be/XXXX \
 *     --video board-cron/video-assets/renders/session-23-short.mp4
 *
 * The pure builders (extractBeats / buildSocialPayloads / resolvePublishPlan)
 * are exported for unit testing with no network or external service.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScriptScene {
  id: string;
  type: string;
  content: string;
  narrated: boolean;
}

interface BoardScript {
  _meta: {
    session: number;
    title: string;
    topic: string;
    ep_title?: string;
    youtube_description?: string;
  };
  scenes: ScriptScene[];
}

export type SocialPlatform = 'instagram' | 'linkedin' | 'twitter';

export interface SessionBeats {
  session: number;
  title: string;
  topic: string;
  decisionOneLiner: string;
  nextActions: string[];
  risk: string;
}

export interface SocialPayloads {
  instagram: { caption: string; hashtags: string[] };
  linkedin: { body: string };
  twitter: { tweets: string[] };
}

export type PublishStatus = 'ready' | 'gated' | 'error';

export interface PlatformPublishResult {
  platform: SocialPlatform;
  status: PublishStatus;
  /** Human-readable reason for a gated/error state; empty when ready/published. */
  reason: string;
  /** The copy that would be / was submitted. */
  content: string;
  /** Populated ONLY by a real 2xx from the governed endpoint. Never faked. */
  postUrl?: string;
  published: boolean;
}

const DEFAULT_HASHTAGS = [
  '#Synthex',
  '#AIBoard',
  '#MarketingAutomation',
  '#SmallBusiness',
  '#AustralianBusiness',
];

// ── Pure builders ────────────────────────────────────────────────────────────

function firstSentence(text: string): string {
  const match = text.trim().match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

/**
 * Parse a `next_actions` narration ("One — ... Two — ... Three — ...") into
 * discrete action strings.
 */
function parseNextActions(content: string): string[] {
  const parts = content
    .split(/\b(?:One|Two|Three|Four|Five)\b\s*[—-]\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
  // The first split segment is the lead-in ("Three next actions."); drop it.
  const actions = parts.length > 1 ? parts.slice(1) : parts;
  return actions
    .map(a => firstSentence(a))
    .filter(Boolean)
    .slice(0, 3);
}

/** Extract the decision / next-actions / risk beats from a board script. */
export function extractBeats(script: BoardScript): SessionBeats {
  const byType = (t: string) => script.scenes.find(s => s.type === t);

  const decisionBody = byType('decision_body')?.content ?? '';
  const nextActionsScene = byType('next_actions')?.content ?? '';
  const riskScene = byType('risk')?.content ?? '';

  // Prefer the "THE DECISION:" line from the YouTube description when present.
  const ytDesc = script._meta.youtube_description ?? '';
  const decisionLineMatch = ytDesc.match(/THE DECISION:\s*(.+)/i);
  const decisionOneLiner = decisionLineMatch
    ? decisionLineMatch[1].split('\n')[0].trim()
    : firstSentence(decisionBody) ||
      `Board decision from Session ${script._meta.session}`;

  return {
    session: script._meta.session,
    title: script._meta.title,
    topic: script._meta.topic,
    decisionOneLiner,
    nextActions: parseNextActions(nextActionsScene),
    risk: firstSentence(riskScene),
  };
}

/** Build per-platform copy from the session beats. */
export function buildSocialPayloads(
  script: BoardScript,
  opts: { youtubeUrl?: string; hashtags?: string[] } = {}
): SocialPayloads {
  const beats = extractBeats(script);
  const hashtags = opts.hashtags ?? DEFAULT_HASHTAGS;
  const yt = opts.youtubeUrl ? `\n\nFull session: ${opts.youtubeUrl}` : '';

  // Instagram Reel caption — decision hook + link + hashtags.
  const instagramCaption =
    `Session ${beats.session}: ${beats.title}\n\n` +
    `${beats.decisionOneLiner}${yt}`;

  // LinkedIn — full DECISION + RATIONALE body.
  const actionsBlock = beats.nextActions.length
    ? `\n\nNext actions:\n${beats.nextActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
    : '';
  const riskBlock = beats.risk ? `\n\nRisk to watch: ${beats.risk}` : '';
  const linkedinBody =
    `Synthex Board — Session ${beats.session}: ${beats.title}\n\n` +
    `DECISION: ${beats.decisionOneLiner}` +
    actionsBlock +
    riskBlock +
    yt;

  // Twitter/X — 3-tweet thread.
  const tweet1 = truncateTweet(
    `Synthex Board S${beats.session}: ${beats.decisionOneLiner}${opts.youtubeUrl ? `\n\n${opts.youtubeUrl}` : ''}`
  );
  const tweet2 = truncateTweet(
    beats.nextActions.length
      ? `Next actions:\n${beats.nextActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
      : 'Next actions in the full session.'
  );
  const tweet3 = truncateTweet(
    `${beats.risk ? `Risk to watch: ${beats.risk}\n\n` : ''}Next session in 6 hours.`
  );

  return {
    instagram: { caption: instagramCaption, hashtags },
    linkedin: { body: linkedinBody },
    twitter: { tweets: [tweet1, tweet2, tweet3] },
  };
}

function truncateTweet(text: string, limit = 280): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

// ── Gated publish plan ───────────────────────────────────────────────────────

export interface PublishEnv {
  /** Base URL of the governed Synthex app (hosts /api/social/post). */
  appUrl?: string;
  /** Service/JWT token authorising the governed post call. */
  publishToken?: string;
  /** Set true only when Meta OAuth (SYN-1054) is live for IG/FB. */
  metaOAuthReady?: boolean;
  /** Set true when a LinkedIn owned-page OAuth connection exists. */
  linkedinOAuthReady?: boolean;
  /** Set true when an X/Twitter OAuth connection exists. */
  twitterOAuthReady?: boolean;
}

const PLATFORM_OAUTH_FLAG: Record<SocialPlatform, keyof PublishEnv> = {
  instagram: 'metaOAuthReady',
  linkedin: 'linkedinOAuthReady',
  twitter: 'twitterOAuthReady',
};

function platformContent(
  payloads: SocialPayloads,
  platform: SocialPlatform
): string {
  if (platform === 'instagram') {
    return `${payloads.instagram.caption}\n\n${payloads.instagram.hashtags.join(' ')}`;
  }
  if (platform === 'linkedin') return payloads.linkedin.body;
  return payloads.twitter.tweets.join('\n\n---\n\n');
}

/**
 * Resolve, per platform, whether publishing is `ready` (endpoint + OAuth
 * configured) or `gated` (something missing) — WITHOUT calling anything. This
 * is the honest gate: no OAuth/endpoint ⇒ gated, never a fake success.
 */
export function resolvePublishPlan(
  payloads: SocialPayloads,
  env: PublishEnv,
  platforms: SocialPlatform[] = ['instagram', 'linkedin', 'twitter']
): PlatformPublishResult[] {
  return platforms.map(platform => {
    const content = platformContent(payloads, platform);
    const reasons: string[] = [];
    if (!env.appUrl) reasons.push('SYNTHEX_APP_URL not set');
    if (!env.publishToken) reasons.push('SYNTHEX_PUBLISH_TOKEN not set');
    if (!env[PLATFORM_OAUTH_FLAG[platform]]) {
      reasons.push(
        platform === 'instagram'
          ? 'Meta OAuth not connected (SYN-1054)'
          : `${platform} OAuth connection not present`
      );
    }

    return {
      platform,
      status: reasons.length ? 'gated' : 'ready',
      reason: reasons.join('; '),
      content,
      published: false,
    };
  });
}

// ── Governed publish (network; only for `ready` platforms) ───────────────────

async function publishViaGovernedEndpoint(
  result: PlatformPublishResult,
  env: PublishEnv,
  mediaUrls: string[]
): Promise<PlatformPublishResult> {
  try {
    const res = await fetch(`${env.appUrl}/api/social/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.publishToken}`,
      },
      body: JSON.stringify({
        content: result.content,
        platforms: [result.platform],
        mediaUrls,
      }),
    });

    const data: unknown = await res.json().catch(() => ({}));
    const body = (data ?? {}) as Record<string, unknown>;

    if (!res.ok) {
      // Faithfully surface the endpoint's own gate/error — never coerce to success.
      const message =
        (typeof body.error === 'string' && body.error) ||
        (typeof body.message === 'string' && body.message) ||
        `HTTP ${res.status}`;
      return { ...result, status: 'error', reason: message, published: false };
    }

    const first = Array.isArray(body.results)
      ? (body.results[0] as Record<string, unknown> | undefined)
      : undefined;
    const url = first && typeof first.url === 'string' ? first.url : undefined;
    const succeeded = body.success === true && Boolean(url);

    return {
      ...result,
      status: succeeded ? 'ready' : 'error',
      reason: succeeded ? '' : 'Endpoint did not confirm a published post URL',
      postUrl: url,
      published: succeeded,
    };
  } catch (err) {
    return {
      ...result,
      status: 'error',
      reason: err instanceof Error ? err.message : 'network error',
      published: false,
    };
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function readEnv(): PublishEnv {
  return {
    appUrl: process.env.SYNTHEX_APP_URL,
    publishToken: process.env.SYNTHEX_PUBLISH_TOKEN,
    metaOAuthReady: process.env.META_OAUTH_READY === 'true',
    linkedinOAuthReady: process.env.LINKEDIN_OAUTH_READY === 'true',
    twitterOAuthReady: process.env.TWITTER_OAUTH_READY === 'true',
  };
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

/** Persist per-platform results into rotation-state.json under `social`. */
function writeRotationState(
  statePath: string,
  session: number,
  results: PlatformPublishResult[]
): void {
  if (!existsSync(statePath)) return;
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<
    string,
    unknown
  >;
  const social = (state.social ?? {}) as Record<string, unknown>;
  social[`session-${session}`] = {
    updatedAt: new Date().toISOString(),
    platforms: results.map(r => ({
      platform: r.platform,
      status: r.status,
      published: r.published,
      reason: r.reason || undefined,
      postUrl: r.postUrl,
    })),
  };
  state.social = social;
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scriptPath = args.script;
  if (!scriptPath) {
    console.error('Missing --script <path to board-session JSON>');
    process.exit(1);
  }

  const script = JSON.parse(readFileSync(scriptPath, 'utf8')) as BoardScript;
  const payloads = buildSocialPayloads(script, {
    youtubeUrl: args['youtube-url'],
  });
  const env = readEnv();
  const mediaUrls = args.video ? [args.video] : [];

  let plan = resolvePublishPlan(payloads, env);

  // Attempt only the ready platforms; gated ones are reported, not published.
  plan = await Promise.all(
    plan.map(async result => {
      if (result.status !== 'ready') {
        console.warn(`[${result.platform}] GATED — ${result.reason}`);
        return result;
      }
      const published = await publishViaGovernedEndpoint(
        result,
        env,
        mediaUrls
      );
      if (published.published) {
        console.log(`[${published.platform}] published → ${published.postUrl}`);
      } else {
        console.error(
          `[${published.platform}] ${published.status} — ${published.reason}`
        );
      }
      return published;
    })
  );

  const statePath = path.resolve(
    path.dirname(scriptPath),
    '..',
    'rotation-state.json'
  );
  writeRotationState(statePath, script._meta.session, plan);

  const publishedCount = plan.filter(r => r.published).length;
  console.log(
    `Social publish complete: ${publishedCount}/${plan.length} platforms published, ` +
      `${plan.filter(r => r.status === 'gated').length} gated.`
  );
}

// Run only as a CLI (not when imported by tests).
if (
  process.argv[1] &&
  /publish-social\.(ts|js|mjs|cjs)$/.test(process.argv[1])
) {
  main().catch(err => {
    console.error('publish-social failed:', err);
    process.exit(1);
  });
}
