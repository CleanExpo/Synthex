const fs = require('fs');
const path = require('path');

function main() {
  const inputPath = path.resolve('public/js/api-client.js');
  const outDir = path.resolve('agents/reports');
  const outPath = path.join(outDir, 'client-endpoints.json');

  if (!fs.existsSync(inputPath)) {
    console.error('Input file not found:', inputPath);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const src = fs.readFileSync(inputPath, 'utf8');

  // Match calls like: return this.get('/path' ...), return this.post(`/path/${id}` ...)
  const callRegex = /return\s+this\.(get|post|put|patch|delete)\(\s*([`'"])(.+?)\2/gi;

  const endpoints = [];
  let match;
  while ((match = callRegex.exec(src)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[3];

    // Only capture literal string endpoints that start with '/'
    if (typeof endpoint === 'string' && endpoint.startsWith('/')) {
      // Normalize template segments like ${id} => :param to align with server display paths
      const normalized = ('/api/v2' + endpoint).replace(/\$\{[^}]+\}/g, ':param');
      endpoints.push({
        method,
        path: normalized
      });
    }
  }

  // De-duplicate
  const seen = new Set();
  const unique = [];
  for (const e of endpoints) {
    const key = `${e.method} ${e.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }

  // Sort for consistency
  unique.sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), inputPath),
    count: unique.length,
    endpoints: unique
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote client endpoint report to ${path.relative(process.cwd(), outPath)} (${unique.length} endpoints)`);
}

main();
