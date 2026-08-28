#!/usr/bin/env node
// Render a fixed-size HTML art-board to a pixel-exact PNG.
//
// Usage:  node scripts/design/render-board.mjs <board.html> <out.png> <WIDTHxHEIGHT> [scale]
//   e.g.  node scripts/design/render-board.mjs v1/board.html v1/post.png 1080x1440
//         node scripts/design/render-board.mjs email/board.html email/header.png 1200x400 2
//
// One-time per machine: npx playwright install chromium
// Or, where a Chromium is already present but a different build:
//   CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium node scripts/design/render-board.mjs ...
// (playwright itself is already a repo dependency — do not npm i it.)
//
// Exit codes: 0 ok · 1 render failure, blocked request, or failed font · 2 bad args
//
// The network block is the mechanism behind the synthex-design skill's §7 rule
// that art-boards load no resources at render time. A board that reaches for a
// Google Font would otherwise fall back to a system face silently, and the
// design would quietly stop being the design — with nothing in the output to
// say why quality varied between runs. Here it is a hard failure instead.

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const [, , htmlPath, outPath, dims, scaleArg] = process.argv;
if (!htmlPath || !outPath || !dims || !/^\d+x\d+$/i.test(dims)) {
  console.error(
    'usage: node scripts/design/render-board.mjs board.html out.png 1080x1440 [scale]'
  );
  process.exit(2);
}

const [w, h] = dims.toLowerCase().split('x').map(Number);
const scale = Number(scaleArg || 1);
if (!Number.isFinite(scale) || scale <= 0) {
  console.error(`bad scale: ${scaleArg}`);
  process.exit(2);
}

// The output directory never exists on a first run.
mkdirSync(dirname(resolve(outPath)), { recursive: true });

// Sandboxes and CI images often ship a Chromium build that differs from the one
// this repo's playwright version pins, which makes launch() fail with a missing
// executable. Point CHROMIUM_EXECUTABLE at the binary that IS present rather
// than downloading a second copy.
const executablePath = process.env.CHROMIUM_EXECUTABLE || undefined;

let browser;
try {
  browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
  });

  const blocked = [];
  await page.route('**', route => {
    const url = route.request().url();
    // file: only.
    //
    // Scope, measured rather than assumed: Chromium resolves `data:` and `file:`
    // subresources internally, so they never reach this handler — verified by
    // routing a page containing both and seeing an empty interception list. What
    // this guard actually catches is remote schemes (http/https), which is the
    // failure that matters: a board reaching for a Google Font would otherwise
    // fall back to a system face and quietly stop being the design.
    //
    // An inlined base64 face still bypasses the "self-host under public/fonts"
    // contract, and the renderer CANNOT see it. That one is caught by reading the
    // board, not here — SKILL.md §7 says so rather than implying this catches it.
    if (url.startsWith('file:')) return route.continue();
    blocked.push(url);
    return route.abort();
  });

  // Every resource is local, so 'networkidle' would only add latency.
  await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: 'load' });

  // An unloaded font silently ruins a design — wait for it, then check it landed.
  //
  // `document.fonts.ready` resolves once layout settles and NEVER rejects for a
  // face that failed to load, so awaiting it alone would report success while the
  // board rendered in a fallback face. Inspect each FontFace's status instead.
  const fontReport = await page.evaluate(async () => {
    if (!document.fonts) return { ready: false, failed: [], loaded: [] };
    await document.fonts.ready;
    const faces = [...document.fonts];
    return {
      ready: true,
      failed: faces.filter(f => f.status === 'error').map(f => f.family),
      loaded: faces.filter(f => f.status === 'loaded').map(f => f.family),
    };
  });

  await page.waitForTimeout(300); // let any entrance animation settle

  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: w, height: h },
  });

  await browser.close();
  browser = undefined;

  if (fontReport.failed.length > 0) {
    console.error(
      `font load failed: ${[...new Set(fontReport.failed)].join(', ')}\n` +
        'The board would render in a fallback face — the design silently stops ' +
        'being the design. Self-host the face under public/fonts/<brand>/ at the ' +
        'path the brand config declares, or record missing-font:<brand>/<family> ' +
        'in the run manifest and say so in the run summary.'
    );
    process.exit(1);
  }

  if (blocked.length > 0) {
    console.error(
      `network requests blocked: ${blocked.length}\n  ` +
        blocked.slice(0, 5).join('\n  ') +
        '\nArt-boards must load no remote resources (synthex-design SKILL.md §7). ' +
        'Self-host the asset under public/fonts/<brand>/ and re-render.'
    );
    process.exit(1);
  }

  // One-line JSON receipt so the skill can assert on it rather than on prose.
  console.log(
    JSON.stringify({
      out: outPath,
      w,
      h,
      scale,
      blocked: blocked.length,
      fontsReady: fontReport.ready,
      fontsLoaded: [...new Set(fontReport.loaded)],
      fontsFailed: [...new Set(fontReport.failed)],
      chromium: executablePath || 'bundled',
    })
  );
} catch (err) {
  console.error(`render failed: ${err.message}`);
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
}
