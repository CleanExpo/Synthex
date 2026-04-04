const https = require('https');

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      res => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== TESTING PRODUCTION DEMO ENDPOINT ===');
  console.log('POST https://synthex.social/api/demo/caption');
  console.log('Body: { businessName: "CARSI" }\n');

  try {
    const result = await post(
      'synthex.social',
      '/api/demo/caption',
      {},
      { businessName: 'CARSI' }
    );
    console.log('HTTP Status:', result.status);
    console.log('Response:', result.body);

    if (result.status === 200) {
      const parsed = JSON.parse(result.body);
      console.log('\n=== CAPTION GENERATED ===');
      console.log(parsed.caption);
      console.log('\nModel:', parsed.model);
      console.log('Tier:', parsed.tier);
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

main();
