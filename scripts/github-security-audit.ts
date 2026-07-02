#!/usr/bin/env tsx
/**
 * GitHub security settings auditor — uses Playwright to open the repo's
 * security analysis page in a visible browser using your existing Chrome
 * profile (so you're already signed in to GitHub).
 *
 * USAGE:
 *   npx tsx scripts/github-security-audit.ts
 *
 * Then either:
 *   - Use the visible window yourself to flip toggles
 *   - Tell Claude what you see and Claude will guide via this script
 */
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';

const REPO = 'CleanExpo/Synthex';

async function main() {
  const userDataDir = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'Google',
    'Chrome',
    'User Data'
  );

  console.log(`[audit] Launching Chrome with profile: ${userDataDir}`);
  console.log(`[audit] (close any other Chrome windows first if this hangs)`);

  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--profile-directory=Default'],
    viewport: { width: 1400, height: 900 },
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());

  console.log(`[audit] Navigating to security_analysis page...`);
  await page.goto(`https://github.com/${REPO}/settings/security_analysis`, {
    waitUntil: 'domcontentloaded',
  });

  console.log(`[audit] Page loaded. Inspecting toggle states...`);
  await page
    .waitForLoadState('networkidle', { timeout: 10000 })
    .catch(() => {});

  // Snapshot the visible setting toggles
  const settings = await page.evaluate(() => {
    const out: Array<{ label: string; state: string }> = [];
    document.querySelectorAll('h3, h4').forEach(h => {
      const label = (h.textContent ?? '').trim();
      if (
        label.toLowerCase().includes('scan') ||
        label.toLowerCase().includes('depend') ||
        label.toLowerCase().includes('secret') ||
        label.toLowerCase().includes('alert') ||
        label.toLowerCase().includes('protection')
      ) {
        let next = h.parentElement?.nextElementSibling ?? h.nextElementSibling;
        const enabledHint = next?.textContent?.toLowerCase() ?? '';
        let state = 'unknown';
        if (enabledHint.includes('enable') && !enabledHint.includes('enabled'))
          state = 'OFF (enable button visible)';
        else if (enabledHint.includes('disable')) state = 'ON';
        else if (enabledHint.includes('configure')) state = 'configurable';
        out.push({ label, state });
      }
    });
    return out;
  });

  console.log('\n[audit] Detected security settings:');
  settings.forEach(s => console.log(`  - ${s.label.padEnd(50)} ${s.state}`));

  console.log('\n[audit] Browser left open for you to interact.');
  console.log(
    '[audit] Close the Chrome window when done. (Ctrl+C will not close it.)'
  );

  // Keep the script alive so the browser stays open
  await new Promise(() => {});
}

main().catch(err => {
  console.error('[audit] FATAL:', err);
  process.exit(1);
});
