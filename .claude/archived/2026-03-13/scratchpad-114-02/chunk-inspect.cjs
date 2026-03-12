const fs = require('fs');
const path = require('path');

['6323','40767','62187'].forEach(n => {
  const p = path.join('D:\\Synthex\\.next\\server\\chunks', n + '.js');
  const stat = fs.statSync(p);
  const content = fs.readFileSync(p, 'utf8');
  
  const patterns = [
    'require-in-the-middle', 'import-in-the-middle', 'wrapRouteHandler',
    'Sentry.init', 'shimmer', 'registerHooks', 'new Pool', 'new PrismaClient',
    'opentelemetry', 'OTel', '@opentelemetry', 'pg.Pool', 'createConnection'
  ];
  
  console.log(`\n=== chunk ${n} (${stat.size} bytes) ===`);
  patterns.forEach(p => {
    if (content.includes(p)) console.log(`  FOUND: "${p}"`);
  });
  console.log('  (done)');
});
