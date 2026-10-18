/**
 * @jest-environment node
 *
 * P2 u15: the standalone media-worker has no storage backend for the private
 * reference bucket. POST /extract with `upload` must answer 503
 * FEATURE_NOT_PROVISIONED (after auth, before ffmpeg runs) instead of
 * pretending frames were saved. Runs the real server on a local port.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const TOKEN = 'u15-test-token';
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;

beforeAll(async () => {
  server = spawn(
    process.execPath,
    [path.join(__dirname, '../../../services/media-worker/server.mjs')],
    {
      env: { PATH: process.env.PATH, PORT: String(PORT), WORKER_TOKEN: TOKEN },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('worker did not start')),
      10000
    );
    server.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', code => reject(new Error(`worker exited ${code}`)));
  });
});

afterAll(() => {
  server?.kill();
});

const extract = (body: unknown, token?: string) =>
  fetch(`${BASE}/extract`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const uploadBody = {
  videoUrl: 'http://127.0.0.1:1/never-fetched.mp4',
  upload: { industry: 'carpet', subjectKey: 'frames' },
};

it('rejects an unauthenticated upload with 401', async () => {
  const res = await extract(uploadBody);
  expect(res.status).toBe(401);
});

it('answers an authenticated upload with 503 FEATURE_NOT_PROVISIONED', async () => {
  const res = await extract(uploadBody, TOKEN);
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({
    error: 'FEATURE_NOT_PROVISIONED',
    message:
      'Frame upload is not available: the reference-library-private storage bucket is not provisioned.',
  });
});
