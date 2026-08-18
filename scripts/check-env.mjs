import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = ['.env.local', '.env', '.env.test', '.env.example'];
const critical = [
  'DATABASE_URL',
  'SUPABASE_DB_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'OWNER_EMAILS',
];

function parseEnvKeys(path) {
  const content = readFileSync(path, 'utf8');
  const keys = new Set();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    keys.add(trimmed.split('=')[0]);
  }

  return keys;
}

for (const file of files) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    console.log(`${file}: NOT FOUND`);
    continue;
  }

  const keys = parseEnvKeys(path);
  console.log(`\n${file}: ${keys.size} keys`);

  for (const key of critical) {
    console.log(`  ${key}: ${keys.has(key) ? 'SET' : 'MISSING'}`);
  }
}

console.log('\nSecret values were not printed.');
