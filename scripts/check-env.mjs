import { readFileSync, existsSync } from 'fs';

const files = ['.env', '.env.local'];
for (const f of files) {
  const path = `D:/Synthex/${f}`;
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    const keys = content.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split('=')[0]);
    console.log(`\n${f} (${keys.length} keys):`);
    console.log(keys.join(', '));

    // Check critical ones
    const critical = ['DATABASE_URL', 'FIELD_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET'];
    for (const k of critical) {
      const line = content.split('\n').find(l => l.startsWith(k + '='));
      if (line) {
        const val = line.split('=').slice(1).join('=');
        console.log(`  ${k}: ${val ? 'SET (' + val.substring(0, 15) + '...)' : 'EMPTY'}`);
      } else {
        console.log(`  ${k}: MISSING`);
      }
    }
  } else {
    console.log(`${f}: NOT FOUND`);
  }
}
