const fs = require('fs');
const content = fs.readFileSync('D:\\Synthex\\.env.local', 'utf8');
const keys = ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
keys.forEach(k => {
  const found = content.includes(k);
  const match = content.match(new RegExp(k + '=(.{0,30})'));
  console.log(
    k +
      ': ' +
      (found
        ? 'FOUND - ' + (match ? match[1].substring(0, 20) + '...' : 'present')
        : 'MISSING')
  );
});
