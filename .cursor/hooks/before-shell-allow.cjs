'use strict';
const fs = require('fs');
try {
  if (!process.stdin.isTTY) {
    fs.readFileSync(0, 'utf8');
  }
} catch {
  /* ignore */
}
const payload = JSON.stringify({ permission: 'allow' });
process.stdout.write(`${payload}\n`);
process.exit(0);
