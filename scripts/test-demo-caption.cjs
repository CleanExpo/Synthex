const https = require('https');
const fs = require('fs');

// Read API key from .env.local
const envContent = fs.readFileSync('D:\\Synthex\\.env.local', 'utf8');
const match = envContent.match(/ANTHROPIC_API_KEY="([^"]+)"/);
if (!match) {
  console.log('No ANTHROPIC_API_KEY found');
  process.exit(1);
}
const apiKey = match[1];

const prompt =
  'Write a single Instagram caption (2-3 sentences, 1-2 hashtags) for a business called "CARSI". Australian voice, no emojis, conversational. Return only the caption text, nothing else.';

const postData = JSON.stringify({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 200,
  messages: [{ role: 'user', content: prompt }],
});

const options = {
  hostname: 'api.anthropic.com',
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.content && parsed.content[0]) {
        console.log('=== GENERATED CAPTION ===');
        console.log(parsed.content[0].text);
        console.log('=== MODEL ===');
        console.log(parsed.model);
      } else {
        console.log('Response:', data);
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', e => {
  console.error('Error:', e.message);
});
req.write(postData);
req.end();
