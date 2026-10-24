// Phone-size checks for the hosted card. Usage: node smoke.mjs <site dir> [smoke|contrast]
// Serves the built site on localhost (service workers need http(s)) and drives headless Chromium.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
// Use whichever browser cache actually holds this Playwright's browsers (this Mac keeps one on the internal disk)
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
const caches = [
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  path.join(os.homedir(), 'Library/Caches/ms-playwright'),
  path.join(os.homedir(), '.cache/ms-playwright'),
].filter(Boolean);
const hit = caches.find(
  c => rev && fs.existsSync(path.join(c, 'chromium_headless_shell-' + rev))
);
if (hit) process.env.PLAYWRIGHT_BROWSERS_PATH = hit;
const { chromium } = require('playwright');
const SITE = path.resolve(process.argv[2] || '.');
const MODE = process.argv[3] || 'smoke';
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
  const data = fs.readFileSync(f),
    type = TYPES[path.extname(f)] || 'application/octet-stream';
  const range =
    req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = +range[1] || 0,
      end = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${data.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    return res.end(data.subarray(start, end + 1));
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Accept-Ranges': 'bytes',
  });
  res.end(data);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}/`;

const fails = [];
const check = (ok, what) => {
  if (!ok) fails.push(what);
  console.info((ok ? 'ok   ' : 'FAIL ') + what);
};
const browser = await chromium.launch();

async function phone(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
    serviceWorkers: 'allow',
    ...opts,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  return { ctx, page, errors };
}

// ---- minimal PNG decoder (8-bit RGB/RGBA, non-interlaced: what Chromium screenshots produce)
function decodePNG(buf) {
  let pos = 8,
    w = 0,
    h = 0,
    ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos),
      type = buf.toString('ascii', pos + 4, pos + 8),
      body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      ct = body[9];
      if (body[8] !== 8 || body[12]) throw new Error('unsupported PNG');
    }
    if (type === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('PNG colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)),
    stride = w * bpp,
    out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)],
      line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0,
        b = y ? out[(y - 1) * stride + i] : 0,
        c = y && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
const lin = v => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Contrast of every visible text element: hide the text, photograph what is really behind it, and score the
// text colour against the worst background pixel (2nd percentile, to ignore single anti-aliased edge pixels)
async function contrastScene(page, label) {
  const items = await page.evaluate(() => {
    const out = [],
      seen = new Set();
    const visible = el => {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') return false;
      for (let e = el; e; e = e.parentElement) {
        if (e.hidden || getComputedStyle(e).display === 'none') return false;
      }
      return true;
    };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim()) continue;
      if (
        ['SCRIPT', 'STYLE', 'OPTION', 'TITLE', 'PRE'].includes(el.tagName) ||
        el.closest('#pass-qr')
      )
        continue;
      if (!visible(el)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const raw = r.getBoundingClientRect();
      // only the part a viewer can see: clipped by any overflow-hidden ancestor, and not covered by something on top
      let bx = {
        left: raw.left,
        top: raw.top,
        right: raw.right,
        bottom: raw.bottom,
      };
      for (let e = el; e; e = e.parentElement) {
        const o = getComputedStyle(e);
        if (/hidden|clip/.test(o.overflowX + o.overflowY)) {
          const c = e.getBoundingClientRect();
          bx = {
            left: Math.max(bx.left, c.left),
            top: Math.max(bx.top, c.top),
            right: Math.min(bx.right, c.right),
            bottom: Math.min(bx.bottom, c.bottom),
          };
        }
      }
      const box = {
        left: bx.left,
        top: bx.top,
        right: bx.right,
        bottom: bx.bottom,
        width: bx.right - bx.left,
        height: bx.bottom - bx.top,
      };
      if (box.width >= 2 && box.height >= 2) {
        const hit = document.elementFromPoint(
          (box.left + box.right) / 2,
          (box.top + box.bottom) / 2
        );
        if (hit && !(el.contains(hit) || hit.contains(el))) continue;
      }
      if (
        box.width < 2 ||
        box.height < 2 ||
        box.bottom < 0 ||
        box.top > innerHeight ||
        box.right < 0 ||
        box.left > innerWidth
      )
        continue;
      let op = 1;
      for (let e = el; e; e = e.parentElement)
        op *= parseFloat(getComputedStyle(e).opacity);
      if (op < 0.05) continue;
      seen.add(el);
      el.dataset.cid = String(out.length);
      const s = getComputedStyle(el),
        size = parseFloat(s.fontSize),
        weight = parseInt(s.fontWeight, 10) || 400;
      out.push({
        id: out.length,
        text: n.textContent.trim().slice(0, 40),
        color: s.color,
        op,
        large: size >= 24 || (size >= 18.66 && weight >= 700),
        box: {
          x: Math.max(0, box.left),
          y: Math.max(0, box.top),
          w: Math.min(innerWidth, box.right) - Math.max(0, box.left),
          h: Math.min(innerHeight, box.bottom) - Math.max(0, box.top),
        },
      });
    }
    const st = document.createElement('style');
    st.id = 'cx-hide';
    st.textContent =
      '[data-cid]{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}';
    document.head.append(st);
    return out;
  });
  const vids = await page.evaluate(() =>
    [...document.querySelectorAll('video')].forEach(v => v.pause())
  );
  const shot = decodePNG(await page.screenshot());
  await page.evaluate(() => {
    document.getElementById('cx-hide').remove();
    document
      .querySelectorAll('[data-cid]')
      .forEach(e => e.removeAttribute('data-cid'));
  });
  const scale = shot.w / 390,
    bad = [];
  for (const it of items) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(
      it.color
    );
    if (!m) continue;
    const a = (m[4] === undefined ? 1 : +m[4]) * it.op,
      ratios = [];
    const x0 = Math.floor(it.box.x * scale),
      y0 = Math.floor(it.box.y * scale),
      x1 = Math.ceil((it.box.x + it.box.w) * scale),
      y1 = Math.ceil((it.box.y + it.box.h) * scale);
    for (let y = y0; y < Math.min(y1, shot.h); y += 2)
      for (let x = x0; x < Math.min(x1, shot.w); x += 2) {
        const i = (y * shot.w + x) * shot.bpp,
          br = shot.px[i],
          bg = shot.px[i + 1],
          bb = shot.px[i + 2];
        const fr = +m[1] * a + br * (1 - a),
          fg = +m[2] * a + bg * (1 - a),
          fb = +m[3] * a + bb * (1 - a);
        ratios.push(ratio(L(fr, fg, fb), L(br, bg, bb)));
      }
    if (!ratios.length) continue;
    ratios.sort((p, q) => p - q);
    const worst = ratios[Math.floor(ratios.length * 0.02)],
      need = it.large ? 3 : 4.5;
    if (worst < need)
      bad.push(`${label}: "${it.text}" ${worst.toFixed(2)}:1 (needs ${need})`);
  }
  return { count: items.length, bad };
}

try {
  if (MODE === 'smoke') {
    let { ctx, page, errors } = await phone();
    await page.goto(BASE + '?to=Sam&at=brisbane');
    await page.waitForTimeout(1500);
    check(
      (await page.textContent('#greet')) ===
        'Great to meet you at Brisbane, Sam',
      'greets by name and event'
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      'no sideways scroll at 390px'
    );
    check(await page.isHidden('#mine'), 'visitors do not see the owner panel');
    await page.goto(BASE + '?to=Sam&at=evil');
    await page.waitForTimeout(800);
    check(
      (await page.textContent('#greet')) === 'Great to meet you, Sam',
      'unknown event ignored'
    );
    // the white rabbit opens a surprise with a practical idea
    await page.waitForTimeout(6500);
    await page.click('#rabbit');
    await page.waitForTimeout(400);
    const gift1 = await page.textContent('#surprise-h');
    check(
      (await page.isVisible('#surprise')) && gift1.length > 5,
      'rabbit opens a surprise: ' + gift1
    );
    await page.click('#surprise-more');
    check(
      (await page.textContent('#surprise-h')) !== gift1,
      'another surprise is a different idea'
    );
    await page.click('#surprise-close');
    check(await page.isHidden('#surprise'), 'surprise closes');
    // pass it on, personalised (the owner's tool)
    await page.goto(BASE + '?me=1');
    await page.waitForTimeout(800);
    await page.click('#pass-btn');
    await page.fill('#pass-name', 'Alex');
    await page.selectOption('#pass-at', 'melbourne');
    await page.click('#pass-form button.go');
    const qr = await page.getAttribute('#pass-qr', 'data-url');
    check(
      /[?&]to=Alex/.test(qr) &&
        /[?&]at=melbourne/.test(qr) &&
        qr.startsWith(BASE),
      'personalised QR carries name and event: ' + qr
    );
    check(
      await page.evaluate(
        () => !!document.querySelector('#pass-qr canvas, #pass-qr img')
      ),
      'QR drawn'
    );
    // no signal: the contact code carries the contact itself, noting where you met
    await page.click('#pass-offline');
    const vc = await page.getAttribute('#pass-qr', 'data-vcard');
    check(
      vc.startsWith('BEGIN:VCARD') &&
        vc.includes('EMAIL:airestoreassist@gmail.com') &&
        vc.includes('NOTE:Met at Melbourne ') &&
        !vc.includes('TEL'),
      'offline contact code holds the contact and where you met'
    );
    check(
      await page.evaluate(
        () => !!document.querySelector('#pass-qr canvas, #pass-qr img')
      ),
      'offline contact code drawn'
    );
    await page.click('#pass-offline');
    check(
      /[?&]to=Alex/.test(await page.getAttribute('#pass-qr', 'data-url')),
      'switches back to the card code'
    );
    await page.click('#pass-close');
    // sound: on by default, started by the first tap anywhere (the taps above); the button mutes and unmutes
    let s = await page.evaluate(() => window.CARD_SFX.state());
    check(
      s.on && s.playing && s.audio === 'running',
      'sound started on first tap: ' + JSON.stringify(s)
    );
    await page.click('#sound');
    s = await page.evaluate(() => window.CARD_SFX.state());
    check(!s.on && !s.playing, 'sound button mutes: ' + JSON.stringify(s));
    await page.click('#sound');
    await page.waitForTimeout(300);
    s = await page.evaluate(() => window.CARD_SFX.state());
    check(
      s.on && s.playing && s.audio === 'running',
      'sound button unmutes: ' + JSON.stringify(s)
    );
    // a fresh visitor whose very first tap is the sound button gets sound (not on-then-off)
    {
      const v = await phone();
      await v.page.goto(BASE);
      await v.page.waitForTimeout(600);
      await v.page.click('#sound-label');
      const s2 = await v.page.evaluate(() => window.CARD_SFX.state());
      check(
        s2.on && s2.playing,
        'first tap on the sound button turns it on: ' + JSON.stringify(s2)
      );
      await v.ctx.close();
    }
    // review wheel: pick a business, spin, land on a question, open Google's form for that business only
    await page.click('#review-open');
    await page.click('#rw-biz .need >> text=Disaster Recovery');
    check(
      (await page.getAttribute('#review-btn', 'href')) ===
        'https://search.google.com/local/writereview?placeid=ChIJFTIv0bpOkWsRz_SIAaNI3Lc',
      'review link targets the chosen business'
    );
    await page.click('#rw-spin');
    await page.waitForFunction(() => window.CARD_REVIEW.landed() !== '', null, {
      timeout: 15000,
    });
    const q = await page.evaluate(() => window.CARD_REVIEW.landed());
    check(q.endsWith('?'), 'wheel landed on a question: ' + q);
    check(
      (await page.inputValue('#rw-text')) === '',
      'review text is left for the visitor to write'
    );
    // owner view
    await page.goto(BASE + '?me=1');
    await page.waitForTimeout(800);
    check(await page.isVisible('#mine'), 'owner panel shows with ?me=1');
    await page.selectOption('#mine-at', 'brisbane');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', {
        value: undefined,
        configurable: true,
      });
    });
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#lock-btn'),
    ]);
    const f = path.join(os.tmpdir(), 'lock-' + process.pid + '.png');
    await dl.saveAs(f);
    const png = fs.readFileSync(f),
      h = png.readUInt32BE(20),
      w = png.readUInt32BE(16);
    fs.unlinkSync(f);
    check(
      png.subarray(1, 4).toString() === 'PNG' && h >= 2000,
      `lock-screen PNG ${w}x${h}`
    );
    // Connect goes to the bot inbox, tagged with today's event
    await page.click('#door-connect');
    await page.click('#enquiry button[type=submit]');
    const mail = decodeURIComponent(
      await page.getAttribute('#mail-msg', 'href')
    );
    check(
      mail.startsWith('mailto:airestoreassist@gmail.com?') &&
        mail.includes('[Card · Brisbane]') &&
        mail.includes('Met at: Brisbane'),
      'Connect mailto: ' + mail.slice(0, 90)
    );
    // offline: once the service worker controls the page, a reload with no network still shows the card
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForTimeout(1500);
    check(
      await page.evaluate(() => !!navigator.serviceWorker.controller),
      'service worker controls the page'
    );
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForTimeout(1500);
    check(
      (await page.title()) === 'Phill McGurk Card' &&
        (await page.textContent('#person-name')).includes('Phill'),
      'card reloads offline'
    );
    await ctx.setOffline(false);
    check(
      errors.length === 0,
      'no page errors' + (errors.length ? ': ' + errors.join(' | ') : '')
    );
    await ctx.close();
    // Order page: the live preview must carry what the buyer types into the card template, and a typed
    // </script> must stay data (the template's kit marker and this page's replace call must agree).
    const order = await phone();
    await order.page.goto(BASE + 'get-your-card.html');
    const typed = 'Zoe Probe</script><script>parent.PWNED=1</script>';
    await order.page.fill('#d-name', typed);
    await order.page.waitForTimeout(1500);
    const frame = order.page.frames().find(f => f !== order.page.mainFrame());
    const kitName = frame
      ? await frame.evaluate(
          () => ((window.BRAND_KIT || {}).person || {}).name || null
        )
      : null;
    check(kitName === typed, 'order preview receives the buyer details');
    check(
      (await order.page.evaluate(() => window.PWNED || 0)) === 0,
      'a typed </script> stays data in the order preview'
    );
    check(
      order.errors.length === 0,
      'no order page errors' +
        (order.errors.length ? ': ' + order.errors.join(' | ') : '')
    );
    await order.ctx.close();
  } else if (MODE === 'panel') {
    // Each business with a demo video: tapping its name opens a panel whose thumbnail and Watch go to YouTube
    const { ctx, page, errors } = await phone();
    await page.goto(BASE + '?to=Sam');
    await page.waitForTimeout(1200);
    const kit = await page.evaluate(() => window.BRAND_KIT);
    const withVideo = kit.person.links.filter(
      l => l.visitor && l.url && l.video && l.video.youtubeId
    );
    check(
      withVideo.length >= 6,
      'businesses with a demo video: ' + withVideo.length
    );
    for (const l of withVideo) {
      await page.click(`#nexus .tile:has(.tname:text-is("${l.label}"))`);
      await page.waitForTimeout(400);
      const yt = 'https://youtu.be/' + l.video.youtubeId;
      const got = await page.evaluate(() => ({
        open: !document.getElementById('biz-sheet').hidden,
        thumb: document.getElementById('biz-thumb').naturalWidth,
        watch: document.getElementById('biz-watch').href,
        btn: document.getElementById('biz-watch-btn').href,
        visit: document.getElementById('biz-visit').href,
      }));
      check(
        got.open &&
          got.thumb >= 320 &&
          got.watch === yt &&
          got.btn === yt &&
          got.visit.startsWith(l.url),
        `${l.label} panel: ${JSON.stringify(got)}`
      );
      await page.click('#biz-close');
    }
    // "first screen" is the top of the card; clicking the lower business tiles scrolled away from it
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    const primaries = await page.evaluate(
      () =>
        [...document.querySelectorAll('.btn.primary')].filter(b => {
          const r = b.getBoundingClientRect();
          return b.offsetParent && r.top < innerHeight && r.bottom > 0;
        }).length
    );
    check(primaries === 1, 'still one primary action on the first screen');
    check(
      errors.length === 0,
      'no page errors' + (errors.length ? ': ' + errors.join(' | ') : '')
    );
    await ctx.close();
  } else if (MODE === 'oneclick') {
    // Someone the card is shared with: one obvious action, and it saves the contact
    const { ctx, page, errors } = await phone();
    let vcf = false;
    // watch the context, not page.route: the card's service worker answers before a route would see it
    ctx.on('request', r => {
      if (r.url().endsWith('/phill-mcgurk.vcf')) vcf = true;
    });
    await page.goto(BASE + '?to=Sam&at=brisbane');
    await page.waitForTimeout(1500);
    const primaries = await page.evaluate(() =>
      [...document.querySelectorAll('.btn.primary, button.primary')]
        .filter(b => {
          const r = b.getBoundingClientRect();
          return b.offsetParent && r.top < innerHeight && r.bottom > 0;
        })
        .map(b => b.textContent.trim())
    );
    check(
      primaries.length === 1 && primaries[0] === 'Save to my phone',
      'first screen has one primary action: ' + JSON.stringify(primaries)
    );
    for (const sel of [
      '#pass-btn',
      '.doors',
      '#links-section',
      '#creds',
      '#share',
      '#mine',
      '#live-status',
      '#replay',
    ]) {
      check(await page.isHidden(sel), 'hidden from visitors: ' + sel);
    }
    check(
      (await page.isVisible('#review-open')) &&
        !(await page.getAttribute('#review-open', 'class')).includes('primary'),
      'review is one secondary button'
    );
    await page.click('#save').catch(() => {});
    await page.waitForTimeout(800);
    check(vcf, 'Save to my phone requests the contact file');
    check(
      errors.length === 0,
      'no page errors' + (errors.length ? ': ' + errors.join(' | ') : '')
    );
    await ctx.close();
    const own = await phone();
    await own.page.goto(BASE + '?me=1');
    await own.page.waitForTimeout(800);
    for (const sel of ['#pass-btn', '#mine', '#creds']) {
      check(await own.page.isVisible(sel), 'owner sees: ' + sel);
    }
    await own.ctx.close();
  } else if (MODE === 'shots') {
    // Phone screenshots for review: node smoke.mjs <site> shots <out dir>
    const out = path.resolve(process.argv[4] || '.');
    fs.mkdirSync(out, { recursive: true });
    const { ctx, page } = await phone();
    await page.goto(BASE + '?me=1&to=Sam&at=brisbane&edition=blueprint');
    await page.waitForTimeout(4500);
    await page.screenshot({ path: path.join(out, '1-opener.png') });
    await page.click('#sound-label');
    await page.waitForTimeout(300);
    const at = async (sel, name, extra = 0) => {
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.evaluate(d => scrollBy(0, d), extra);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, name) });
    };
    await at('#mine', '2-your-view.png', -40);
    await page.click('#review-open');
    await page.click('#rw-biz .need >> text=Disaster Recovery');
    await page.click('#rw-spin');
    await page.waitForFunction(() => window.CARD_REVIEW.landed() !== '', null, {
      timeout: 15000,
    });
    await at('#review', '3-review-wheel.png', -20);
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#pass-btn');
    await page.fill('#pass-name', 'Alex');
    await page.click('#pass-form button.go');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, '4-pass-it-on.png') });
    await page.click('#pass-close');
    await page.click('#lock-btn').catch(() => {});
    await page.waitForTimeout(1500);
    await at('#lock-img', '5-lock-screen.png', -80);
    await ctx.close();
    // What a visitor sees, top to bottom
    const v = await phone();
    await v.page.goto(BASE + '?to=Sam&at=brisbane&edition=blueprint');
    await v.page.waitForTimeout(4500);
    await v.page.screenshot({
      path: path.join(out, '0-visitor-full.png'),
      fullPage: true,
    });
    await v.page.screenshot({
      path: path.join(out, '0-visitor-first-screen.png'),
    });
    await v.page.waitForTimeout(2500);
    await v.page.click('#rabbit');
    await v.page.waitForTimeout(900);
    await v.page.screenshot({ path: path.join(out, '6-rabbit-surprise.png') });
    await v.ctx.close();
  } else {
    const rotation = ['signature', 'origami', 'blueprint', 'restoration'];
    let total = 0;
    const bad = [];
    for (const ed of rotation) {
      for (const t of [900, 2200, 4500]) {
        const { ctx, page } = await phone({ reducedMotion: 'no-preference' });
        await page.goto(BASE + '?me=1&to=Sam&at=brisbane&edition=' + ed);
        await page.waitForTimeout(t);
        const r = await contrastScene(page, `${ed}@${t}ms top`);
        total += r.count;
        bad.push(...r.bad);
        await ctx.close();
      }
    }
    // the rest of the page (owner view, review wheel open, Connect prepared) and the pass-it-on overlay
    const { ctx, page } = await phone({ reducedMotion: 'reduce' });
    await page.goto(BASE + '?me=1');
    await page.waitForTimeout(1200);
    await page.click('#review-open');
    await page.click('#rw-biz .need >> nth=0');
    await page.click('#door-connect');
    await page.click('#enquiry button[type=submit]');
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 700) {
      await page.evaluate(v => scrollTo(0, v), y);
      await page.waitForTimeout(150);
      const r = await contrastScene(page, `page@${y}`);
      total += r.count;
      bad.push(...r.bad);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#pass-btn');
    await page.waitForTimeout(300);
    const r = await contrastScene(page, 'pass-it-on');
    total += r.count;
    bad.push(...r.bad);
    await page.click('#pass-close');
    await page.evaluate(() => surprise());
    await page.waitForTimeout(700);
    const g = await contrastScene(page, 'surprise');
    total += g.count;
    bad.push(...g.bad);
    await ctx.close();
    // what a visitor sees
    const vis = await phone({ reducedMotion: 'reduce' });
    await vis.page.goto(BASE + '?to=Sam&at=brisbane');
    await vis.page.waitForTimeout(1200);
    const VH = await vis.page.evaluate(
      () => document.documentElement.scrollHeight
    );
    for (let y = 0; y < VH; y += 700) {
      await vis.page.evaluate(v => scrollTo(0, v), y);
      await vis.page.waitForTimeout(150);
      const r2 = await contrastScene(vis.page, `visitor@${y}`);
      total += r2.count;
      bad.push(...r2.bad);
    }
    await vis.ctx.close();
    const uniq = [...new Set(bad)];
    check(total > 40, `measured ${total} text elements`);
    check(
      uniq.length === 0,
      'all text meets WCAG AA' +
        (uniq.length ? ':\n  ' + uniq.join('\n  ') : '')
    );
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
