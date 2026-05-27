#!/usr/bin/env node

/**
 * Verify Vercel production environment variable metadata without printing
 * secret values.
 *
 * This checks names and targets only. It does not pull env values and must stay
 * safe to paste into release evidence.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
    anyOf: [
      'META_CLIENT_SECRET',
      'FACEBOOK_CLIENT_SECRET',
      'FACEBOOK_APP_SECRET',
    ],
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
  --project <project>        Assert the linked Vercel project name/id
  --json-file <path>         Read saved vercel env JSON instead of invoking CLI
  --strict-recommended       Fail when recommended provider groups are missing
`);
}

function verifyLinkedProject(expectedProject, cwd = process.cwd()) {
  if (!expectedProject) return;

  const projectFile = resolve(cwd, '.vercel/project.json');
  if (!existsSync(projectFile)) {
    throw new Error(
      `--project ${expectedProject} was provided, but ${projectFile} does not exist. Run this from a linked Vercel project.`
    );
  }

  const linkedProject = JSON.parse(readFileSync(projectFile, 'utf8'));
  const matches =
    linkedProject.projectName === expectedProject ||
    linkedProject.projectId === expectedProject;

  if (!matches) {
    throw new Error(
      `Linked Vercel project mismatch: expected ${expectedProject}, found ${linkedProject.projectName || 'unknown'} (${linkedProject.projectId || 'unknown id'})`
    );
  }
}

function loadMetadata(args) {
  if (args.jsonFile) {
    return readFileSync(args.jsonFile, 'utf8');
  }

  verifyLinkedProject(args.project);

  const vercelArgs = buildVercelArgs(args);

  return execFileSync('vercel', vercelArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function buildVercelArgs(args) {
  return [
    'env',
    'ls',
    '--scope',
    args.scope,
    '--non-interactive',
    '--format',
    'json',
  ];
}

function parseVercelJson(raw) {
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('Vercel output did not contain JSON');
  }

  return JSON.parse(raw.slice(jsonStart));
}

function normalizeEnvTarget(env) {
  if (Array.isArray(env.target)) return env.target;
  if (typeof env.target === 'string') return [env.target];
  if (Array.isArray(env.targets)) return env.targets;
  if (typeof env.environment === 'string') return [env.environment];
  return [];
}

function envTargetsInclude(env, target) {
  return normalizeEnvTarget(env).includes(target);
}

function summarizeEnv(env) {
  return {
    key: env.key,
    type: env.type || 'unknown',
    target: normalizeEnvTarget(env).join(',') || 'unknown',
  };
}

function countTargets(
  envs,
  targets = ['production', 'preview', 'development']
) {
  return Object.fromEntries(
    targets.map(target => [
      target,
      envs.filter(env => envTargetsInclude(env, target)).length,
    ])
  );
}

function buildReport(args, raw) {
  const parsed = parseVercelJson(raw);
  const envs = Array.isArray(parsed.envs) ? parsed.envs : [];
  const targetEnvs = envs.filter(env => envTargetsInclude(env, args.target));
  const envByKey = new Map(targetEnvs.map(env => [env.key, env]));

  const missingRequired = REQUIRED_ENV.filter(key => !envByKey.has(key));
  const presentRequired = REQUIRED_ENV.filter(key => envByKey.has(key));

  const recommendedResults = RECOMMENDED_GROUPS.map(group => {
    const keys = group.keys || group.anyOf || [];
    const present = keys.filter(key => envByKey.has(key));
    const missing = keys.filter(key => !envByKey.has(key));
    const ok = group.anyOf ? present.length > 0 : missing.length === 0;
    return { ...group, present, missing, ok };
  });

  const missingRecommended = recommendedResults.filter(group => !group.ok);

  return {
    envs,
    targetEnvs,
    targetCounts: countTargets(envs),
    presentRequired,
    missingRequired,
    recommendedResults,
    missingRecommended,
    envByKey,
  };
}

function printReport(args, report) {
  console.log(
    `Synthex Vercel env metadata check: target=${args.target}, scope=${args.scope}`
  );
  if (args.project) {
    console.log(`Linked project assertion: ${args.project}`);
  }
  console.log(`Observed env names for target: ${report.targetEnvs.length}`);
  console.log(
    `Target counts: production=${report.targetCounts.production}, preview=${report.targetCounts.preview}, development=${report.targetCounts.development}`
  );
  console.log('');

  console.log(
    `Required: ${report.presentRequired.length}/${REQUIRED_ENV.length} present`
  );
  for (const key of report.presentRequired) {
    const env = summarizeEnv(report.envByKey.get(key));
    console.log(`PASS ${env.key} (${env.type}; targets=${env.target})`);
  }

  for (const key of report.missingRequired) {
    console.log(`FAIL ${key} missing from ${args.target}`);
  }

  console.log('');
  console.log(
    `Recommended provider groups: ${report.recommendedResults.length - report.missingRecommended.length}/${report.recommendedResults.length} complete`
  );
  for (const group of report.recommendedResults) {
    if (group.ok) {
      console.log(`PASS ${group.name}: ${group.present.join(', ')}`);
    } else {
      const expected = group.keys
        ? group.keys.join(', ')
        : `one of ${group.anyOf.join(', ')}`;
      console.log(
        `WARN ${group.name}: missing ${expected} (${group.description})`
      );
    }
  }

  console.log('');
  console.log('Secret values were not requested or printed.');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const raw = loadMetadata(args);
  const report = buildReport(args, raw);
  printReport(args, report);

  if (
    report.missingRequired.length > 0 ||
    (args.strictRecommended && report.missingRecommended.length > 0)
  ) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export {
  REQUIRED_ENV,
  RECOMMENDED_GROUPS,
  buildReport,
  buildVercelArgs,
  countTargets,
  envTargetsInclude,
  normalizeEnvTarget,
  parseArgs,
  parseVercelJson,
  verifyLinkedProject,
};
