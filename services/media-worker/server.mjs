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
 *                      → frames as base64, or (if upload) pushed into the
 *                        private reference bucket + manifest
 *   POST /transcode  { videoUrl, format?, maxWidth?, crf? } → transcoded file (base64)
 *
 * Env: WORKER_TOKEN (required), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for upload).
 */
import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const execFileP = promisify(execFile);
const app = express();
app.use(express.json({ limit: '1mb' }));

const TOKEN = process.env.WORKER_TOKEN;
const PRIVATE_BUCKET = 'reference-library-private';
const MANIFEST_PATH = '_private-manifest.json';

function auth(req, res, next) {
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!TOKEN || got !== TOKEN)
    return res.status(401).json({ error: 'Unauthorised' });
  next();
}

function supa() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
}

const isUrl = u => typeof u === 'string' && /^https?:\/\//.test(u);

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

  const dir = await mkdtemp(join(tmpdir(), 'frames-'));
  try {
    await execFileP(
      'ffmpeg',
      [
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

    if (upload && upload.industry && upload.subjectKey) {
      const sb = supa();
      if (!sb)
        return res
          .status(500)
          .json({ error: 'Supabase not configured for upload' });
      const ext = format === 'png' ? 'png' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const images = [];
      let i = 0;
      for (const fr of frames) {
        i++;
        const path = `${upload.industry}/${upload.subjectKey}/${String(i).padStart(2, '0')}.${ext}`;
        const { error } = await sb.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fr.buf, { contentType, upsert: true });
        if (error) throw new Error(`upload ${path}: ${error.message}`);
        images.push({
          path,
          bytes: fr.buf.length,
          contentHash:
            'sha256:' + createHash('sha256').update(fr.buf).digest('hex'),
          source: 'owned-video-frame',
        });
      }
      // merge private manifest
      let manifest = { version: 1, industries: {} };
      const { data: existing } = await sb.storage
        .from(PRIVATE_BUCKET)
        .download(MANIFEST_PATH);
      if (existing) {
        try {
          manifest = JSON.parse(await existing.text());
        } catch {}
      }
      manifest.industries ??= {};
      manifest.industries[upload.industry] ??= { subjects: {} };
      manifest.industries[upload.industry].subjects ??= {};
      manifest.industries[upload.industry].subjects[upload.subjectKey] = {
        rights: 'owned',
        label: upload.label || upload.subjectKey,
        provenance: {
          source: 'owned-video-frame',
          rightsBasis: 'owned',
          ingestedAt: new Date().toISOString().slice(0, 10),
        },
        images,
      };
      await sb.storage
        .from(PRIVATE_BUCKET)
        .upload(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest, null, 2)), {
          contentType: 'application/json',
          upsert: true,
        });
      return res.json({
        success: true,
        uploaded: images.length,
        industry: upload.industry,
        subjectKey: upload.subjectKey,
      });
    }

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
  const dir = await mkdtemp(join(tmpdir(), 'tx-'));
  const out = join(dir, `out.${format}`);
  try {
    await execFileP(
      'ffmpeg',
      [
        '-i',
        videoUrl,
        '-vf',
        `scale='min(${Number(maxWidth)},iw)':-2`,
        '-c:v',
        'libx264',
        '-crf',
        String(crf),
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
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
