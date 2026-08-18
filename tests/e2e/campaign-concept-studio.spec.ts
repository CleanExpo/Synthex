import { test, expect } from './fixtures/dashboard.fixture';

const CCS_PATH = '/dashboard/campaign-concept-studio';

// Minimal valid API response
const MOCK_SUCCESS_PAYLOAD = {
  concept: {
    concept: 'Launch fast and iterate faster',
    positioning: 'The fastest way to ship a campaign',
    valueProposition: 'Cut campaign prep time in half',
  },
  copyVariants: [
    { headline: 'Ship it today', body: 'Stop planning, start launching.' },
    { headline: 'Move faster', body: 'Built for teams that ship daily.' },
    { headline: 'Launch smarter', body: 'AI does the heavy lifting for you.' },
  ],
  launchChecklist: [
    'Review copy with your legal team',
    'Upload brand assets',
    'Schedule posts at peak times',
    'Set up conversion tracking',
  ],
  imagePrompts: [
    {
      channel: 'instagram',
      prompt: 'Hero shot of modern team working',
      status: 'ready',
      imageUrl: 'https://example.com/image.png',
    },
  ],
  model: { textModel: 'gpt-4o-mini', imageModel: 'dall-e-3' },
  usage: { inputTokens: 100, outputTokens: 400, totalTokens: 500 },
};

test.describe('Campaign Concept Studio — page load', () => {
  test('loads without a server error', async ({ authedDashboard, page }) => {
    const response = await page.goto(CCS_PATH, {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status() ?? 200).toBeLessThan(500);
  });

  test('shows the page heading', async ({ authedDashboard, page }) => {
    await authedDashboard.goto(CCS_PATH);
    const heading = page.locator('h1');
    await expect(heading).toContainText('Campaign Concept Studio');
  });

  test('shows idle output state before any submission', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto(CCS_PATH);
    await expect(page.locator('text=No output yet')).toBeVisible();
  });
});

test.describe('Campaign Concept Studio — form elements', () => {
  test('renders all required form fields', async ({ authedDashboard, page }) => {
    await authedDashboard.goto(CCS_PATH);

    await expect(page.locator('#campaignBrief')).toBeVisible();
    await expect(page.locator('#targetAudience')).toBeVisible();
    await expect(page.locator('#productDetails')).toBeVisible();
    await expect(page.locator('#tone')).toBeVisible();
  });

  test('tone selector has all 7 options', async ({ authedDashboard, page }) => {
    await authedDashboard.goto(CCS_PATH);
    const optionCount = await page.locator('#tone option').count();
    expect(optionCount).toBe(7);
  });

  test('channel buttons render for all 9 channels', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto(CCS_PATH);
    // The 9 channel labels the page renders
    const labels = [
      'Instagram',
      'Facebook',
      'LinkedIn',
      'X (Twitter)',
      'TikTok',
      'YouTube',
      'Threads',
      'Pinterest',
      'Email',
    ];
    for (const label of labels) {
      await expect(
        page.locator(`button:has-text("${label}")`)
      ).toBeVisible();
    }
  });

  test('instagram and linkedin are selected by default', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto(CCS_PATH);
    // Default channels have indigo border class
    const instagram = page.locator('button:has-text("Instagram")');
    const linkedin = page.locator('button:has-text("LinkedIn")');
    await expect(instagram).toHaveClass(/border-indigo/);
    await expect(linkedin).toHaveClass(/border-indigo/);
  });

  test('generate button is disabled when fields are empty', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto(CCS_PATH);
    // Clear the default channel selection so canSubmit is false
    await page.locator('button:has-text("Instagram")').click();
    await page.locator('button:has-text("LinkedIn")').click();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('generate button is disabled when brief is too short', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill('too short');
    await page.locator('#targetAudience').fill('audience ok');
    await page.locator('#productDetails').fill('product details ok here');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('generate button enables when all fields are valid', async ({
    authedDashboard,
    page,
  }) => {
    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );
    // instagram + linkedin already selected by default

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
  });
});

test.describe('Campaign Concept Studio — generation success', () => {
  test('submits form and renders concept output', async ({
    authedDashboard,
    page,
  }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          payload: MOCK_SUCCESS_PAYLOAD,
        }),
      })
    );

    await authedDashboard.goto(CCS_PATH);

    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );

    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('text=Launch fast and iterate faster')
    ).toBeVisible({ timeout: 15000 });
  });

  test('renders three copy variants after generation', async ({
    authedDashboard,
    page,
  }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          payload: MOCK_SUCCESS_PAYLOAD,
        }),
      })
    );

    await authedDashboard.goto(CCS_PATH);

    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );

    await page.locator('button[type="submit"]').click();

    // Wait for concept to appear, then check copy variants
    await page.locator('text=Variant 1').waitFor({ timeout: 15000 });
    await expect(page.locator('text=Variant 1')).toBeVisible();
    await expect(page.locator('text=Variant 2')).toBeVisible();
    await expect(page.locator('text=Variant 3')).toBeVisible();
  });

  test('renders launch checklist after generation', async ({
    authedDashboard,
    page,
  }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          payload: MOCK_SUCCESS_PAYLOAD,
        }),
      })
    );

    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );

    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('text=Review copy with your legal team')
    ).toBeVisible({ timeout: 15000 });
  });

  test('usage tokens appear in output block after generation', async ({
    authedDashboard,
    page,
  }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          payload: MOCK_SUCCESS_PAYLOAD,
        }),
      })
    );

    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );

    await page.locator('button[type="submit"]').click();

    await page.locator('text=Launch fast and iterate faster').waitFor({
      timeout: 15000,
    });
    await expect(page.locator('text=Text model: gpt-4o-mini')).toBeVisible();
  });
});

test.describe('Campaign Concept Studio — error handling', () => {
  test('shows error banner on API failure', async ({
    authedDashboard,
    page,
  }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'OpenAI gateway unavailable' }),
      })
    );

    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Generation failed')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator('text=OpenAI gateway unavailable')
    ).toBeVisible();
  });

  test('reset button clears error and returns to idle', async ({
    authedDashboard,
    page,
  }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Gateway error' }),
      })
    );

    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );
    await page.locator('button[type="submit"]').click();
    await page.locator('text=Generation failed').waitFor({ timeout: 10000 });

    await page.locator('button:has-text("Reset")').click();

    await expect(page.locator('text=Generation failed')).not.toBeVisible();
    await expect(page.locator('text=No output yet')).toBeVisible();
  });

  test('shows rate-limit message on 429', async ({ authedDashboard, page }) => {
    await page.route('**/api/campaign-concept-studio/generate', route =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error:
            'Request limit exceeded. Please wait before generating another campaign concept.',
        }),
      })
    );

    await authedDashboard.goto(CCS_PATH);
    await page.locator('#campaignBrief').fill(
      'Launch our new productivity tool for remote teams this spring.'
    );
    await page.locator('#targetAudience').fill('Founders and marketers');
    await page.locator('#productDetails').fill(
      'An all-in-one campaign workspace that reduces launch prep time by 60%.'
    );
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Request limit exceeded')).toBeVisible({
      timeout: 10000,
    });
  });
});
