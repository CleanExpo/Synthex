/**
 * White Rabbit card → learning loop, end to end, on an ISOLATED local stack.
 *
 *   1. npx tsx scripts/learning-loop/seed-dev.ts      (localhost database only)
 *   2. JWT_SECRET=<local> npx next dev --webpack -p 3002
 *   3. PW_SKIP_WEBSERVER=1 BASE_URL=http://localhost:3002 JWT_SECRET=<same> \
 *        npx playwright test tests/e2e/card-white-rabbit.spec.ts --project=chromium
 *
 * Skips unless E2E_LEARNING_LOOP=1, so the shared suite never runs it against
 * a database without the synthetic seed. Data written here is preview data on
 * a seeded organisation, never a customer result.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

const SHOTS = process.env.E2E_SHOTS_DIR;
test.skip(
  process.env.E2E_LEARNING_LOOP !== '1',
  'Set E2E_LEARNING_LOOP=1 with the seeded local stack'
);

test('visitor gets a useful action before any ask, then saves the contact', async ({
  page,
  request,
}) => {
  await page.goto('/card/phill?variant=story');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Follow the White Rabbit' })
  ).toBeVisible();
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/1-card-home.png`, fullPage: true });

  await page.getByRole('button', { name: /^DISCOVER/ }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0); // no email or any other field is asked for
  await page
    .getByRole('button', { name: 'I do not get enough reviews' })
    .click();
  await expect(page.getByTestId('action')).toContainText(
    'Text each customer your direct review link'
  );
  await page.getByRole('button', { name: 'Yes, useful' }).click();
  await expect(page.getByRole('status').first()).toContainText(
    'Thanks — noted'
  );
  await expect(page.getByTestId('recording')).not.toContainText('off');
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/2-discover-useful.png`,
      fullPage: true,
    });

  await page.getByRole('button', { name: 'Save my details' }).click();
  const save = page.getByRole('link', { name: /Save contact/ });
  await expect(save).toHaveAttribute('href', '/api/card/phill/vcard');
  await expect(page.getByRole('link', { name: 'Synthex' })).toBeVisible();
  await expect(page.getByText('Unpublished brand (hidden)')).toHaveCount(0);
  const vcard = await request.get('/api/card/phill/vcard');
  expect(vcard.headers()['content-type']).toContain('text/vcard');
  const text = await vcard.text();
  expect(text).toContain('FN:Phill McGurk');
  expect(text).not.toContain('example.invalid/hidden');
  await save.click();
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/3-connect.png`, fullPage: true });

  await page.getByRole('button', { name: 'Back to the three doors' }).click();
  await page.getByRole('button', { name: /^SOLVE/ }).click();
  await expect(page.getByTestId('solve-held')).toContainText(
    'opens once the deck, the prize rules and the music are confirmed'
  );
});

test('card doors have no serious or critical axe violations (WCAG 2.1 AA)', async ({
  page,
}) => {
  for (const door of [null, /^DISCOVER/, /^CONNECT/, /^SOLVE/]) {
    await page.goto('/card/phill?variant=plain');
    if (door) await page.getByRole('button', { name: door }).click();
    if (door?.source === '^DISCOVER')
      await page
        .getByRole('button', { name: 'Locals cannot find me on Google Maps' })
        .click();
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const bad = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(bad.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
});

test('owner sees the observed outcome and recommendation, then records the decision', async ({
  page,
  context,
  baseURL,
}) => {
  const secret = process.env.JWT_SECRET;
  expect(
    secret,
    'JWT_SECRET must be set to the local dev server value; a skip here would be a vacuous pass'
  ).toBeTruthy();
  const token = jwt.sign(
    {
      userId: 'seed-user-phill',
      email: 'phill.seed@example.invalid',
      onboardingComplete: true,
    },
    secret!,
    { expiresIn: '1h' }
  );
  await context.addCookies([
    { name: 'auth-token', value: token, url: baseURL! },
  ]);

  await page.goto(
    '/dashboard/learning-loop?experimentId=exp-white-rabbit-front-door'
  );
  await expect(
    page.getByRole('heading', {
      name: /Learning loop: exp-white-rabbit-front-door/,
    })
  ).toBeVisible();
  await expect(
    page.getByText(/not launched — events are preview data/)
  ).toBeVisible();
  await page.getByRole('button', { name: 'Snapshot outcome' }).click();
  await expect(page.getByRole('status').first()).toContainText(
    'Outcome snapshot recorded'
  );
  await expect(
    page.getByRole('button', { name: 'Record decision' })
  ).toBeEnabled();
  await expect(page.getByTestId('outcome')).toContainText('preview');
  await expect(page.getByTestId('recommendation')).toContainText(
    'continue_observing'
  );

  await page
    .getByLabel('Rationale')
    .fill(
      'Preview sessions prove the loop works; there is no customer result yet.'
    );
  await page
    .getByLabel('Next decision and who must make it')
    .fill('Phill decides whether to launch the pilot at the next event.');
  await page.getByRole('button', { name: 'Record decision' }).click();
  await expect(page.getByRole('status').first()).toContainText(
    'Decision recorded'
  );
  await expect(page.getByTestId('decision').last()).toContainText(
    'continue_observing'
  );
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/4-owner-loop.png`,
      fullPage: true,
    });
  // Scoped to this page's content: the shared dashboard shell has its own pre-existing contrast findings.
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="learning-loop"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    axe.violations
      .filter(v => v.impact === 'serious' || v.impact === 'critical')
      .map(v => `${v.id}: ${v.nodes.length}`)
  ).toEqual([]);
});

test('a collaborator can see the loop but cannot record the decision', async ({
  page,
  context,
  baseURL,
  request,
}) => {
  const secret = process.env.JWT_SECRET;
  expect(
    secret,
    'JWT_SECRET must be set to the local dev server value; a skip here would be a vacuous pass'
  ).toBeTruthy();
  const token = jwt.sign(
    { userId: 'seed-user-collab', onboardingComplete: true },
    secret!,
    { expiresIn: '1h' }
  );
  await context.addCookies([
    { name: 'auth-token', value: token, url: baseURL! },
  ]);
  await page.goto(
    '/dashboard/learning-loop?experimentId=exp-white-rabbit-front-door'
  );
  await expect(
    page.getByText('Only the organisation owner can record the decision.')
  ).toBeVisible();
  const res = await request.post('/api/learning-loop/decision', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      experimentId: 'exp-white-rabbit-front-door',
      recommendationEventId: 'x',
      decision: 'keep',
      rationale: 'collaborator attempt',
      nextDecision: 'none really',
    },
  });
  expect(res.status()).toBe(403);
});
