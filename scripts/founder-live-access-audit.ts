import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { chromium, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'https://synthex.social';
const OUTPUT_DIR =
  process.env.FOUNDER_AUDIT_OUTPUT_DIR ??
  '/private/tmp/synthex-founder-live-audit';

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/settings',
  '/dashboard/settings/billing',
  '/dashboard/billing',
  '/dashboard/businesses',
  '/dashboard/integrations',
  '/dashboard/content/drafts',
  '/dashboard/calendar',
  '/dashboard/marketing-agency',
  '/dashboard/marketing-agency/ccw-eofy',
  '/dashboard/ai-chat',
  '/dashboard/ai-images',
  '/dashboard/workflows',
  '/dashboard/insights',
  '/dashboard/forecasting',
  '/dashboard/seo',
  '/dashboard/geo',
  '/dashboard/authority',
] as const;

const BLOCKER_TEXT_PATTERNS = [
  /update for full access/i,
  /upgrade your plan/i,
  /upgrade to (professional|pro|business|scale)/i,
  /unlock premium features/i,
  /requires? (a )?(professional|pro|business|scale) plan/i,
  /free plan/i,
  /upgrade required/i,
  /payment required/i,
];

type AuditRouteResult = {
  route: string;
  finalUrl: string;
  status: number | null;
  redirectedToLogin: boolean;
  blockerText: string[];
  apiErrors: Array<{ status: number; url: string }>;
  consoleErrors: string[];
  pageErrors: string[];
  screenshot?: string;
};

type OwnerRow = {
  id: string;
  email: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function maskEmail(email: string): string {
  return email.replace(/^(.).*(@.*)$/, '$1***$2');
}

function originFromBaseUrl(): string {
  return new URL(BASE_URL).origin;
}

function cookieDomain(): string {
  return new URL(BASE_URL).hostname;
}

async function getOwnerUser(): Promise<OwnerRow> {
  const ownerEmails = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (ownerEmails.length === 0) {
    throw new Error('OWNER_EMAILS is empty');
  }

  const client = new pg.Client({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query<OwnerRow>(
      'select id, email from users where lower(email)=any($1::text[]) order by created_at desc limit 1',
      [ownerEmails]
    );
    if (!result.rows[0]) throw new Error('No owner user found');
    return result.rows[0];
  } finally {
    await client.end();
  }
}

function createOwnerToken(owner: OwnerRow): string {
  return jwt.sign(
    {
      userId: owner.id,
      email: owner.email,
      iat: Math.floor(Date.now() / 1000),
    },
    requireEnv('JWT_SECRET'),
    { expiresIn: '10m' }
  );
}

async function getBodyText(page: Page): Promise<string> {
  return page
    .locator('body')
    .innerText({ timeout: 5_000 })
    .catch(() => '');
}

function findBlockerText(bodyText: string): string[] {
  return BLOCKER_TEXT_PATTERNS.filter(pattern => pattern.test(bodyText)).map(
    pattern => pattern.source
  );
}

async function auditRoute(
  route: string,
  context: BrowserContext
): Promise<AuditRouteResult> {
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(15_000);
  page.setDefaultTimeout(5_000);

  const apiErrors: Array<{ status: number; url: string }> = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const origin = originFromBaseUrl();
  const targetUrl = new URL(route, BASE_URL).toString();
  let status: number | null = null;
  let finalUrl = targetUrl;
  let bodyText = '';

  const onResponse = (response: {
    status: () => number;
    url: () => string;
  }) => {
    const status = response.status();
    const url = response.url();
    if (
      status >= 400 &&
      url.startsWith(origin) &&
      !url.includes('/api/monitoring/sentry-tunnel')
    ) {
      apiErrors.push({ status, url });
    }
  };

  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };

  const onPageError = (error: Error) => {
    pageErrors.push(error.message);
  };

  page.on('response', onResponse);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    status = response?.status() ?? null;
    await page.waitForTimeout(2_000);
    finalUrl = page.url();
    bodyText = await getBodyText(page);
  } catch (error) {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  } finally {
    page.off('response', onResponse);
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  const redirectedToLogin = finalUrl.includes('/login');
  const blockerText = findBlockerText(bodyText);

  const result: AuditRouteResult = {
    route,
    finalUrl,
    status,
    redirectedToLogin,
    blockerText,
    apiErrors,
    consoleErrors,
    pageErrors,
  };

  const failed =
    redirectedToLogin ||
    blockerText.length > 0 ||
    apiErrors.length > 0 ||
    pageErrors.length > 0;
  if (failed) {
    const name =
      route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'root';
    const screenshot = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    result.screenshot = screenshot;
  }

  await page.close().catch(() => {});
  return result;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const owner = await getOwnerUser();
  const token = createOwnerToken(owner);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      {
        name: 'auth-token',
        value: token,
        domain: cookieDomain(),
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const results: AuditRouteResult[] = [];
    for (const route of DASHBOARD_ROUTES) {
      results.push(await auditRoute(route, context));
    }

    const failed = results.filter(
      result =>
        result.redirectedToLogin ||
        result.blockerText.length > 0 ||
        result.apiErrors.length > 0 ||
        result.pageErrors.length > 0
    );

    const report = {
      baseUrl: BASE_URL,
      auditedAt: new Date().toISOString(),
      owner: {
        id: owner.id,
        emailMasked: maskEmail(owner.email),
      },
      routeCount: results.length,
      failureCount: failed.length,
      results,
    };

    const reportPath = path.join(OUTPUT_DIR, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(
      JSON.stringify(
        {
          status: failed.length === 0 ? 'pass' : 'fail',
          routeCount: results.length,
          failureCount: failed.length,
          reportPath,
          failures: failed.map(result => ({
            route: result.route,
            finalUrl: result.finalUrl,
            status: result.status,
            redirectedToLogin: result.redirectedToLogin,
            blockerText: result.blockerText,
            apiErrors: result.apiErrors.slice(0, 10),
            pageErrors: result.pageErrors,
            screenshot: result.screenshot,
          })),
        },
        null,
        2
      )
    );

    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
