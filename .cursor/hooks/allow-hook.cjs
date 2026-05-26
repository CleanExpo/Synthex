'use strict';
const fs = require('fs');
try {
  if (!process.stdin.isTTY) {
    fs.readFileSync(0, 'utf8');
  }
} catch {
  /* ignore */
}
process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
process.exit(0);
