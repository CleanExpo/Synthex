/**
 * YouTube OAuth Token Generator
 * Run: node scripts/get-youtube-token.mjs
 *
 * Opens a browser for you to authorize YouTube access, then captures
 * the refresh token and prints it for .env.local.
 */

import http from 'http';
import { exec } from 'child_process';
import https from 'https';
import { URLSearchParams } from 'url';

const CLIENT_ID =
  process.env.YOUTUBE_CLIENT_ID ||
  '386935133995-gl1mt89ch4jsnqdk154ut72tlksiurki.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:8080';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    login_hint: 'support@synthex.social',
  }).toString();

console.log('\n=== Synthex YouTube OAuth Setup ===');
console.log('Starting local server on port 8080...');
console.log('Opening browser for authorization...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8080');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No code received');
    return;
  }

  console.log('Authorization code received — exchanging for tokens...');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2>✅ Authorized!</h2>
      <p>You can close this tab. Return to the terminal to copy your refresh token.</p>
    </body></html>
  `);

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const tokenData = await new Promise((resolve, reject) => {
    const postData = tokenParams.toString();
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    // Note: if behind a corporate proxy with custom CA, set NODE_EXTRA_CA_CERTS
    const req2 = https.request(options, res2 => {
      let body = '';
      res2.on('data', chunk => (body += chunk));
      res2.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Bad JSON: ' + body));
        }
      });
    });
    req2.on('error', reject);
    req2.write(postData);
    req2.end();
  });

  if (tokenData.error) {
    console.error('Token exchange failed:', tokenData);
    server.close();
    process.exit(1);
  }

  console.log('\n✅ SUCCESS — add these to your .env.local:\n');
  console.log(`YOUTUBE_CLIENT_ID=${CLIENT_ID}`);
  console.log(`YOUTUBE_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokenData.refresh_token}`);
  console.log('\n');

  server.close();
  process.exit(0);
});

server.listen(8080, () => {
  // Open browser
  const cmd =
    process.platform === 'win32'
      ? `start "" "${authUrl}"`
      : `open "${authUrl}"`;
  exec(cmd);
  console.log('If the browser did not open automatically, paste this URL:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...');
});
