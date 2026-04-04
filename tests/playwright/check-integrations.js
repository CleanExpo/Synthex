const { chromium } = require('playwright');

async function checkIntegrationsPage() {
  const browser = await chromium.launch({ 
    headless: false,
    timeout: 60000 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('🔍 Starting site navigation test...\n');
  
  try {
    // Wait for dev server to be ready
    console.log('⏳ Waiting for dev server to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Navigate to homepage (using production URL)
    console.log('📍 Navigating to homepage...');
    const siteUrl = 'https://synthex-hm6lvib66-unite-group.vercel.app';
    await page.goto(siteUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Take screenshot of homepage
    await page.screenshot({ 
      path: 'tests/playwright/screenshots/homepage.png',
      fullPage: true 
    });
    console.log('✅ Homepage loaded and screenshot taken');
    
    // Navigate to dashboard
    console.log('\n📍 Navigating to dashboard...');
    await page.goto(`${siteUrl}/dashboard`, { 
      waitUntil: 'domcontentloaded' 
    });
    
    // Check if login redirect happens
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('🔐 Redirected to login page - need authentication');
      
      // Try to find and click demo/test login if available
      const demoButton = await page.locator('button:has-text("Demo"), button:has-text("Test"), a:has-text("Demo")').first();
      if (await demoButton.count() > 0) {
        console.log('🔑 Found demo login option, clicking...');
        await demoButton.click();
        await page.waitForURL('**/dashboard**', { timeout: 5000 }).catch(() => {});
      }
    }
    
    // Navigate to integrations page
    console.log('\n📍 Navigating to integrations page...');
    await page.goto(`${siteUrl}/dashboard/integrations`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.screenshot({ 
      path: 'tests/playwright/screenshots/integrations.png',
      fullPage: true 
    });
    console.log('✅ Integrations page loaded');
    
    // Find all integration cards/buttons
    console.log('\n🔍 Analyzing integration elements...');
    
    // Try different selectors for integration items
    const integrationSelectors = [
      '.integration-card',
      '[data-integration]',
      'button:has-text("Connect")',
      'button:has-text("Install")',
      'button:has-text("Enable")',
      '.card:has-text("Instagram")',
      '.card:has-text("TikTok")',
      '.card:has-text("Twitter")',
      'div[class*="card"]',
      'div[class*="integration"]',
      'button[class*="integration"]'
    ];
    
    let foundIntegrations = [];
    
    for (const selector of integrationSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`  Found ${elements.length} elements matching "${selector}"`);
        for (const element of elements) {
          const text = await element.textContent().catch(() => '');
          const isVisible = await element.isVisible().catch(() => false);
          
          if (isVisible && text) {
            foundIntegrations.push({
              selector,
              text: text.trim().substring(0, 100),
              element
            });
          }
        }
      }
    }
    
    console.log(`\n📊 Found ${foundIntegrations.length} integration elements total`);
    
    // Test clicking on integrations
    console.log('\n🖱️ Testing integration clicks...');
    
    for (let i = 0; i < Math.min(3, foundIntegrations.length); i++) {
      const integration = foundIntegrations[i];
      console.log(`\n  Testing: "${integration.text.substring(0, 50)}..."`);
      
      try {
        // Check if element has click handlers
        const hasClickHandler = await page.evaluate(el => {
          const events = el._events || {};
          return Object.keys(events).some(key => key.includes('click')) || 
                 el.onclick !== null ||
                 el.getAttribute('onclick') !== null;
        }, await integration.element.elementHandle());
        
        console.log(`    Has click handler: ${hasClickHandler}`);
        
        // Try clicking
        await integration.element.click({ timeout: 2000 });
        
        // Wait to see if anything happens
        await page.waitForTimeout(1000);
        
        // Check if URL changed
        const newUrl = page.url();
        if (newUrl !== `${siteUrl}/dashboard/integrations`) {
          console.log(`    ✅ Navigated to: ${newUrl}`);
        } else {
          // Check if modal opened
          const modal = await page.locator('.modal, [role="dialog"], .dialog, .popup').first();
          if (await modal.count() > 0 && await modal.isVisible()) {
            console.log(`    ✅ Modal/dialog opened`);
            // Close modal if possible
            const closeButton = await page.locator('.modal button:has-text("Close"), .modal button:has-text("Cancel"), .modal button[aria-label*="close"]').first();
            if (await closeButton.count() > 0) {
              await closeButton.click();
            }
          } else {
            console.log(`    ❌ No action detected - element might be missing click handler`);
          }
        }
      } catch (error) {
        console.log(`    ❌ Error testing click: ${error.message}`);
      }
    }
    
    // Check for other interactive elements
    console.log('\n🔍 Checking other interactive elements...');
    
    const interactiveSelectors = {
      'Buttons': 'button:visible',
      'Links': 'a[href]:visible',
      'Inputs': 'input:visible',
      'Selects': 'select:visible'
    };
    
    for (const [type, selector] of Object.entries(interactiveSelectors)) {
      const count = await page.locator(selector).count();
      console.log(`  ${type}: ${count} found`);
      
      if (count > 0 && type === 'Buttons') {
        const buttons = await page.locator(selector).all();
        const buttonTexts = [];
        for (let i = 0; i < Math.min(5, buttons.length); i++) {
          const text = await buttons[i].textContent();
          if (text && text.trim()) {
            buttonTexts.push(text.trim());
          }
        }
        console.log(`    Sample buttons: ${buttonTexts.join(', ')}`);
      }
    }
    
    // Navigate to other pages to check
    const pagesToCheck = [
      '/dashboard/analytics',
      '/dashboard/content',
      '/dashboard/schedule',
      '/dashboard/team',
      '/dashboard/settings'
    ];
    
    console.log('\n📍 Checking other dashboard pages...');
    
    for (const pagePath of pagesToCheck) {
      try {
        await page.goto(`${siteUrl}${pagePath}`, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        
        const pageTitle = await page.title();
        const heading = await page.locator('h1, h2').first().textContent().catch(() => 'No heading');
        
        console.log(`  ${pagePath}: ${heading}`);
        
        // Check for broken elements
        const brokenImages = await page.locator('img[src=""], img:not([src])').count();
        const emptyButtons = await page.locator('button:empty').count();
        
        if (brokenImages > 0) {
          console.log(`    ⚠️ Found ${brokenImages} broken images`);
        }
        if (emptyButtons > 0) {
          console.log(`    ⚠️ Found ${emptyButtons} empty buttons`);
        }
      } catch (error) {
        console.log(`  ${pagePath}: ❌ Failed to load - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    console.log('\n🏁 Test complete. Browser will remain open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

// Run the test
checkIntegrationsPage().catch(console.error);