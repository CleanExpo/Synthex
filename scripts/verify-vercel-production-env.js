#!/usr/bin/env node

/**
 * Verify Vercel production environment variable metadata without printing
 * secret values.
 *
 * This checks names and targets only. It does not pull env values and must stay
 * safe to paste into release evidence.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'CRON_SECRET',
  'OAUTH_STATE_SECRET',
  'FIELD_ENCRYPTION_KEY',
  'JOURNEY_PIXEL_SIGNING_KEY_PRIMARY',
  'OWNER_EMAILS',
  'OPENROUTER_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
];

const RECOMMENDED_GROUPS = [
  {
    name: 'AI provider fallbacks',
    keys: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
    description: 'fallback/direct AI provider coverage beyond OpenRouter',
  },
  {
    name: 'Email delivery',
    anyOf: ['RESEND_API_KEY', 'SENDGRID_API_KEY', 'SMTP_HOST'],
    description: 'at least one transactional email provider',
  },
  {
    name: 'Google/YouTube integrations',
    keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    description: 'Google OAuth and YouTube fallback provider credentials',
  },
  {
    name: 'Twitter/X integrations',
    keys: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    description: 'Twitter/X OAuth provider credentials',
  },
  {
    name: 'LinkedIn integrations',
    keys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    description: 'LinkedIn OAuth provider credentials',
  },
  {
    name: 'Meta integrations',
    anyOf: ['META_CLIENT_ID', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_APP_ID'],
    description: 'Meta/Facebook/Instagram OAuth app identity',
  },
  {
    name: 'Meta integration secret',
    anyOf: ['META_CLIENT_SECRET', 'FACEBOOK_CLIENT_SECRET', 'FACEBOOK_APP_SECRET'],
    description: 'Meta/Facebook/Instagram OAuth app secret',
  },
  {
    name: 'Creative intelligence providers',
    keys: ['APIFY_API_TOKEN', 'HEYGEN_API_KEY'],
    description: 'research and generated-video provider credentials',
  },
];

function parseArgs(argv) {
  const args = {
    scope: 'unite-group',
    target: 'production',
    project: null,
    jsonFile: null,
    strictRecommended: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scope') args.scope = argv[++i];
    else if (arg === '--target') args.target = argv[++i];
    else if (arg === '--project') args.project = argv[++i];
    else if (arg === '--json-file') args.jsonFile = argv[++i];
    else if (arg === '--strict-recommended') args.strictRecommended = true;
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printUsage() {
  console.log(`Usage: node scripts/verify-vercel-production-env.js [options]

Options:
  --scope <team>             Vercel team scope (default: unite-group)
  --target <target>          Vercel env target (default: production)
  --project <project>        Optional Vercel project name/id
  --json-file <path>         Read saved vercel env JSON instead of invoking CLI
  --strict-recommended       Fail when recommended provider groups are missing
`);
}

function loadMetadata(args) {
  if (args.jsonFile) {
    return readFileSync(args.jsonFile, 'utf8');
  }

  const vercelArgs = [
    'env',
    'ls',
    args.target,
    '--scope',
    args.scope,
    '--non-interactive',
    '--format',
    'json',
  ];

  if (args.project) {
    vercelArgs.push(args.project);
  }

  return execFileSync('vercel', vercelArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseVercelJson(raw) {
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('Vercel output did not contain JSON');
  }

  return JSON.parse(raw.slice(jsonStart));
}

function envTargetsInclude(env, target) {
  return Array.isArray(env.target) && env.target.includes(target);
}

function summarizeEnv(env) {
  return {
    key: env.key,
    type: env.type || 'unknown',
    target: Array.isArray(env.target) ? env.target.join(',') : 'unknown',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = loadMetadata(args);
  const parsed = parseVercelJson(raw);
  const envs = Array.isArray(parsed.envs) ? parsed.envs : [];
  const productionEnvs = envs.filter((env) => envTargetsInclude(env, args.target));
  const envByKey = new Map(productionEnvs.map((env) => [env.key, env]));

  const missingRequired = REQUIRED_ENV.filter((key) => !envByKey.has(key));
  const presentRequired = REQUIRED_ENV.filter((key) => envByKey.has(key));

  const recommendedResults = RECOMMENDED_GROUPS.map((group) => {
    const keys = group.keys || group.anyOf || [];
    const present = keys.filter((key) => envByKey.has(key));
    const missing = keys.filter((key) => !envByKey.has(key));
    const ok = group.anyOf ? present.length > 0 : missing.length === 0;
    return { ...group, present, missing, ok };
  });

  const missingRecommended = recommendedResults.filter((group) => !group.ok);

  console.log(`Synthex Vercel env metadata check: target=${args.target}, scope=${args.scope}`);
  console.log(`Observed env names for target: ${productionEnvs.length}`);
  console.log('');

  console.log(`Required: ${presentRequired.length}/${REQUIRED_ENV.length} present`);
  for (const key of presentRequired) {
    const env = summarizeEnv(envByKey.get(key));
    console.log(`PASS ${env.key} (${env.type}; targets=${env.target})`);
  }

  for (const key of missingRequired) {
    console.log(`FAIL ${key} missing from ${args.target}`);
  }

  console.log('');
  console.log(`Recommended provider groups: ${recommendedResults.length - missingRecommended.length}/${recommendedResults.length} complete`);
  for (const group of recommendedResults) {
    if (group.ok) {
      console.log(`PASS ${group.name}: ${group.present.join(', ')}`);
    } else {
      const expected = group.keys ? group.keys.join(', ') : `one of ${group.anyOf.join(', ')}`;
      console.log(`WARN ${group.name}: missing ${expected} (${group.description})`);
    }
  }

  console.log('');
  console.log('Secret values were not requested or printed.');

  if (missingRequired.length > 0 || (args.strictRecommended && missingRecommended.length > 0)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
