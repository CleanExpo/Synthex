// The card saves enquiries and feedback to Supabase (UNI-3000). Usage: node capture.mjs <site dir>
// Serves the built site on localhost and answers every Supabase request itself: nothing reaches a real project.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

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
const hit = [
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  path.join(os.homedir(), 'Library/Caches/ms-playwright'),
  path.join(os.homedir(), '.cache/ms-playwright'),
]
  .filter(Boolean)
  .find(
    c => rev && fs.existsSync(path.join(c, 'chromium_headless_shell-' + rev))
  );
if (hit) process.env.PLAYWRIGHT_BROWSERS_PATH = hit;
const { chromium } = require('playwright');

const SITE = path.resolve(process.argv[2] || 'site');
const kit = JSON.parse(fs.readFileSync('brand-kits/phill-mcgurk.json', 'utf8'));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.vcf': 'text/vcard',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(SITE, p);
  if (
    !f.startsWith(SITE) ||
    !fs.existsSync(f) ||
    fs.statSync(f).isDirectory()
  ) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
  });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}/`;

const fails = [];
const check = (ok, what) => {
  if (!ok) fails.push(what);
  console.info((ok ? 'ok   ' : 'FAIL ') + what);
};

// the kit's capture block, and the feedback page's copy of it, are the publishable key for the Unite-Group project
const C = kit.capture || {};
check(
  C.url === 'https://lksfwktwtmyznckodsau.supabase.co' &&
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(C.key || '') &&
    C.slug === 'phill-mcgurk',
  'kit.capture is the Unite-Group project with a publishable key'
);
const fbSrc = fs.readFileSync(path.join(SITE, 'feedback.html'), 'utf8');
const fbConf =
  /const CAPTURE = \{ url: "([^"]+)", key: "([^"]+)", slug: "([^"]+)" \};/.exec(
    fbSrc
  );
check(
  !!fbConf &&
    fbConf[1] === C.url &&
    fbConf[2] === C.key &&
    fbConf[3] === C.slug,
  'feedback page uses the same capture values as the kit'
);
// a JWT here would be a legacy or service key; the card must only ever hold the publishable one
const pages = [
  'index.html',
  'feedback.html',
  'card-template.html',
  'get-your-card.html',
].map(f => fs.readFileSync(path.join(SITE, f), 'utf8'));
check(
  pages.every(
    t =>
      !/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test(t) &&
      !/service_role/.test(t)
  ),
  'no JWT or service-role key in any served page'
);

const browser = await chromium.launch();
// reply: 201 | a status | 'abort'. Every request to any Supabase host is recorded and answered here.
async function visit(reply, delayMs = 0) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const calls = [];
  await ctx.route(/supabase\.co/, async r => {
    const q = r.request();
    calls.push({
      url: q.url(),
      method: q.method(),
      headers: q.headers(),
      body: q.postData(),
    });
    if (delayMs) await new Promise(res => setTimeout(res, delayMs));
    if (reply === 'abort') return r.abort();
    return r.fulfill({ status: reply, body: '' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  return { ctx, page, calls, errors };
}
const settle = page =>
  page.waitForFunction(
    id => !/^(Sending|Not sent)$/.test(document.getElementById(id).textContent),
    'send-state',
    { timeout: 15000 }
  );
const headersOk = h =>
  h.apikey === C.key &&
  h.prefer === 'return=minimal' &&
  h['content-type'] === 'application/json' &&
  !('authorization' in h);

try {
  // 1. Connect: one POST to card_enquiries with the briefed fields, Saved on 201, and no second row on a resend
  {
    const { ctx, page, calls, errors } = await visit(201);
    // Connect lives in the owner's view: the owner hands the phone over and the person types their enquiry
    await page.goto(BASE + '?me=1&at=brisbane');
    await page.click('#door-connect');
    check(
      (await page.textContent('#enquiry-go')) === 'Send my message',
      'hosted card offers Send my message'
    );
    await page.click('#enquiry button[type=submit]');
    await settle(page);
    check(
      calls.length === 0 &&
        (await page.textContent('#send-state')) === 'Example only, not saved',
      'the untouched example entry is never saved'
    );
    await page.fill('#f-name', 'Sam Rivers');
    await page.click('#enquiry button[type=submit]');
    await settle(page);
    const [c] = calls;
    const row = c ? JSON.parse(c.body) : {};
    check(
      calls.length === 1 &&
        c.method === 'POST' &&
        c.url === C.url + '/rest/v1/card_enquiries',
      'one POST to card_enquiries: ' + (c && c.url)
    );
    check(
      !!c && headersOk(c.headers),
      'publishable key in apikey only, return=minimal, no Authorization header'
    );
    check(
      JSON.stringify(Object.keys(row).sort()) ===
        JSON.stringify([
          'ask',
          'business',
          'card_slug',
          'first_name',
          'reply_email',
          'source',
        ]) &&
        row.card_slug === 'phill-mcgurk' &&
        row.first_name === 'Sam' &&
        row.reply_email === 'sam@example.com.au' &&
        row.business === 'Example Restorations, Ipswich' &&
        row.source === 'card' &&
        row.ask.startsWith('A proposal or partnership: We heard your talk') &&
        row.ask.length <= 2000,
      'enquiry row carries only the briefed fields: ' +
        JSON.stringify(row).slice(0, 160)
    );
    check(
      !/phone|mobile|tel/i.test(Object.keys(row).join(' ')),
      'no phone field is sent'
    );
    check(
      (await page.textContent('#send-state')) === 'Saved',
      'Saved shown on 201'
    );
    check(
      decodeURIComponent(
        (await page.getAttribute('#mail-msg', 'href')) || ''
      ).startsWith('mailto:'),
      'email fallback still prepared'
    );
    await page.click('#enquiry button[type=submit]');
    await page.waitForTimeout(500);
    check(
      calls.length === 1 && (await page.textContent('#send-state')) === 'Saved',
      'pressing Send again does not save a second row'
    );
    await page.fill('#f-msg', 'A different question');
    await page.click('#enquiry button[type=submit]');
    await settle(page);
    check(calls.length === 2, 'a changed message is saved as a new row');
    check(
      errors.length === 0,
      'no card page errors' + (errors.length ? ': ' + errors.join(' | ') : '')
    );
    await ctx.close();
  }
  // 1b. changing only the topic is a real enquiry; two quick presses while the first is in flight save one row
  {
    const { ctx, page, calls } = await visit(201, 1500);
    await page.goto(BASE + '?me=1');
    await page.click('#door-connect');
    await page.selectOption('#f-type', 'Training');
    await page.click('#enquiry button[type=submit]');
    await page.click('#enquiry button[type=submit]');
    await settle(page);
    await page.waitForTimeout(1800);
    const row = calls[0] ? JSON.parse(calls[0].body) : {};
    check(
      calls.length === 1 &&
        (row.ask || '').startsWith('Training: ') &&
        (await page.textContent('#send-state')) === 'Saved',
      'a topic-only change is saved, and a double press mid-flight saves one row (' +
        calls.length +
        ' POSTs)'
    );
    await ctx.close();
  }
  // 2. Connect when saving fails: Not saved, and the copy and email stay ready
  for (const reply of [401, 500, 'abort']) {
    const { ctx, page, calls } = await visit(reply);
    await page.goto(BASE + '?me=1');
    await page.click('#door-connect');
    await page.fill('#f-msg', 'Can you quote a card for my crew?');
    await page.click('#enquiry button[type=submit]');
    await settle(page);
    check(
      calls.length === 1 &&
        (await page.textContent('#send-state')).startsWith('Not saved') &&
        (await page.getAttribute('#mail-msg', 'href')).startsWith('mailto:') &&
        (await page.textContent('#out-text')).includes('Subject:'),
      `Not saved on ${reply}, email and copy still ready`
    );
    await ctx.close();
  }
  // 3. Feedback: one POST to card_feedback with first name, answers and device; the text message is still prepared
  for (const reply of [201, 500, 'abort']) {
    const { ctx, page, calls, errors } = await visit(reply);
    await page.goto(BASE + 'feedback.html');
    await page.fill('#first', 'Probe');
    await page.check('input[name="save"][value="Partly"]');
    await page.check('#mods input[value="Menu"]');
    await page.fill('#bugs', 'x'.repeat(900));
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => document.getElementById('saved').textContent !== 'Sending',
      null,
      { timeout: 15000 }
    );
    const [c] = calls;
    const row = c ? JSON.parse(c.body) : {};
    const said = await page.textContent('#saved');
    const sms = decodeURIComponent(
      ((await page.getAttribute('#out-sms', 'href')) || '').replace(
        /^sms:\?&body=/,
        ''
      )
    );
    check(
      calls.length === 1 &&
        c.url === C.url + '/rest/v1/card_feedback' &&
        headersOk(c.headers),
      `feedback: one POST to card_feedback, publishable key only (${reply})`
    );
    check(
      JSON.stringify(Object.keys(row).sort()) ===
        JSON.stringify(['answers', 'card_slug', 'device', 'first_name']) &&
        row.card_slug === 'phill-mcgurk' &&
        row.first_name === 'Probe' &&
        row.answers &&
        row.answers.save === 'Partly' &&
        row.answers.want === 'Menu' &&
        row.answers.bugs.length === 300 &&
        Buffer.byteLength(JSON.stringify(row.answers)) <= 4000,
      'feedback row: briefed fields, long answers clipped under the 4000-byte cap'
    );
    check(
      reply === 201 ? said.startsWith('Saved') : said.startsWith('Not saved'),
      `feedback says ${reply === 201 ? 'Saved' : 'Not saved'} (${reply}): ${said}`
    );
    check(
      sms.includes('feedback from Probe') &&
        sms.includes('Saving the contact: Partly'),
      `feedback text message still prepared (${reply})`
    );
    check(
      errors.length === 0,
      'no feedback page errors' +
        (errors.length ? ': ' + errors.join(' | ') : '')
    );
    await ctx.close();
  }
  // 3b. emoji answers stay under the table's 4000-byte cap as Postgres stores them (a space after every : and ,);
  // a name of only spaces sends nothing; a double press mid-flight sends once
  {
    const { ctx, page, calls } = await visit(201, 1500);
    await page.goto(BASE + 'feedback.html');
    await page.fill('#first', '   ');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    check(
      calls.length === 0 && (await page.isHidden('#out')),
      'a first name of only spaces sends and prepares nothing'
    );
    await page.fill('#first', 'Émoji');
    const many = '😀'.repeat(400);
    await page.fill('#save-how', many);
    await page.fill('#clear-why', many);
    await page.fill('#bugs', many);
    await page.fill('#mods-other', '😀'.repeat(300));
    await page.click('button[type="submit"]');
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => document.getElementById('saved').textContent !== 'Sending',
      null,
      { timeout: 15000 }
    );
    await page.waitForTimeout(1800);
    const row = calls[0] ? JSON.parse(calls[0].body) : {};
    const stored = JSON.stringify(row.answers || {})
      .replace(/":"/g, '": "')
      .replace(/","/g, '", "');
    const whole = Object.values(row.answers || {}).every(
      v =>
        !/[\uD800-\uDFFF]/.test(
          v.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        )
    );
    check(
      calls.length === 1 &&
        Buffer.byteLength(stored) <= 4000 &&
        whole &&
        row.first_name === 'Émoji',
      `emoji feedback: one POST, ${Buffer.byteLength(stored)} bytes as stored, no broken characters`
    );
    check(
      (await page.textContent('#saved')).startsWith('Saved'),
      'emoji feedback shows Saved'
    );
    await ctx.close();
  }
  // 4. the order page's live preview is not a hosted card: it never saves anything
  {
    const { ctx, page, calls } = await visit(201);
    await page.goto(BASE + 'get-your-card.html');
    await page.waitForTimeout(1500);
    for (const fr of page.frames()) {
      const btn = await fr.$('#enquiry button[type=submit]');
      if (btn)
        await fr
          .evaluate(() => document.getElementById('enquiry').requestSubmit())
          .catch(() => {});
    }
    await page.waitForTimeout(800);
    check(calls.length === 0, 'order page preview sends nothing to Supabase');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (fails.length) {
  console.info(`\n${fails.length} failed`);
  process.exit(1);
}
console.info('\nall passed');
