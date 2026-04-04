import { test, expect } from '@playwright/test';

test.describe('UI/UX Verification and Breadcrumb Navigation', () => {
  const baseUrl = 'http://localhost:3000';

  test('Verify breadcrumb navigation on landing page', async ({ page }) => {
    await page.goto(`${baseUrl}/index-new.html`);
    
    // Check if breadcrumb exists
    const breadcrumb = await page.locator('.synthex-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    
    // Verify breadcrumb content
    const breadcrumbText = await breadcrumb.textContent();
    expect(breadcrumbText).toContain('Home');
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/landing-page-breadcrumb.png', fullPage: true });
  });

  test('Verify breadcrumb navigation on app page', async ({ page }) => {
    await page.goto(`${baseUrl}/app.html`);
    
    // Check if breadcrumb exists
    const breadcrumb = await page.locator('.synthex-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    
    // Verify breadcrumb hierarchy
    const breadcrumbItems = await page.locator('.breadcrumb-item').all();
    expect(breadcrumbItems.length).toBeGreaterThan(0);
    
    // Verify Home link exists and is clickable
    const homeLink = await page.locator('.breadcrumb-item a:has-text("Home")');
    await expect(homeLink).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/app-page-breadcrumb.png', fullPage: true });
  });

  test('Verify breadcrumb navigation on dashboard', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard.html`);
    
    // Check if breadcrumb exists
    const breadcrumb = await page.locator('.synthex-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    
    // Verify breadcrumb contains correct path
    const breadcrumbText = await breadcrumb.textContent();
    expect(breadcrumbText).toContain('Home');
    expect(breadcrumbText).toContain('User Dashboard');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-breadcrumb.png', fullPage: true });
  });

  test('Verify breadcrumb navigation on classic dashboard', async ({ page }) => {
    await page.goto(`${baseUrl}/index.html`);
    
    // Check if breadcrumb exists
    const breadcrumb = await page.locator('.synthex-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    
    // Verify breadcrumb contains correct path
    const breadcrumbText = await breadcrumb.textContent();
    expect(breadcrumbText).toContain('Home');
    expect(breadcrumbText).toContain('Classic Dashboard');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/classic-dashboard-breadcrumb.png', fullPage: true });
  });

  test('Check missing UI elements on landing page', async ({ page }) => {
    await page.goto(`${baseUrl}/index-new.html`);
    
    // Check for navigation header
    const header = await page.locator('header, nav').first();
    await expect(header).toBeVisible();
    
    // Check for footer - likely missing
    const footer = await page.locator('footer');
    const footerExists = await footer.count() > 0;
    
    // Check for authentication elements
    const loginButton = await page.locator('button:has-text("Login"), button:has-text("Sign In")');
    await expect(loginButton).toBeVisible();
    
    // Report findings
    console.log('Landing Page UI Elements:');
    console.log('- Header: Present');
    console.log(`- Footer: ${footerExists ? 'Present' : 'MISSING'}`);
    console.log('- Authentication: Present');
  });

  test('Check API connection indicators on app page', async ({ page }) => {
    await page.goto(`${baseUrl}/app.html`);
    
    // Check for loading states
    const loadingIndicators = await page.locator('.loading, .spinner, [class*="load"]').count();
    
    // Check for error message containers
    const errorContainers = await page.locator('.error, .alert, [class*="error"]').count();
    
    // Check for API status indicators
    const statusIndicators = await page.locator('[class*="status"], [class*="connection"]').count();
    
    console.log('App Page API Indicators:');
    console.log(`- Loading states: ${loadingIndicators > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Error containers: ${errorContainers > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Status indicators: ${statusIndicators > 0 ? 'Present' : 'MISSING'}`);
  });

  test('Verify authentication flow elements', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard.html`);
    
    // Check for login form
    const emailInput = await page.locator('input[type="email"], input[name="email"]');
    const passwordInput = await page.locator('input[type="password"]');
    const submitButton = await page.locator('button[type="submit"], button:has-text("Login")');
    
    // Check for Google OAuth
    const googleButton = await page.locator('button:has-text("Google"), button[onclick*="google"]');
    
    // Check for registration link
    const registerLink = await page.locator('a:has-text("Register"), button:has-text("Sign Up")');
    
    console.log('Authentication Elements:');
    console.log(`- Email input: ${await emailInput.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Password input: ${await passwordInput.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Submit button: ${await submitButton.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Google OAuth: ${await googleButton.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Registration: ${await registerLink.count() > 0 ? 'Present' : 'MISSING'}`);
  });

  test('Check content generation form elements', async ({ page }) => {
    await page.goto(`${baseUrl}/app.html`);
    
    // Check for essential form elements
    const contentInput = await page.locator('textarea, input[type="text"][placeholder*="content"]');
    const platformSelect = await page.locator('select, [class*="platform"]');
    const generateButton = await page.locator('button:has-text("Generate")');
    
    // Check for optimization options
    const optimizationOptions = await page.locator('[class*="optimize"], [class*="goal"]');
    
    // Check for history/results section
    const historySection = await page.locator('[class*="history"], [class*="results"]');
    
    console.log('Content Generation Elements:');
    console.log(`- Content input: ${await contentInput.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Platform selector: ${await platformSelect.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Generate button: ${await generateButton.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- Optimization options: ${await optimizationOptions.count() > 0 ? 'Present' : 'MISSING'}`);
    console.log(`- History section: ${await historySection.count() > 0 ? 'Present' : 'MISSING'}`);
  });

  test('Generate comprehensive UI/UX report', async ({ page }) => {
    const pages = [
      { url: '/index-new.html', name: 'Landing Page' },
      { url: '/app.html', name: 'Application' },
      { url: '/dashboard.html', name: 'Dashboard' },
      { url: '/index.html', name: 'Classic Dashboard' }
    ];

    const report = {
      timestamp: new Date().toISOString(),
      pages: []
    };

    for (const pageInfo of pages) {
      await page.goto(`${baseUrl}${pageInfo.url}`);
      
      const pageReport = {
        name: pageInfo.name,
        url: pageInfo.url,
        elements: {
          breadcrumb: await page.locator('.synthex-breadcrumb').count() > 0,
          header: await page.locator('header, nav').first().count() > 0,
          footer: await page.locator('footer').count() > 0,
          forms: await page.locator('form').count(),
          buttons: await page.locator('button').count(),
          links: await page.locator('a').count(),
          images: await page.locator('img').count(),
          loadingStates: await page.locator('.loading, .spinner').count() > 0,
          errorContainers: await page.locator('.error, .alert').count() > 0
        },
        accessibility: {
          altTexts: await page.locator('img[alt]').count(),
          ariaLabels: await page.locator('[aria-label]').count(),
          headings: await page.locator('h1, h2, h3, h4, h5, h6').count()
        }
      };
      
      report.pages.push(pageReport);
    }

    // Save report
    console.log('\n=== COMPREHENSIVE UI/UX REPORT ===\n');
    console.log(JSON.stringify(report, null, 2));
    
    // Summary
    console.log('\n=== SUMMARY OF MISSING ELEMENTS ===\n');
    report.pages.forEach(pageReport => {
      console.log(`\n${pageReport.name} (${pageReport.url}):`);
      if (!pageReport.elements.footer) console.log('  ❌ Missing footer');
      if (!pageReport.elements.loadingStates) console.log('  ❌ Missing loading states');
      if (!pageReport.elements.errorContainers) console.log('  ❌ Missing error containers');
      if (pageReport.elements.breadcrumb) console.log('  ✅ Breadcrumb navigation present');
      if (pageReport.accessibility.altTexts < pageReport.elements.images) {
        console.log(`  ⚠️ Missing alt texts (${pageReport.accessibility.altTexts}/${pageReport.elements.images} images)`);
      }
    });
  });
});