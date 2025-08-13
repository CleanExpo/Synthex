/**
 * Simple local test to POST to unified-login with demo credentials.
 * Avoids PowerShell quoting issues by using Node fetch directly.
 */
import http from 'node:http';

const body = JSON.stringify({
  method: 'demo',
  email: 'demo@synthex.com',
  password: 'demo123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/unified-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    const cookies = res.headers['set-cookie'] || [];
    console.log('STATUS:', res.statusCode);
    console.log('COOKIES:', cookies.join('; '));
    try {
      console.log('BODY:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('BODY:', data);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
