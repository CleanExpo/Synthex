// Split each live page screen that a film segment covers into its real pieces, for the assemble/disassemble shots.
// Usage (from the repo root): node business-card/demos/cinematic/slices.mjs <out root> [id ...]
// For every segment in tours.json, scrolls the page to the segment's start and writes <out root>/<id>/cine/seg<NN>/:
//   full.png   the screen as it is
//   pieces.png only the pieces, on transparency, so each floats as a clean object
//   plate.png  the same screen with every piece hidden
//   pieces.json each piece's box (the film crops pieces out of pieces.png, so every pixel shown is the real site)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const tours = JSON.parse(
  fs.readFileSync(path.join(here, '..', 'tours.json'), 'utf8')
);
const [root, ...only] = process.argv.slice(2);

const TIDY = `[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],#vercel-live-feedback,nextjs-portal,elevenlabs-convai{display:none!important}
  *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}`;

async function capture(page, url, frac, out) {
  fs.mkdirSync(out, { recursive: true });
  const res = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  if (!res || res.status() !== 200)
    throw new Error(`${url} answered ${res && res.status()}`);
  await page.addStyleTag({ content: TIDY });
  await page.waitForTimeout(2500);
  // scroll a screen at a time so lazy images and on-scroll reveals load, then settle at the segment's start
  const y = await page.evaluate(async frac => {
    const H = document.documentElement.scrollHeight,
      target = Math.min(Math.round(frac * H), Math.max(0, H - innerHeight));
    for (let s = 0; s <= target; s += innerHeight) {
      scrollTo(0, s);
      await new Promise(r => setTimeout(r, 250));
    }
    scrollTo(0, target);
    return target;
  }, frac);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    // floating chat and sticky widgets are not part of the page
    for (const el of document.querySelectorAll('body *'))
      if (
        getComputedStyle(el).position === 'fixed' &&
        (el.getBoundingClientRect().height < 200 ||
          /cookie/i.test(el.innerText || ''))
      )
        el.style.setProperty('display', 'none', 'important');
  });
  await page.screenshot({ path: path.join(out, 'full.png') });
  const pieces = await page.evaluate(() => {
    const SEL =
      'header nav a, header button, h1, h2, h3, h4, p, a, button, img, svg, input, [class*="card" i], [class*="badge" i], [class*="pill" i], li';
    const W = innerWidth,
      H = innerHeight;
    const seen = [];
    // a framed box (border or shadow with rounded corners) is one piece: a card, a badge, a mock screen
    const framed = el => {
      const cs = getComputedStyle(el);
      return (
        parseFloat(cs.borderTopLeftRadius) > 4 &&
        (cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0)
      );
    };
    const cands = [...document.querySelectorAll('div, span, section, aside')]
      .filter(framed)
      .concat([...document.querySelectorAll(SEL)]);
    for (const el of cands) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      let fixed = false;
      for (let a = el; a && a !== document.body; a = a.parentElement)
        if (getComputedStyle(a).position === 'fixed') {
          fixed = true;
          break;
        }
      if (fixed) continue;
      if (
        !(el.innerText || '').trim() &&
        !el.querySelector('img,svg') &&
        el.tagName !== 'IMG' &&
        r.width * r.height > 200000
      )
        continue; // empty glows
      if (
        r.width < 24 ||
        r.height < 14 ||
        r.bottom <= 0 ||
        r.top >= H ||
        r.right <= 0 ||
        r.left >= W
      )
        continue;
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      if (r.width * r.height > W * H * 0.35) continue; // page sections, not pieces
      if (seen.some(s => s.el.contains(el))) continue; // keep the outermost piece
      for (let i = seen.length - 1; i >= 0; i--)
        if (el.contains(seen[i].el)) seen.splice(i, 1);
      seen.push({ el, r });
    }
    seen.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
    return seen.map(({ el, r }, i) => {
      el.setAttribute('data-piece', i);
      const x = Math.max(0, Math.floor(r.left) - 2),
        y = Math.max(0, Math.floor(r.top) - 2);
      const pic =
        el.tagName === 'IMG' ||
        el.tagName === 'svg' ||
        !!el.querySelector('img,svg');
      return {
        i,
        tag: el.tagName.toLowerCase(),
        text: (
          el.innerText ||
          el.getAttribute('alt') ||
          el.getAttribute('aria-label') ||
          ''
        )
          .trim()
          .slice(0, 60),
        pic,
        x,
        y,
        w: Math.min(W - x, Math.ceil(r.width) + 4),
        h: Math.min(H - y, Math.ceil(r.height) + 4),
      };
    });
  });
  const solo = await page.addStyleTag({
    content: `html,body{background:transparent!important}
    body *{visibility:hidden!important} [data-piece],[data-piece] *{visibility:visible!important}`,
  });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(out, 'pieces.png'),
    omitBackground: true,
  });
  await solo.evaluate(n => n.remove());
  await page.addStyleTag({
    content: '[data-piece]{visibility:hidden!important}',
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'plate.png') });
  // the logo: the first picture-bearing piece in the top-left of the header
  const logo = pieces.find(p => p.pic && p.y < 140 && p.x < 700 && p.w < 600);
  fs.writeFileSync(
    path.join(out, 'pieces.json'),
    JSON.stringify(
      {
        url,
        scrollY: y,
        captured: new Date().toISOString(),
        logo: logo ? logo.i : null,
        pieces,
      },
      null,
      1
    )
  );
  return pieces.length;
}

const browser = await chromium.launch();
for (const biz of tours.businesses) {
  if (only.length && !only.includes(biz.id)) continue;
  const page = await (
    await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'en-AU',
      bypassCSP: true,
    })
  ).newPage();
  for (const [i, seg] of biz.segments.entries()) {
    const out = path.join(
      root,
      biz.id,
      'cine',
      'seg' + String(i + 1).padStart(2, '0')
    );
    try {
      const n = await capture(
        page,
        new URL(seg.path, biz.url).toString(),
        seg.from,
        out
      );
      console.info(biz.id, i + 1, seg.path, seg.from, n, 'pieces');
    } catch (e) {
      console.info(biz.id, i + 1, 'FAILED', String(e).slice(0, 200));
    }
  }
  await page.context().close();
}
await browser.close();
