// Logged-out Instagram reel harvester. No cookies, no account, no login.
// Research use only: media is analysed locally and never re-published.
//
// Usage (run from this folder after `npm i playwright@1.64.1` in a scratch dir, NODE_PATH pointing at it):
//   node harvest.cjs grid  <outdir> <handle> [handle...]   -> <outdir>/grids/<handle>.json
//   node harvest.cjs reels <outdir> <list.json>            -> <outdir>/reels/<code>/{video.mp4,audio.m4a,meta.json}
// list.json: [{url, views_text, handle, stratum}]
//
// Every target writes a status record. A blocked page is recorded as BLOCKED_*, never dropped,
// so an empty result can never read as "nothing there".
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => 3000 + Math.floor(Math.random() * 3000);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

// Handles and reel codes become file names, so only Instagram's own character sets are accepted.
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const CODE_RE = /^[A-Za-z0-9_-]{5,40}$/;
// Media is only captured and downloaded from Instagram's own CDN hosts.
const CDN_HOST_RE = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/;

function parseViews(t) {
  const m = String(t || '').trim().toLowerCase().replace(/,/g, '').match(/^([\d.]+)\s*([kmb]?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1));
}

async function grid(ctx, outdir, handles) {
  fs.mkdirSync(path.join(outdir, 'grids'), { recursive: true });
  for (const h of handles) {
    if (!HANDLE_RE.test(h) || h === '.' || h === '..') { console.log(JSON.stringify(h), 'INVALID_HANDLE skipped'); continue; }
    const rec = { handle: h, observed_at: new Date().toISOString(), status: 'OK', reels: [] };
    const page = await ctx.newPage();
    try {
      await page.goto(`https://www.instagram.com/${h}/reels/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(5000);
      for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(2000); }
      if (/accounts\/login/.test(page.url())) rec.status = 'BLOCKED_LOGIN_WALL';
      rec.profile_description = await page.evaluate(() => {
        const m = document.querySelector('meta[property="og:description"],meta[name="description"]');
        return m ? m.content.slice(0, 200) : null;
      });
      rec.reels = await page.evaluate(() => [...document.querySelectorAll('a[href*="/reel/"]')].map(a => ({
        url: a.href.split('?')[0], views_text: (a.innerText || '').split('\n').filter(Boolean).pop() || null,
      })));
      rec.reels.forEach(r => { r.views = parseViews(r.views_text); });
      if (rec.status === 'OK' && rec.reels.length === 0) rec.status = 'BLOCKED_NO_REELS_VISIBLE';
    } catch (e) { rec.status = 'ERROR'; rec.error = String(e).slice(0, 300); }
    await page.close();
    fs.writeFileSync(path.join(outdir, 'grids', `${h}.json`), JSON.stringify(rec, null, 2));
    console.log(h, rec.status, rec.reels.length);
    await sleep(jitter());
  }
}

// Instagram encodes the track type and bitrate in the base64 `efg` query param.
function decodeTag(u) {
  try {
    const efg = new URL(u).searchParams.get('efg');
    const j = JSON.parse(Buffer.from(decodeURIComponent(efg), 'base64').toString());
    return { tag: j.vencode_tag || '', bitrate: j.bitrate || 0, duration_s: j.duration_s || null };
  } catch { return { tag: '', bitrate: 0, duration_s: null }; }
}

async function reels(ctx, outdir, list) {
  for (const item of list) {
    // Only https://www.instagram.com/[<handle>/]reel/<code>/ is accepted; the page is loaded from the
    // URL rebuilt out of the validated parts, never from the raw input.
    let parsed = null;
    try { parsed = new URL(String(item.url || '')); } catch { parsed = null; }
    const m = parsed && parsed.protocol === 'https:' && parsed.hostname === 'www.instagram.com'
      && parsed.pathname.match(/^\/(?:([A-Za-z0-9._]{1,30})\/)?reel\/([A-Za-z0-9_-]{5,40})\/?$/);
    const code = m ? m[2] : null;
    if (!code || !CODE_RE.test(code) || (m[1] && !HANDLE_RE.test(m[1]))) {
      console.log(JSON.stringify(item.url), 'INVALID_REEL_URL skipped'); continue;
    }
    const pageUrl = `https://www.instagram.com/${m[1] ? m[1] + '/' : ''}reel/${code}/`;
    const dir = path.join(outdir, 'reels', code);
    fs.mkdirSync(dir, { recursive: true });
    const metaPath = path.join(dir, 'meta.json');
    if (fs.existsSync(metaPath) && JSON.parse(fs.readFileSync(metaPath)).status === 'OK') { console.log(code, 'cached'); continue; }
    const meta = { ...item, code, observed_at: new Date().toISOString(), views: item.views ?? parseViews(item.views_text), status: 'OK' };
    const page = await ctx.newPage();
    const media = new Map();
    page.on('response', r => {
      if (!(r.headers()['content-type'] || '').includes('video')) return;
      const u = new URL(r.url());
      if (u.protocol !== 'https:' || !CDN_HOST_RE.test(u.hostname)) return;
      u.searchParams.delete('bytestart'); u.searchParams.delete('byteend');
      const base = u.origin + u.pathname;
      if (!media.has(base)) media.set(base, { url: u.toString(), ...decodeTag(u.toString()) });
    });
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(7000);
      if (/accounts\/login/.test(page.url())) throw new Error('BLOCKED_LOGIN_WALL');
      Object.assign(meta, await page.evaluate(() => {
        const g = p => (document.querySelector(`meta[property="${p}"]`) || {}).content || null;
        const v = document.querySelector('video');
        return { og_title: g('og:title'), og_description: g('og:description'),
          player_w: v ? v.videoWidth : null, player_h: v ? v.videoHeight : null, player_duration: v ? v.duration : null };
      }));
      const tracks = [...media.values()];
      const vids = tracks.filter(t => !/audio/.test(t.tag)).sort((a, b) => b.bitrate - a.bitrate);
      const auds = tracks.filter(t => /audio/.test(t.tag)).sort((a, b) => b.bitrate - a.bitrate);
      meta.tracks = tracks.map(t => ({ tag: t.tag, bitrate: t.bitrate }));
      if (!vids.length) throw new Error('BLOCKED_NO_VIDEO_TRACK');
      // ~720p is plenty for analysis; take the highest bitrate under 3 Mbps.
      const v = vids.find(t => t.bitrate <= 3e6) || vids[vids.length - 1];
      for (const [t, f] of [[v, 'video.mp4'], [auds[0], 'audio.m4a']]) {
        if (!t) { meta.audio_missing = true; continue; }
        const res = await ctx.request.get(t.url, { headers: { referer: 'https://www.instagram.com/' }, timeout: 60000 });
        if (!res.ok()) throw new Error(`DOWNLOAD_${res.status()}_${f}`);
        fs.writeFileSync(path.join(dir, f), await res.body());
      }
      meta.video_tag = v.tag; meta.video_bitrate = v.bitrate;
    } catch (e) {
      const msg = String(e.message || e);
      meta.status = msg.startsWith('BLOCKED') ? msg : 'ERROR';
      meta.error = msg.slice(0, 300);
    }
    await page.close();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log(code, meta.status, meta.views_text || '');
    await sleep(jitter());
  }
}

(async () => {
  const [mode, outdir, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'en-AU' });
  try {
    if (mode === 'grid') await grid(ctx, outdir, rest);
    else if (mode === 'reels') await reels(ctx, outdir, JSON.parse(fs.readFileSync(rest[0])));
    else throw new Error('mode must be grid|reels');
  } finally { await browser.close(); }
})();
