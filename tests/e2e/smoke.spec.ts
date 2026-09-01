import { test, expect } from '@playwright/test';

// Core public routes only
const PAGES = ['/', '/login', '/signup'];
const APIS = ['/api/health'];

test.describe('Route & API smoke', () => {
  test('pages render without runtime errors', async ({ page }) => {
    // Known non-fatal patterns for a LOCAL dev server with no third-party
    // services configured.
    //
    // WHAT WAS REMOVED, AND WHY. This list previously also ignored /500/,
    // /503/, /undefined/i, /Minified React error/i, /Cannot read properties
    // of/i and /hydration/i. Those are not dev noise - they are the exact
    // console signatures of the bugs a smoke test exists to catch. With them
    // present, a page could throw "Cannot read properties of undefined" on
    // every render and this test still passed. An ignore list that covers the
    // failure modes leaves a test that cannot fail.
    //
    // 401/403/404 stay ignored: unauthenticated API calls legitimately return
    // those locally. The rest are genuine environment noise.
    const IGNORED_PATTERNS = [
      /Failed to fetch/i,
      /NetworkError/i,
      /401/,
      /403/,
      /404/,
      /ERR_/i,
      /favicon/i,
      /NEXT_REDIRECT/i,
      /AbortError/i,
      /signal is aborted/i,
      /Source map error/i,
      /DevTools/i,
      /ResizeObserver/i,
      /Loading chunk/i,
      /WebSocket/i,
      /socket/i,
    ];

    // Collect console errors (non-blocking)
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const isKnown = IGNORED_PATTERNS.some(p => p.test(text));
        if (!isKnown) errors.push(text);
      }
    });

    for (const path of PAGES) {
      try {
        const response = await page.goto(path, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

        // A public page must actually render: 2xx, or a 3xx redirect that
        // Playwright has already followed.
        //
        // This used to be `expect(status).toBeGreaterThanOrEqual(100)`, which
        // every valid HTTP response satisfies - a 500 on the homepage passed.
        // The lowest possible status IS 100, so the assertion was equivalent to
        // no assertion at all.
        const status = response?.status() ?? 0;
        expect(status, `${path} returned ${status}`).toBeGreaterThanOrEqual(
          200
        );
        expect(status, `${path} returned ${status}`).toBeLessThan(400);

        // Brief check that body exists
        const hasBody = await page
          .locator('body')
          .isVisible()
          .catch(() => false);
        expect(hasBody).toBeTruthy();
      } catch (e) {
        // A page that aborts or times out is a FAILED smoke, not a tolerated one.
        //
        // This catch used to swallow ERR_ABORTED and timeouts into
        // `expect(page.url()).toBeTruthy()`. page.url() returns the REQUESTED
        // url even when no response ever arrived, so that assertion could not
        // fail - it bypassed every status and body assertion above it, and made
        // them decorative for the one failure mode they most needed to catch.
        //
        // Measured, not assumed: against a server that accepts the connection
        // and never responds, this test PASSED in 3.1 minutes with the old
        // catch. Retained as the hang fixture in the verification notes.
        //
        // Playwright follows redirects during goto(), so a redirect does not
        // surface here. What surfaces is a genuine hang or abort.
        //
        // An assertion failure from the block above is already precise, so it is
        // rethrown untouched - otherwise "/ returned 500" would be relabelled as
        // "did not load", which describes the wrong defect to whoever is paged.
        if (e && typeof e === 'object' && 'matcherResult' in e) throw e;
        throw new Error(
          `${path} did not load: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`
        );
      }
    }

    // Only fail on unexpected console errors
    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      []
    );
  });

  test('APIs respond (2xx, 3xx, or expected 4xx/5xx)', async ({ request }) => {
    for (const api of APIS) {
      try {
        const res = await request.get(api, { timeout: 30000 });
        // /api/health answers 200 when healthy and 503 when a subsystem is
        // down. Locally, with no third-party services configured, 503 is a
        // legitimate answer - but 500, 404 or anything else is not.
        //
        // Previously this accepted `>= 100`, i.e. every possible response, so
        // a health endpoint returning 500 counted as a pass.
        expect([200, 503], `${api} returned ${res.status()}`).toContain(
          res.status()
        );
      } catch (e) {
        // A health endpoint that never answers is a production-breaking
        // condition, not evidence that "the server exists but is slow".
        //
        // This used to convert a timeout into `expect(true).toBeTruthy()`, an
        // assertion with no possible failure. The [200, 503] allow-list above
        // was therefore never reached on the single failure mode that matters
        // most - a health check that hangs.
        //
        // Measured: against a server that never responds, this test PASSED in
        // 30.0s with the old catch.
        //
        // A status assertion that already failed is rethrown untouched; only a
        // genuine no-response is relabelled.
        if (e && typeof e === 'object' && 'matcherResult' in e) throw e;
        throw new Error(
          `${api} did not respond: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`
        );
      }
    }
  });

  test('dashboard access unauthenticated -> redirect or login gate', async ({
    page,
  }) => {
    const resp = await page.goto('/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Either redirect occurred or we landed on dashboard. If redirect, we expect /login route.
    const url = page.url();
    const redirectedToLogin = url.includes('/login');
    const status = resp?.status();
    const ok = redirectedToLogin || (status && status < 400);
    expect(ok).toBeTruthy();
  });
});
