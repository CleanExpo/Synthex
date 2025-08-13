/**
 * Flow test: login via unified-login (demo) then fetch /dashboard with cookie.
 */
import http from 'node:http';

function post(path, json) {
  const body = JSON.stringify(json);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ res, data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers: cookie ? { Cookie: cookie } : {},
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ res, data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const login = await post('/api/auth/unified-login', {
      method: 'demo',
      email: 'demo@synthex.com',
      password: 'demo123',
    });

    const setCookies = login.res.headers['set-cookie'] || [];
    const authCookie = setCookies.find((c) => c.startsWith('auth-token=')) || '';
    console.log('LOGIN STATUS:', login.res.statusCode);
    console.log('LOGIN COOKIE:', authCookie.split(';')[0]);

    const dash = await get('/dashboard', authCookie.split(';')[0]);
    console.log('DASHBOARD STATUS:', dash.res.statusCode);
    console.log('DASHBOARD LENGTH:', dash.data.length);
    console.log('DASHBOARD SNIPPET:', dash.data.substring(0, 120).replace(/\s+/g, ' '));

    process.exit(0);
  } catch (e) {
    console.error('Flow error:', e.message);
    process.exit(1);
  }
})();
