const fs = require('fs');
const path = require('path');
const dir = '.next/server/chunks';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
console.log(`Checking ${files.length} chunk files...`);

const hits = [];
for (const f of files) {
  const full = path.join(dir, f);
  const c = fs.readFileSync(full, 'utf8');
  const size = fs.statSync(full).size;
  const hasRitm = c.includes('require-in-the-middle');
  const hasIitm = c.includes('import-in-the-middle');
  const hasSentry = c.includes('@sentry/') || c.includes('Sentry.init');
  const hasOtel = c.includes('@opentelemetry');
  if (hasRitm || hasIitm || hasSentry || hasOtel) {
    hits.push({ f, size, hasRitm, hasIitm, hasSentry, hasOtel });
    console.log(`  ${f} (${size}b): ritm=${hasRitm} iitm=${hasIitm} sentry=${hasSentry} otel=${hasOtel}`);
  }
}

if (hits.length === 0) {
  console.log('CLEAN: No Sentry/OTel in any shared chunk!');
} else {
  console.log(`\nFound ${hits.length} affected chunks`);
}

// Also check the health/live NFT
const nft = '.next/server/app/api/health/live/route.js.nft.json';
if (fs.existsSync(nft)) {
  const data = JSON.parse(fs.readFileSync(nft, 'utf8'));
  console.log('\nhealth/live NFT chunks:', data.files.filter(f => f.includes('chunks/')));
}
