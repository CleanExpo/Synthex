/**
 * media-worker — cloud ffmpeg service (Railway).
 *
 * The Synthex build/host has no ffmpeg and can't fetch a binary; this worker
 * runs native ffmpeg (installed in the container) so agents/MCP tools can
 * probe, extract frames from, and transcode owned media of ANY size by URL —
 * with no 4.5MB serverless body cap and no local binary.
 *
 * Endpoints (all POST unless noted; Bearer auth via WORKER_TOKEN):
 *   GET  /health                      → { ok, ffmpeg }
 *   POST /probe      { videoUrl }      → ffprobe metadata
 *   POST /extract    { videoUrl, everySeconds?, maxFrames?, format?, quality?,
 *                      upload?: { industry, subjectKey, label } }
 *                      → frames as base64; with upload → 503
 *                        FEATURE_NOT_PROVISIONED (the private reference
 *                        bucket has no storage backend in this worker)
 *   POST /transcode  { videoUrl, format?, maxWidth?, crf? } → transcoded file (base64)
 *
 * Env: WORKER_TOKEN (required).
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileP = promisify(execFile);
const app = express();
app.use(express.json({ limit: '1mb' }));

// Rate-limit every route: each handler shells out to ffmpeg/ffprobe + touches
// the filesystem, so an unbounded caller (even an authed one) could exhaust
// CPU/disk. 120 req/min/IP is generous for real use and well above Railway's
// health-check cadence.
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const TOKEN = process.env.WORKER_TOKEN;
const PRIVATE_BUCKET = 'reference-library-private';

function auth(req, res, next) {
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!TOKEN || got !== TOKEN)
    return res.status(401).json({ error: 'Unauthorised' });
  next();
}

// Same body as lib/api/not-provisioned.ts notProvisionedBody(); this worker
// deploys standalone and cannot import from the Synthex app.
const uploadNotProvisioned = () => ({
  error: 'FEATURE_NOT_PROVISIONED',
  message: `Frame upload is not available: the ${PRIVATE_BUCKET} storage bucket is not provisioned.`,
});

const isUrl = u => typeof u === 'string' && /^https?:\/\//.test(u);

// http(s) input options — make ffmpeg resilient to servers that drop the
// connection mid-download ("Stream ends prematurely … Input/output error").
// Must precede -i (they configure the http protocol for the next input).
const RECONNECT = [
  '-reconnect',
  '1',
  '-reconnect_streamed',
  '1',
  '-reconnect_on_network_error',
  '1',
  '-reconnect_delay_max',
  '5',
];

app.get('/health', async (_req, res) => {
  try {
    const { stdout } = await execFileP('ffmpeg', ['-version']);
    res.json({ ok: true, ffmpeg: stdout.split('\n')[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/probe', auth, async (req, res) => {
  const { videoUrl } = req.body || {};
  if (!isUrl(videoUrl))
    return res.status(400).json({ error: 'videoUrl (http) required' });
  try {
    const { stdout } = await execFileP(
      'ffprobe',
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        videoUrl,
      ],
      { maxBuffer: 8 * 1024 * 1024 }
    );
    res.json(JSON.parse(stdout));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/extract', auth, async (req, res) => {
  const {
    videoUrl,
    everySeconds = 3,
    maxFrames = 12,
    format = 'jpg',
    quality = 3,
    upload,
  } = req.body || {};
  if (!isUrl(videoUrl))
    return res.status(400).json({ error: 'videoUrl (http) required' });
  // Refuse before running ffmpeg: frames requested for upload must never be
  // dropped or handed back as if they had been saved.
  if (upload) return res.status(503).json(uploadNotProvisioned());

  const dir = await mkdtemp(join(tmpdir(), 'frames-'));
  try {
    await execFileP(
      'ffmpeg',
      [
        ...RECONNECT,
        '-i',
        videoUrl,
        '-vf',
        `fps=1/${Math.max(0.1, Number(everySeconds))}`,
        '-frames:v',
        String(Math.max(1, Math.min(500, Number(maxFrames)))),
        '-q:v',
        String(quality),
        join(dir, `frame_%03d.${format === 'png' ? 'png' : 'jpg'}`),
      ],
      { timeout: 5 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 }
    );

    const files = (await readdir(dir))
      .filter(f => /\.(jpg|png)$/i.test(f))
      .sort();
    const frames = [];
    for (const f of files)
      frames.push({ name: f, buf: await readFile(join(dir, f)) });

    res.json({
      success: true,
      count: frames.length,
      frames: frames.map(f => ({
        name: f.name,
        base64: f.buf.toString('base64'),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.post('/transcode', auth, async (req, res) => {
  const {
    videoUrl,
    format = 'mp4',
    maxWidth = 1280,
    crf = 26,
  } = req.body || {};
  if (!isUrl(videoUrl))
    return res.status(400).json({ error: 'videoUrl (http) required' });
  // Whitelist container → codec so the (user-controlled) format never reaches a
  // filesystem path unchecked (path-injection) and the output is always valid.
  const CONTAINERS = {
    mp4: {
      ext: 'mp4',
      vcodec: 'libx264',
      acodec: 'aac',
      extra: ['-movflags', '+faststart'],
    },
    webm: { ext: 'webm', vcodec: 'libvpx-vp9', acodec: 'libopus', extra: [] },
  };
  const c = CONTAINERS[format] || CONTAINERS.mp4;
  const dir = await mkdtemp(join(tmpdir(), 'tx-'));
  const out = join(dir, `out.${c.ext}`);
  try {
    await execFileP(
      'ffmpeg',
      [
        ...RECONNECT,
        '-i',
        videoUrl,
        '-vf',
        `scale='min(${Number(maxWidth)},iw)':-2`,
        '-c:v',
        c.vcodec,
        '-crf',
        String(crf),
        '-preset',
        'veryfast',
        '-c:a',
        c.acodec,
        ...c.extra,
        out,
      ],
      { timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 }
    );
    const buf = await readFile(out);
    res.json({
      success: true,
      bytes: buf.length,
      base64: buf.toString('base64'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`media-worker listening on :${PORT}`));
