export type ConnectionState = 'connected' | 'ready' | 'mock' | 'blocked';

export interface ConnectionStatusRow {
  id: string;
  label: string;
  state: ConnectionState;
  safeForMissionControl: true;
  detail: string;
  nextAction?: string;
}

export interface ConnectionStatusManifest {
  source: 'synthex:connection-status';
  generatedAt: string;
  project: {
    id: 'synthex';
    name: 'Synthex';
    role: 'AI social media automation and marketing intelligence platform';
    productionUrl: string;
  };
  summary: Record<ConnectionState, number> & { total: number };
  connections: ConnectionStatusRow[];
}

type EnvReader = Record<string, string | undefined>;

const DEFAULT_APP_URL = 'https://synthex.social';

function hasAny(env: EnvReader, names: string[]): boolean {
  return names.some(name => Boolean(env[name]?.trim()));
}

function row(
  id: string,
  label: string,
  configured: boolean,
  detailReady: string,
  detailBlocked: string,
  nextAction?: string
): ConnectionStatusRow {
  return {
    id,
    label,
    state: configured ? 'ready' : 'blocked',
    safeForMissionControl: true,
    detail: configured ? detailReady : detailBlocked,
    ...(configured || !nextAction ? {} : { nextAction }),
  };
}

function summarise(
  connections: ConnectionStatusRow[]
): ConnectionStatusManifest['summary'] {
  const summary: ConnectionStatusManifest['summary'] = {
    total: connections.length,
    connected: 0,
    ready: 0,
    mock: 0,
    blocked: 0,
  };

  for (const connection of connections) {
    summary[connection.state] += 1;
  }

  return summary;
}

export function buildConnectionStatusManifest(
  env: EnvReader = process.env,
  now = new Date()
): ConnectionStatusManifest {
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;
  const hasDatabase = hasAny(env, [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_DB_URL',
  ]);
  const hasRedis = hasAny(env, [
    'REDIS_URL',
    'REDIS_HOST',
    'UPSTASH_REDIS_REST_URL',
  ]);
  const hasRedisToken = hasAny(env, [
    'REDIS_TOKEN',
    'REDIS_PASSWORD',
    'UPSTASH_REDIS_REST_TOKEN',
  ]);
  const hasAiProvider = hasAny(env, [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
    'GOOGLE_AI_API_KEY',
  ]);

  const connections: ConnectionStatusRow[] = [
    row(
      'database',
      'Database',
      hasDatabase,
      'Primary application database reference is configured.',
      'Primary database reference is missing.',
      'Set DATABASE_URL or the production database reference.'
    ),
    row(
      'auth',
      'Auth and tenancy',
      hasDatabase && hasAny(env, ['NEXT_PUBLIC_APP_URL']),
      'Auth can resolve users against the application database and app URL.',
      'Auth needs database and app URL references before Mission Control takeover.',
      'Set NEXT_PUBLIC_APP_URL and the production database reference.'
    ),
    row(
      'linear',
      'Linear intake',
      hasAny(env, ['LINEAR_API_KEY']) && hasAny(env, ['LINEAR_WEBHOOK_SECRET']),
      'Linear API and webhook intake are configured.',
      'Linear task claim or webhook intake is incomplete.',
      'Set Linear API and webhook references for autonomous intake.'
    ),
    row(
      'obsidian',
      'Obsidian / second brain',
      env.OBSIDIAN_ENABLED === 'true' && hasAny(env, ['OBSIDIAN_API_KEY']),
      'Second-brain writeback is enabled.',
      'Second-brain writeback is not enabled for this environment.',
      'Enable Obsidian writeback and configure the local bridge key.'
    ),
    row(
      'unite_group',
      'Unite-Group CRM',
      hasAny(env, ['UNITE_GROUP_EVENTS_URL']) &&
        hasAny(env, ['UNITE_GROUP_EVENTS_API_KEY']),
      'Unite-Group CRM handoff references are configured.',
      'Unite-Group CRM handoff is missing URL or API key reference.',
      'Set Unite-Group CRM handoff URL and API key in the deployment environment.'
    ),
    row(
      'hermes',
      'Hermes escalation',
      hasAny(env, ['TELEGRAM_BOT_TOKEN']) &&
        hasAny(env, ['TELEGRAM_CHAT_ID']) &&
        hasAny(env, ['HERMES_LINEAR_TEAM_ID']),
      'Hermes escalation can route to Telegram and Linear.',
      'Hermes escalation references are incomplete.',
      'Set Telegram and Hermes Linear team references.'
    ),
    row(
      'ai_providers',
      'AI provider mesh',
      hasAiProvider,
      'At least one AI provider is configured for generation and review.',
      'No AI provider reference is present.',
      'Configure Anthropic, OpenAI, OpenRouter, or Google AI provider access.'
    ),
    row(
      'google_business',
      'Google Business / search',
      hasAny(env, [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON',
        'GOOGLE_PAGESPEED_API_KEY',
      ]),
      'Google business/search integration references are present.',
      'Google business/search integration references are missing.',
      'Configure Google OAuth or service-account references.'
    ),
    row(
      'social_publishing',
      'Social publishing',
      hasAny(env, [
        'TWITTER_CLIENT_ID',
        'LINKEDIN_CLIENT_ID',
        'META_APP_ID',
        'TIKTOK_CLIENT_ID',
        'YOUTUBE_CLIENT_ID',
      ]),
      'At least one social publishing provider is configured.',
      'No social publishing provider reference is present.',
      'Configure OAuth references for the first publishing platform.'
    ),
    row(
      'stripe',
      'Stripe billing',
      hasAny(env, ['STRIPE_SECRET_KEY']) &&
        hasAny(env, ['STRIPE_WEBHOOK_SECRET']),
      'Stripe billing and webhook verification are configured.',
      'Stripe billing or webhook verification is incomplete.',
      'Set Stripe secret and webhook references.'
    ),
    row(
      'content_pipeline',
      'Content pipeline',
      hasRedis && hasRedisToken && hasAiProvider,
      'Queue/cache and AI provider references can support automated content runs.',
      'Content automation needs queue/cache and AI provider references.',
      'Configure Redis or Upstash plus at least one AI provider.'
    ),
    row(
      'monitoring',
      'Monitoring and alerts',
      hasAny(env, ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN']) ||
        hasAny(env, ['TELEGRAM_BOT_TOKEN', 'LINEAR_API_KEY']),
      'Monitoring or alert routing references are present.',
      'Monitoring and alert routing references are missing.',
      'Configure Sentry, Telegram, or Linear alert routing.'
    ),
  ];

  return {
    source: 'synthex:connection-status',
    generatedAt: now.toISOString(),
    project: {
      id: 'synthex',
      name: 'Synthex',
      role: 'AI social media automation and marketing intelligence platform',
      productionUrl: appUrl,
    },
    summary: summarise(connections),
    connections,
  };
}
