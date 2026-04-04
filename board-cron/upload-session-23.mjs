/**
 * YouTube resumable upload — Session 23
 * Reads credentials from .env.local (Synthex root).
 * Usage: node upload-session-23.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Load credentials from .env.local ---
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../../../.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

// --- Exchange refresh token for access token ---
async function getAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }
  console.log(`Access token obtained (${data.access_token.length} chars)`);
  return data.access_token;
}

// --- Initiate resumable upload session ---
async function initiateUpload(accessToken, fileSize) {
  const metadata = {
    snippet: {
      title: 'Synthex Board Session 23 — Client Journey AI',
      description: [
        'Synthex AI Board Session 23.',
        '',
        'The AI board reviews the client journey AI intelligence report.',
        'Personas: CEO, Market Analyst, Product Lead, Technical Director, Contrarian, Oracle, Compounder, Moonshot.',
        '',
        '#Synthex #AIBoard #ClientJourney',
      ].join('\n'),
      tags: ['Synthex', 'AI', 'board session', 'client journey', 'marketing automation'],
      categoryId: '28', // Science & Technology
    },
    status: {
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: false,
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Initiate upload failed (${res.status}): ${text}`);
  }

  const sessionUri = res.headers.get('location');
  if (!sessionUri) throw new Error('No session URI in response');
  console.log(`Upload session URI obtained`);
  return sessionUri;
}

// --- Upload the file in one PUT ---
async function uploadFile(sessionUri, filePath, fileSize) {
  const fileStream = fs.createReadStream(filePath);

  const url = new URL(sessionUri);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
    },
  };

  return new Promise((resolve, reject) => {
    let uploaded = 0;
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Upload failed (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);

    fileStream.on('data', (chunk) => {
      uploaded += chunk.length;
      const pct = ((uploaded / fileSize) * 100).toFixed(1);
      process.stdout.write(`\rUploading... ${pct}% (${(uploaded / 1e6).toFixed(1)} MB)`);
    });

    fileStream.on('end', () => process.stdout.write('\n'));
    fileStream.pipe(req);
  });
}

// --- Main ---
async function main() {
  const env = loadEnv();
  const clientId = env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing YouTube credentials in .env.local');
  }

  const filePath = path.resolve(__dirname, 'video-assets/renders/session-23.mp4');
  const fileSize = fs.statSync(filePath).size;
  console.log(`File: ${filePath}`);
  console.log(`Size: ${(fileSize / 1e6).toFixed(2)} MB`);

  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
  const sessionUri = await initiateUpload(accessToken, fileSize);
  const result = await uploadFile(sessionUri, filePath, fileSize);

  console.log(`\nUpload complete!`);
  console.log(`Video ID:  ${result.id}`);
  console.log(`Title:     ${result.snippet?.title}`);
  console.log(`Status:    ${result.status?.uploadStatus}`);
  console.log(`Privacy:   ${result.status?.privacyStatus}`);
  console.log(`URL:       https://youtu.be/${result.id}`);
}

main().catch((err) => {
  console.error('\nUpload failed:', err.message);
  process.exit(1);
});
