// Capture every page named in tours.json from the live site: a full-page 1920-wide screenshot (the
// video pans down it) and a 1920x1080 hero frame (the thumbnail). Usage: node capture.mjs <out dir> [id ...]
// A page that does not answer 200 stops that business: a demo never shows an error page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const rev = (() => {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'node_modules/playwright-core/browsers.json'),
        'utf8'
      )
    ).browsers.find(b => b.name === 'chromium-headless-shell').revision;
  } catch (e) {
    return '';
  }
})();
const cache = [
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  path.join(os.homedir(), 'Library/Caches/ms-playwright'),
]
  .filter(Boolean)
  .find(
    c => rev && fs.existsSync(path.join(c, 'chromium_headless_shell-' + rev))
  );
if (cache) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const tours = JSON.parse(
  fs.readFileSync(path.join(here, 'tours.json'), 'utf8')
);
const OUT = path.resolve(process.argv[2]);
const only = process.argv.slice(3);
const slug = p =>
  p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '-');

// Hide things that do not belong in a demo frame: cookie and chat pop-ups, sticky dev badges
const TIDY = `
  [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i],
  [id*="intercom" i], [class*="crisp" i], [id*="hubspot" i], #vercel-live-feedback, nextjs-portal
  { display: none !important; }
  html { scroll-behavior: auto !important; }`;

const browser = await chromium.launch();
const report = [];
for (const biz of tours.businesses) {
  if (only.length && !only.includes(biz.id)) continue;
  const dir = path.join(OUT, biz.id, 'pages');
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: 'en-AU',
  });
  const page = await ctx.newPage();
  const paths = [...new Set(biz.segments.map(s => s.path))];
  let ok = true;
  for (const p of paths) {
    const url = new URL(p, biz.url).toString();
    const res = await page
      .goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      .catch(e => ({ status: () => 0, err: e }));
    const status = res && res.status ? res.status() : 0;
    if (status !== 200) {
      report.push({ id: biz.id, path: p, status, ok: false });
      ok = false;
      continue;
    }
    await page.addStyleTag({ content: TIDY });
    for (const label of [
      /reject optional/i,
      /reject all/i,
      /necessary only/i,
      /decline/i,
      /^reject$/i,
    ]) {
      const b = page.getByRole('button', { name: label }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        await page.waitForTimeout(500);
        break;
      }
    }
    await page.evaluate(() =>
      document.querySelectorAll('body *').forEach(e => {
        const s = getComputedStyle(e);
        if (
          (s.position === 'fixed' || s.position === 'sticky') &&
          /cookie|privacy preferences|consent/i.test(e.innerText || '') &&
          e.innerText.length < 900
        )
          e.style.display = 'none';
      })
    );
    // walk down the page so lazy images and scroll animations load, then return to the top
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) {
      await page.evaluate(v => window.scrollTo(0, v), y);
      await page.waitForTimeout(140);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    // Chrome cannot capture past about 16k pixels; the demos never pan that far
    const capH = Math.min(h, 12000);
    await page.screenshot({
      path: path.join(dir, slug(p) + '.png'),
      fullPage: true,
      clip: { x: 0, y: 0, width: 1920, height: capH },
      timeout: 180000,
    });
    if (p === '/')
      await page.screenshot({ path: path.join(OUT, biz.id, 'hero.png') });
    const headings = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3')]
        .map(e => e.innerText.trim())
        .filter(Boolean)
        .slice(0, 30)
    );
    report.push({ id: biz.id, path: p, status, ok: true, height: h, headings });
  }
  await ctx.close();
  console.info(`${biz.id}: ${ok ? 'ok' : 'FAILED'} (${paths.length} pages)`);
}
await browser.close();
fs.writeFileSync(
  path.join(OUT, 'capture-report.json'),
  JSON.stringify(report, null, 2)
);
if (report.some(r => !r.ok)) {
  console.info(
    'pages that did not answer 200:',
    report
      .filter(r => !r.ok)
      .map(r => r.id + r.path + ' ' + r.status)
      .join(', ')
  );
  process.exit(1);
}
