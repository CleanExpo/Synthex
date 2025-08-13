import 'server-only';

type Missing = { key: string; reason?: string };

function failOrWarn(missing: Missing[], where: 'production' | 'development') {
  const message = [
    'Environment validation failed:',
    ...missing.map((m) => `- ${m.key}${m.reason ? ` (${m.reason})` : ''}`),
  ].join('\n');

  if (where === 'production') {
    throw new Error(message);
  } else {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
}

function isUrl(v?: string | null) {
  if (!v) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export function validateEnv() {
  const env = process.env;
  const where = (env.NODE_ENV || 'development') === 'production' ? 'production' : 'development';
  const missing: Missing[] = [];

  // Required across the app
  if (!isUrl(env.NEXT_PUBLIC_APP_URL)) missing.push({ key: 'NEXT_PUBLIC_APP_URL', reason: 'must be a valid URL' });
  if (!isUrl(env.NEXT_PUBLIC_SUPABASE_URL)) missing.push({ key: 'NEXT_PUBLIC_SUPABASE_URL', reason: 'must be a valid URL' });
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push({ key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' });

  // OpenRouter (AI) — required for AI features
  if (!env.OPENROUTER_API_KEY) missing.push({ key: 'OPENROUTER_API_KEY' });
  if (!env.OPENROUTER_BASE_URL) missing.push({ key: 'OPENROUTER_BASE_URL', reason: 'suggested default: https://openrouter.ai/api/v1' });
  if (!env.OPENROUTER_MODEL) missing.push({ key: 'OPENROUTER_MODEL', reason: 'e.g. gpt-5-thinking' });

  // Email provider (runtime configurable)
  const provider = (env.EMAIL_PROVIDER || '').toLowerCase();
  if (provider && !['smtp', 'gmail', 'sendgrid'].includes(provider)) {
    missing.push({ key: 'EMAIL_PROVIDER', reason: 'must be smtp|gmail|sendgrid' });
  }
  if (provider) {
    if (!env.EMAIL_FROM) missing.push({ key: 'EMAIL_FROM' });
    if (provider === 'smtp') {
      if (!env.SMTP_HOST) missing.push({ key: 'SMTP_HOST' });
      if (!env.SMTP_PORT) missing.push({ key: 'SMTP_PORT' });
      if (!env.SMTP_USER) missing.push({ key: 'SMTP_USER' });
      if (!env.SMTP_PASS) missing.push({ key: 'SMTP_PASS' });
    } else if (provider === 'gmail') {
      if (!env.GMAIL_USER) missing.push({ key: 'GMAIL_USER' });
      if (!env.GMAIL_APP_PASSWORD) missing.push({ key: 'GMAIL_APP_PASSWORD' });
    } else if (provider === 'sendgrid') {
      if (!env.SENDGRID_API_KEY) missing.push({ key: 'SENDGRID_API_KEY' });
    }
  }

  // Optional but recommended (warn in dev if absent)
  const optional: Missing[] = [];
  if (!env.SENTRY_DSN) optional.push({ key: 'SENTRY_DSN', reason: 'recommended for error tracking' });
  if (!env.SENTRY_ENVIRONMENT) optional.push({ key: 'SENTRY_ENVIRONMENT', reason: 'e.g. production|preview|development' });

  if (missing.length) {
    failOrWarn(missing, where);
  } else if (where === 'development' && optional.length) {
    // eslint-disable-next-line no-console
    console.warn(
      [
        'Optional environment suggestions:',
        ...optional.map((m) => `- ${m.key}${m.reason ? ` (${m.reason})` : ''}`),
      ].join('\n')
    );
  }

  return {
    appUrl: env.NEXT_PUBLIC_APP_URL!,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    emailProvider: provider || undefined,
    emailFrom: env.EMAIL_FROM,
    openrouter: {
      key: env.OPENROUTER_API_KEY!,
      baseUrl: env.OPENROUTER_BASE_URL!,
      model: env.OPENROUTER_MODEL!,
    },
    sentry: {
      dsn: env.SENTRY_DSN,
      env: env.SENTRY_ENVIRONMENT,
    },
    nodeEnv: env.NODE_ENV || 'development',
  };
}

// Execute on import to fail fast for server builds
export const validatedEnv = validateEnv();
